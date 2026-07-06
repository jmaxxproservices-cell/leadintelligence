import { supabase } from '../../lib/supabase';
import { jobLockService } from './jobLock';
import { executionQueueService } from './executionQueue';
import { errorClassificationService } from './errorClassification';
import { metricsAggregationService } from './metrics';

// Types
export interface SchedulerJob {
  id: string;
  connector_id: string;
  connector_name: string;
  connector_type: string;
  schedule_cron: string;
  is_enabled: boolean;
  max_retries: number;
  retry_delay_seconds: number;
  timeout_seconds: number;
  last_execution_id: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string;
  consecutive_failures: number;
  total_runs: number;
  total_successes: number;
  total_failures: number;
}

export interface ExecutionRecord {
  id: string;
  job_id: string;
  connector_id: string;
  connector_name: string;
  connector_type: string;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'retrying';
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  leads_fetched: number;
  leads_created: number;
  leads_duplicates: number;
  leads_invalid: number;
  hot_leads_detected: number;
  retries_attempted: number;
  error_message: string | null;
  error_stack: string | null;
  metadata: Record<string, unknown>;
}

export interface SystemHealthStatus {
  component: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  last_check: string;
  last_success: string | null;
  last_failure: string | null;
  uptime_seconds: number;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  response_time_ms: number | null;
  error_message: string | null;
}

export interface ErrorLogEntry {
  id: string;
  component: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  stack_trace: string | null;
  context: Record<string, unknown>;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface SchedulerState {
  isRunning: boolean;
  tickCount: number;
  currentTickJobs: Set<string>;
}

class SchedulerService {
  private state: SchedulerState = {
    isRunning: false,
    tickCount: 0,
    currentTickJobs: new Set(),
  };

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private readonly TICK_INTERVAL_MS = 60000;
  private readonly DEFAULT_TIMEOUT_SEC = 300;

  // ==================== LIFECYCLE ====================

  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.log('[Scheduler] Already running');
      return;
    }

    this.state.isRunning = true;
    console.log('[Scheduler] Starting...');

    await this.logSystemHealth('scheduler', 'healthy');

    // Clean up stale locks on startup
    const cleanedLocks = await jobLockService.cleanupStaleLocks();
    if (cleanedLocks > 0) {
      console.log(`[Scheduler] Cleaned ${cleanedLocks} stale locks`);
    }

