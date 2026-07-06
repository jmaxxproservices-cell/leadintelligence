import { supabase } from '../../lib/supabase';

export interface QueuedJob {
  id: string;
  connector_id: string;
  connector_name: string;
  connector_type: string;
  priority: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  retry_count: number;
  max_retries: number;
  error_type: string | null;
  error_message: string | null;
  is_transient_error: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  total: number;
}

const MAX_CONCURRENT_JOBS = 5;
const QUEUE_POLL_INTERVAL_MS = 5000;

class ExecutionQueueService {
  private processing: Set<string> = new Set();
  private isPolling: boolean = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private maxConcurrent: number = MAX_CONCURRENT_JOBS;

  /**
   * Enqueue a job for execution
   */
  async enqueue(
    connectorId: string,
    connectorName: string,
    connectorType: string,
    options?: {
      priority?: number;
      scheduledFor?: Date;
      maxRetries?: number;
    }
  ): Promise<QueuedJob | null> {
    const { data, error } = await supabase
      .from('execution_queue')
      .insert({
        connector_id: connectorId,
        connector_name: connectorName,
        connector_type: connectorType,
        priority: options?.priority ?? 5,
        scheduled_for: options?.scheduledFor?.toISOString() ?? new Date().toISOString(),
        status: 'pending',
        retry_count: 0,
        max_retries: options?.maxRetries ?? 3,
      })
      .select()
      .single();

    if (error) {
      console.error('[Queue] Failed to enqueue job:', error);
      return null;
    }

    return data as QueuedJob;
  }

  /**
   * Get next job to execute
   */
  async getNextJob(): Promise<QueuedJob | null> {
    const now = new Date();

    const { data: jobs } = await supabase
      .from('execution_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', now.toISOString())
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    return (jobs?.[0] as QueuedJob) || null;
  }

  /**
   * Mark job as running
   */
  async startJob(jobId: string): Promise<boolean> {
    const { error } = await supabase
      .from('execution_queue')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return !error;
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string): Promise<boolean> {
    const { error } = await supabase
      .from('execution_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return !error;
  }

  /**
   * Mark job as failed
   */
  async failJob(
    jobId: string,
    errorType: string,
    errorMessage: string,
    isTransient: boolean
  ): Promise<boolean> {
    const { data: job } = await supabase
      .from('execution_queue')
      .select('retry_count, max_retries')
      .eq('id', jobId)
      .single();

    const shouldRetry = isTransient && job && job.retry_count < job.max_retries;

    if (shouldRetry) {
      // Schedule retry
      const retryDelay = this.calculateRetryDelay(job.retry_count);
      const scheduledFor = new Date(Date.now() + retryDelay);

      await supabase
        .from('execution_queue')
        .update({
          status: 'pending',
          retry_count: job.retry_count + 1,
          error_type: errorType,
          error_message: errorMessage,
          is_transient_error: isTransient,
          scheduled_for: scheduledFor.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return true;
    }

    // Mark as failed
    const { error } = await supabase
      .from('execution_queue')
      .update({
        status: 'failed',
        error_type: errorType,
        error_message: errorMessage,
        is_transient_error: isTransient,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return !error;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    const { data: stats } = await supabase
      .from('execution_queue')
      .select('status');

    const counts: QueueStats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      total: stats?.length || 0,
    };

    if (stats) {
      for (const s of stats) {
        const status = s.status as QueueStats[keyof QueueStats];
        if (typeof counts[status] === 'number') {
          (counts as Record<string, number>)[status]++;
        }
      }
    }

    return counts;
  }

  /**
   * Get pending job count
   */
  async getPendingCount(): Promise<number> {
    const { count } = await supabase
      .from('execution_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString());

    return count || 0;
  }

  /**
   * Check if we can start more jobs
   */
  canStartMore(): boolean {
    return this.processing.size < this.maxConcurrent;
  }

  /**
   * Start processing a job
   */
  startProcessing(jobId: string): void {
    this.processing.add(jobId);
  }

  /**
   * Stop processing a job
   */
  stopProcessing(jobId: string): void {
    this.processing.delete(jobId);
  }

  /**
   * Get currently processing jobs
   */
  getProcessingJobs(): string[] {
    return Array.from(this.processing);
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(retryCount: number): number {
    // Base delay: 1 minute, max: 1 hour
    const baseDelay = 60000;
    const maxDelay = 3600000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
    return delay;
  }

  /**
   * Clean up old completed/failed jobs
   */
  async cleanupOldJobs(olderThanHours: number = 24): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanHours * 3600000);

    const { data: deleted } = await supabase
      .from('execution_queue')
      .delete()
      .in('status', ['completed', 'failed'])
      .lt('created_at', cutoff.toISOString())
      .select('id');

    return deleted?.length || 0;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const { error } = await supabase
      .from('execution_queue')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .in('status', ['pending', 'running']);

    return !error;
  }

  /**
   * Get jobs by connector
   */
  async getJobsByConnector(connectorId: string, limit: number = 10): Promise<QueuedJob[]> {
    const { data: jobs } = await supabase
      .from('execution_queue')
      .select('*')
      .eq('connector_id', connectorId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (jobs || []) as QueuedJob[];
  }

  /**
   * Set max concurrent jobs
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
  }

  /**
   * Get max concurrent jobs
   */
  getMaxConcurrent(): number {
    return this.maxConcurrent;
  }
}

export const executionQueueService = new ExecutionQueueService();
