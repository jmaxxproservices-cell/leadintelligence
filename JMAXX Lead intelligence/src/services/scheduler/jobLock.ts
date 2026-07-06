import { supabase } from '../../lib/supabase';

export interface JobLock {
  id: string;
  connector_id: string;
  execution_id: string | null;
  locked_at: string;
  locked_by: string;
  expires_at: string;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface LockResult {
  acquired: boolean;
  lock?: JobLock;
  reason?: string;
  existingLock?: JobLock;
}

const DEFAULT_LOCK_TTL_SECONDS = 600; // 10 minutes
const STALE_LOCK_TTL_SECONDS = 120; // 2 minutes for stale detection

class JobLockService {
  /**
   * Attempt to acquire a lock for a connector
   */
  async acquireLock(
    connectorId: string,
    executionId: string,
    ttlSeconds: number = DEFAULT_LOCK_TTL_SECONDS
  ): Promise<LockResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    // First, check for existing active lock
    const { data: existingLock } = await supabase
      .from('job_locks')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('is_active', true)
      .gt('expires_at', now.toISOString())
      .maybeSingle();

    if (existingLock) {
      // Lock is still valid
      return {
        acquired: false,
        reason: 'Lock already held',
        existingLock: existingLock as JobLock,
      };
    }

    // Check for stale lock (past expiry but still marked active)
    const { data: staleLock } = await supabase
      .from('job_locks')
      .select('*')
      .eq('connector_id', connectorId)
      .eq('is_active', true)
      .lte('expires_at', now.toISOString())
      .maybeSingle();

    if (staleLock) {
      // Release the stale lock
      await this.releaseLock(connectorId, true);
    }

    // Try to acquire lock using upsert
    const { data: lock, error } = await supabase
      .from('job_locks')
      .upsert(
        {
          connector_id: connectorId,
          execution_id: executionId,
          locked_at: now.toISOString(),
          locked_by: 'scheduler',
          expires_at: expiresAt.toISOString(),
          is_active: true,
          metadata: { executionId },
        },
        {
          onConflict: 'connector_id',
        }
      )
      .select()
      .single();

    if (error) {
      // Race condition - another process acquired the lock
      if (error.code === '23505') {
        return {
          acquired: false,
          reason: 'Lock acquired by another process',
        };
      }

      return {
        acquired: false,
        reason: `Database error: ${error.message}`,
      };
    }

    return {
      acquired: true,
      lock: lock as JobLock,
    };
  }

  /**
   * Release a lock
   */
  async releaseLock(connectorId: string, force: boolean = false): Promise<boolean> {
    const update = force
      ? { is_active: false, metadata: { released_reason: 'forced' } }
      : { is_active: false };

    const { error } = await supabase
      .from('job_locks')
      .update({
        is_active: false,
        expires_at: new Date().toISOString(),
      })
      .eq('connector_id', connectorId);

    return !error;
  }

  /**
   * Extend lock TTL
   */
  async extendLock(
    connectorId: string,
    additionalSeconds: number = DEFAULT_LOCK_TTL_SECONDS
  ): Promise<boolean> {
    const now = new Date();
    const newExpiry = new Date(now.getTime() + additionalSeconds * 1000);

    const { error } = await supabase
      .from('job_locks')
      .update({
        expires_at: newExpiry.toISOString(),
      })
      .eq('connector_id', connectorId)
      .eq('is_active', true);

    return !error;
  }

  /**
   * Check if a lock is held
   */
  async isLocked(connectorId: string): Promise<boolean> {
    const now = new Date();

    const { data: lock } = await supabase
      .from('job_locks')
      .select('id')
      .eq('connector_id', connectorId)
      .eq('is_active', true)
      .gt('expires_at', now.toISOString())
      .maybeSingle();

    return !!lock;
  }

  /**
   * Get all active locks
   */
  async getActiveLocks(): Promise<JobLock[]> {
    const now = new Date();

    const { data: locks } = await supabase
      .from('job_locks')
      .select('*')
      .eq('is_active', true)
      .gt('expires_at', now.toISOString());

    return (locks || []) as JobLock[];
  }

  /**
   * Clean up stale locks
   */
  async cleanupStaleLocks(): Promise<number> {
    const now = new Date();

    const { data: staleLocks } = await supabase
      .from('job_locks')
      .update({
        is_active: false,
        metadata: { released_reason: 'stale_cleanup', released_at: now.toISOString() },
      })
      .eq('is_active', true)
      .lt('expires_at', now.toISOString())
      .select('id');

    return staleLocks?.length || 0;
  }

  /**
   * Get lock status for multiple connectors
   */
  async getLockStatus(connectorIds: string[]): Promise<Record<string, boolean>> {
    const now = new Date();
    const result: Record<string, boolean> = {};

    for (const id of connectorIds) {
      result[id] = false;
    }

    const { data: locks } = await supabase
      .from('job_locks')
      .select('connector_id')
      .in('connector_id', connectorIds)
      .eq('is_active', true)
      .gt('expires_at', now.toISOString());

    if (locks) {
      for (const lock of locks) {
        result[lock.connector_id] = true;
      }
    }

    return result;
  }
}

export const jobLockService = new JobLockService();