    this.tickInterval = setInterval(() => this.tick(), this.TICK_INTERVAL_MS);
    await this.tick();
  }

  async stop(): Promise<void> {
    if (!this.state.isRunning) return;

    console.log('[Scheduler] Stopping...');
    this.state.isRunning = false;

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    await this.logSystemHealth('scheduler', 'down');
  }

  // ==================== MAIN LOOP ====================

  private async tick(): Promise<void> {
    if (!this.state.isRunning) return;

    this.state.tickCount++;

    const now = new Date();
    console.log(`[Scheduler] Tick #${this.state.tickCount} at ${now.toISOString()}`);

    await this.updateSystemHealth('scheduler', 'healthy', {
      last_check: now.toISOString(),
      total_checks: this.state.tickCount,
    });

    // Clean up stale locks periodically
    if (this.state.tickCount % 5 === 0) {
      await jobLockService.cleanupStaleLocks();
    }

    // Aggregate metrics periodically
    if (this.state.tickCount % 60 === 0) {
      await metricsAggregationService.aggregateToHour();
    }

    // Get due jobs that are NOT locked
    const jobs = await this.getDueJobs(now);
    console.log(`[Scheduler] Found ${jobs.length} due jobs`);

    // Process each job with full isolation
    for (const job of jobs) {
      // Skip if already being processed in this tick
      if (this.state.currentTickJobs.has(job.connector_id)) {
        continue;
      }

      // Skip if locked by another process
      const isLocked = await jobLockService.isLocked(job.connector_id);
      if (isLocked) {
        continue;
      }

      // Check queue capacity
      if (!executionQueueService.canStartMore()) {
        console.log('[Scheduler] Queue at capacity, deferring jobs');
        break;
      }

      // Process asynchronously with isolation
      this.executeJobIsolated(job).catch((err) => {
        console.error(`[Scheduler] Job ${job.connector_id} crashed:`, err);
      });
    }
  }

  // ==================== JOB EXECUTION ====================

  async executeJobIsolated(job: SchedulerJob): Promise<ExecutionRecord | null> {
    const executionId = crypto.randomUUID();

    // Mark as processing in current tick
    this.state.currentTickJobs.add(job.connector_id);

    try {
      return await this.executeJob(job, executionId);
    } finally {
      this.state.currentTickJobs.delete(job.connector_id);
    }
  }

  async executeJob(job: SchedulerJob, executionId?: string): Promise<ExecutionRecord> {
    const execId = executionId || crypto.randomUUID();

    // 1. TRY TO ACQUIRE LOCK
    const lockResult = await jobLockService.acquireLock(job.connector_id, execId, this.DEFAULT_TIMEOUT_SEC);

    if (!lockResult.acquired) {
      console.log(`[Scheduler] Could not acquire lock for ${job.connector_name}: ${lockResult.reason}`);
      throw new Error(`Lock acquisition failed: ${lockResult.reason}`);
    }

    // 2. CREATE EXECUTION RECORD
    const recordId = await this.createExecutionRecord(job, execId);

    console.log(`[Scheduler] Executing job: ${job.connector_name} (${job.connector_id})`);

    let attempts = 0;
    let lastError: Error | null = null;

    // 3. RETRY LOOP
    while (attempts <= job.max_retries) {
      try {
        // Update status
        if (attempts > 0) {
          await this.updateExecutionStatus(recordId, 'retrying', { retries_attempted: attempts });
          await this.sleep(this.calculateRetryDelay(job, attempts));

          // Extend lock
          await jobLockService.extendLock(job.connector_id, this.DEFAULT_TIMEOUT_SEC);
        }

        await this.updateExecutionStatus(recordId, 'running');

        // Execute with timeout
        const result = await this.executeConnectorWithTimeout(job, execId);

        // 4. SUCCESS
        await this.completeExecution(recordId, result);
        await this.updateJobSuccess(job.connector_id);
        await jobLockService.releaseLock(job.connector_id);

        // Record metrics
        await metricsAggregationService.recordExecutionMetrics(job.connector_type, {
          fetched: result.fetched,
          created: result.created,
          duplicates: result.duplicates,
          invalid: result.invalid,
          hotDetected: result.hotDetected,
          durationMs: result.durationMs,
          success: true,
        });

        this.logSystemHealth(`connector_${job.connector_type}`, 'healthy');

        return this.mapExecution((await this.getExecution(recordId))!);
      } catch (error) {
        lastError = error as Error;
        attempts++;

        // Classify error
        const classified = await errorClassificationService.classify(lastError);
        const shouldRetry = classified.shouldRetry && attempts <= job.max_retries;

        await errorClassificationService.logClassifiedError(job.connector_type, lastError, {
          job_id: job.id,
          execution_id: execId,
          retry_attempt: attempts,
          error_type: classified.classification.error_type,
        });

        if (!shouldRetry) {
          break;
        }
      }
    }

    // 5. FAILURE
    await this.failExecution(recordId, lastError);
    await this.updateJobFailure(job.connector_id);
    await jobLockService.releaseLock(job.connector_id);

    // Record failure metric
    await metricsAggregationService.recordExecutionMetrics(job.connector_type, {
      fetched: 0,
      created: 0,
      duplicates: 0,
      invalid: 0,
      hotDetected: 0,
      durationMs: 0,
      success: false,
    });

    this.logSystemHealth(`connector_${job.connector_type}`, 'degraded', {
      error_message: lastError?.message,
    });

    return this.mapExecution((await this.getExecution(recordId))!);
  }

  // ==================== CONNECTOR EXECUTION ====================

  private async executeConnectorWithTimeout(
    job: SchedulerJob,
    executionId: string
  ): Promise<{
    fetched: number;
    created: number;
    duplicates: number;
    invalid: number;
    hotDetected: number;
    durationMs: number;
  }> {
    const startTime = Date.now();

    const { connectorRegistry } = await import('../connectors/registry');
    await connectorRegistry.initialize();

    const connector = connectorRegistry.get(job.connector_id);
    if (!connector) {
      throw new Error(`Connector not found: ${job.connector_id}`);
    }

    const timeoutMs = job.timeout_seconds * 1000;

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Execution timeout')), timeoutMs);
    });

    const ingestPromise = connector.ingest({
      autoScore: true,
      generateAlerts: true,
      skipDuplicates: true,
    });

    const result = await Promise.race([ingestPromise, timeoutPromise]);

    const durationMs = Date.now() - startTime;

    return {
      fetched: result.fetched,
      created: result.created,
      duplicates: result.duplicates,
      invalid: result.invalid,
      hotDetected: result.hotDetected,
      durationMs,
    };
  }

  // ==================== PERSISTENCE ====================

  private async createExecutionRecord(job: SchedulerJob, executionId: string): Promise<string> {
    const { data } = await supabase
      .from('execution_history')
      .insert({
        id: executionId,
        job_id: job.id,
        connector_id: job.connector_id,
        connector_name: job.connector_name,
        connector_type: job.connector_type,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    return data!.id;
  }

  private async updateExecutionStatus(
    executionId: string,
    status: ExecutionRecord['status'],
    updates?: Partial<ExecutionRecord>
  ): Promise<void> {
    await supabase
      .from('execution_history')
      .update({
        status,
        ...updates,
      })
      .eq('id', executionId);
  }

  private async completeExecution(
    executionId: string,
    result: {
      fetched: number;
      created: number;
      duplicates: number;
      invalid: number;
      hotDetected: number;
      durationMs: number;
    }
  ): Promise<void> {
    await supabase
      .from('execution_history')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: result.durationMs,
        leads_fetched: result.fetched,
        leads_created: result.created,
        leads_duplicates: result.duplicates,
        leads_invalid: result.invalid,
        hot_leads_detected: result.hotDetected,
      })
      .eq('id', executionId);
  }

  private async failExecution(executionId: string, error: Error | null): Promise<void> {
    await supabase
      .from('execution_history')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error?.message || 'Unknown error',
        error_stack: error?.stack,
      })
      .eq('id', executionId);
  }

  private async updateJobSuccess(connectorId: string): Promise<void> {
    const now = new Date();
    const nextRun = this.calculateNextRun('*/30 * * * *');

    await supabase
      .from('scheduler_jobs')
      .update({
        last_status: 'completed',
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        consecutive_failures: 0,
        total_runs: (await this.getJobTotal(connectorId, 'total_runs')) + 1,
        total_successes: (await this.getJobTotal(connectorId, 'total_successes')) + 1,
        updated_at: now.toISOString(),
      })
      .eq('connector_id', connectorId);
  }

  private async updateJobFailure(connectorId: string): Promise<void> {
    const now = new Date();
    const consecutiveFailures = (await this.getJobTotal(connectorId, 'consecutive_failures')) + 1;

    const nextRunDelay = Math.min(consecutiveFailures * 5, 60);
    const nextRun = new Date(now.getTime() + nextRunDelay * 60000);

    await supabase
      .from('scheduler_jobs')
      .update({
        last_status: 'failed',
        last_run_at: now.toISOString(),
        next_run_at: nextRun.toISOString(),
        consecutive_failures: consecutiveFailures,
        total_runs: (await this.getJobTotal(connectorId, 'total_runs')) + 1,
        total_failures: (await this.getJobTotal(connectorId, 'total_failures')) + 1,
        updated_at: now.toISOString(),
      })
      .eq('connector_id', connectorId);
  }

  // ==================== HELPERS ====================

  private async getDueJobs(now: Date): Promise<SchedulerJob[]> {
    const { data: jobs } = await supabase
      .from('scheduler_jobs')
      .select('*')
      .eq('is_enabled', true)
      .or(`next_run_at.is.null,next_run_at.lte.${now.toISOString()}`);

    return (jobs || []).map((j) => this.mapJob(j));
  }

  private async getJobTotal(connectorId: string, field: string): Promise<number> {
    const { data } = await supabase
      .from('scheduler_jobs')
      .select(field)
      .eq('connector_id', connectorId)
      .single();

    return Number(data?.[field] || 0);
  }

  private getExecution(id: string): Promise<Record<string, unknown> | null> {
    return supabase
      .from('execution_history')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => data);
  }

  private calculateNextRun(cron: string): Date {
    const now = new Date();
    const intervalMatch = cron.match(/^\*\/(\d+)/);

    if (intervalMatch) {
      const interval = parseInt(intervalMatch[1], 10);
      return new Date(now.getTime() + interval * 60000);
    }

    return new Date(now.getTime() + 1800000);
  }

  private calculateRetryDelay(job: SchedulerJob, attempt: number): number {
    // Exponential backoff with base from job config
    const baseDelay = job.retry_delay_seconds * 1000;
    return Math.min(baseDelay * Math.pow(2, attempt), 300000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private mapJob(data: Record<string, unknown>): SchedulerJob {
    return data as unknown as SchedulerJob;
  }

  private mapExecution(data: Record<string, unknown>): ExecutionRecord {
    return data as unknown as ExecutionRecord;
  }

  // ==================== SYSTEM HEALTH ====================

  private async updateSystemHealth(
    component: string,
    status: SystemHealthStatus['status'],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await supabase.from('system_health').upsert(
      {
        component,
        status,
        last_check: new Date().toISOString(),
        ...(status === 'healthy' && { last_success: new Date().toISOString() }),
        ...(status !== 'healthy' && { last_failure: new Date().toISOString() }),
        ...metadata,
      },
      { onConflict: 'component' }
    );
  }

  private async logSystemHealth(component: string, status: string): Promise<void> {
    await supabase
      .from('system_health')
      .update({
        status,
        last_check: new Date().toISOString(),
      })
      .eq('component', component);
  }

  // ==================== PUBLIC API ====================

  getStatus(): { isRunning: boolean; tickCount: number; currentJobs: string[] } {
    return {
      isRunning: this.state.isRunning,
      tickCount: this.state.tickCount,
      currentJobs: Array.from(this.state.currentTickJobs),
    };
  }

  async getJobs(): Promise<SchedulerJob[]> {
    const { data } = await supabase.from('scheduler_jobs').select('*').order('connector_name');
    return (data || []).map((j) => this.mapJob(j));
  }

  async getExecutionHistory(limit: number = 50): Promise<ExecutionRecord[]> {
    const { data } = await supabase
      .from('execution_history')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    return (data || []).map((e) => this.mapExecution(e));
  }

  async getSystemHealth(): Promise<SystemHealthStatus[]> {
    const { data } = await supabase.from('system_health').select('*').order('component');
    return (data || []) as unknown as SystemHealthStatus[];
  }

  async getErrorLogs(limit: number = 100): Promise<ErrorLogEntry[]> {
    const { data } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as unknown as ErrorLogEntry[];
  }

  async triggerJob(connectorId: string): Promise<ExecutionRecord | null> {
    const { data: job } = await supabase
      .from('scheduler_jobs')
      .select('*')
      .eq('connector_id', connectorId)
      .single();

    if (!job) return null;

    return this.executeJobIsolated(this.mapJob(job));
  }

  async createJob(config: {
    connector_id: string;
    connector_name: string;
    connector_type: string;
    schedule_cron?: string;
    is_enabled?: boolean;
  }): Promise<SchedulerJob | null> {
    const { data, error } = await supabase
      .from('scheduler_jobs')
      .insert({
        connector_id: config.connector_id,
        connector_name: config.connector_name,
        connector_type: config.connector_type,
        schedule_cron: config.schedule_cron || '*/30 * * * *',
        is_enabled: config.is_enabled ?? true,
        next_run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return null;
    return this.mapJob(data);
  }

  async updateJobSchedule(connectorId: string, cron: string): Promise<boolean> {
    const { error } = await supabase
      .from('scheduler_jobs')
      .update({
        schedule_cron: cron,
        updated_at: new Date().toISOString(),
      })
      .eq('connector_id', connectorId);
    return !error;
  }

  async enableJob(connectorId: string): Promise<boolean> {
    const { error } = await supabase
      .from('scheduler_jobs')
      .update({
        is_enabled: true,
        next_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('connector_id', connectorId);
    return !error;
  }

  async disableJob(connectorId: string): Promise<boolean> {
    const { error } = await supabase
      .from('scheduler_jobs')
      .update({
        is_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('connector_id', connectorId);
    return !error;
  }

  async resolveError(errorId: string, resolvedBy: string = 'manual'): Promise<boolean> {
    const { error } = await supabase
      .from('error_logs')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
      })
      .eq('id', errorId);
    return !error;
  }

  // Get active locks
  async getActiveLocks() {
    return jobLockService.getActiveLocks();
  }

  // Cleanup stale locks
  async cleanupLocks(): Promise<number> {
    return jobLockService.cleanupStaleLocks();
  }
}

export const schedulerService = new SchedulerService();
