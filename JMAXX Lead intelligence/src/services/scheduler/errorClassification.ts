import { supabase } from '../../lib/supabase';

export type ErrorType = 'transient' | 'permanent' | 'configuration' | 'rate_limit' | 'network' | 'timeout' | 'unknown';

export interface ErrorClassification {
  id: string;
  error_pattern: string;
  error_type: ErrorType;
  severity: number;
  recovery_strategy: string | null;
  recovery_action: string | null;
  retry_allowed: boolean;
  retry_delay_seconds: number;
  max_retries: number;
}

export interface ClassifiedError {
  originalError: Error;
  classification: ErrorClassification;
  isTransient: boolean;
  shouldRetry: boolean;
  retryDelay: number;
}

class ErrorClassificationService {
  private cache: Map<string, ErrorClassification> = new Map();
  private cacheLoaded: boolean = false;

  /**
   * Load error classifications into cache
   */
  async loadClassifications(): Promise<void> {
    if (this.cacheLoaded) return;

    const { data: classifications } = await supabase
      .from('error_classifications')
      .select('*');

    if (classifications) {
      this.cache.clear();
      for (const c of classifications) {
        this.cache.set(c.error_pattern.toLowerCase(), c as ErrorClassification);
      }
    }

    this.cacheLoaded = true;
  }

  /**
   * Classify an error
   */
  async classify(error: Error): Promise<ClassifiedError> {
    await this.loadClassifications();

    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code?.toString().toLowerCase() || '';

    // Try to match by pattern
    for (const [pattern, classification] of this.cache.entries()) {
      if (errorMessage.includes(pattern) || errorCode.includes(pattern)) {
        return {
          originalError: error,
          classification,
          isTransient: this.isTransientType(classification.error_type),
          shouldRetry: classification.retry_allowed,
          retryDelay: classification.retry_delay_seconds * 1000,
        };
      }
    }

    // Default classification for unknown errors
    const defaultClassification: ErrorClassification = {
      id: 'default',
      error_pattern: '*',
      error_type: 'unknown',
      severity: 3,
      recovery_strategy: 'Retry with backoff',
      recovery_action: null,
      retry_allowed: true,
      retry_delay_seconds: 60,
      max_retries: 3,
    };

    return {
      originalError: error,
      classification: defaultClassification,
      isTransient: false,
      shouldRetry: true,
      retryDelay: 60000,
    };
  }

  /**
   * Check if error type is transient
   */
  private isTransientType(type: ErrorType): boolean {
    return ['transient', 'network', 'timeout', 'rate_limit'].includes(type);
  }

  /**
   * Get all classifications
   */
  async getAllClassifications(): Promise<ErrorClassification[]> {
    await this.loadClassifications();
    return Array.from(this.cache.values());
  }

  /**
   * Add a new classification
   */
  async addClassification(
    pattern: string,
    type: ErrorType,
    options?: {
      severity?: number;
      recoveryStrategy?: string;
      retryAllowed?: boolean;
      retryDelaySeconds?: number;
      maxRetries?: number;
    }
  ): Promise<ErrorClassification | null> {
    const { data, error } = await supabase
      .from('error_classifications')
      .insert({
        error_pattern: pattern,
        error_type: type,
        severity: options?.severity ?? 3,
        recovery_strategy: options?.recoveryStrategy,
        retry_allowed: options?.retryAllowed ?? true,
        retry_delay_seconds: options?.retryDelaySeconds ?? 60,
        max_retries: options?.maxRetries ?? 3,
      })
      .select()
      .single();

    if (error) {
      console.error('[ErrorClassification] Failed to add classification:', error);
      return null;
    }

    this.cache.set(pattern.toLowerCase(), data as ErrorClassification);
    return data as ErrorClassification;
  }

  /**
   * Update an existing classification
   */
  async updateClassification(
    pattern: string,
    updates: Partial<ErrorClassification>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('error_classifications')
      .update(updates)
      .eq('error_pattern', pattern);

    if (!error) {
      this.cache.delete(pattern.toLowerCase());
      this.cacheLoaded = false;
    }

    return !error;
  }

  /**
   * Quick check if error is retryable
   */
  async isRetryable(error: Error): Promise<boolean> {
    const classified = await this.classify(error);
    return classified.shouldRetry;
  }

  /**
   * Get retry delay for an error
   */
  async getRetryDelay(error: Error): Promise<number> {
    const classified = await this.classify(error);
    return classified.retryDelay;
  }

  /**
   * Log classified error
   */
  async logClassifiedError(
    component: string,
    error: Error,
    context: Record<string, unknown>
  ): Promise<ClassifiedError> {
    const classified = await this.classify(error);

    await supabase.from('error_logs').insert({
      component,
      severity: this.mapSeverity(classified.classification.severity),
      message: error.message,
      stack_trace: error.stack,
      context: {
        ...context,
        error_type: classified.classification.error_type,
        is_transient: classified.isTransient,
        retry_allowed: classified.shouldRetry,
      },
    });

    return classified;
  }

  /**
   * Map numeric severity to string
   */
  private mapSeverity(severity: number): 'debug' | 'info' | 'warning' | 'error' | 'critical' {
    if (severity >= 5) return 'critical';
    if (severity >= 4) return 'error';
    if (severity >= 3) return 'warning';
    if (severity >= 2) return 'info';
    return 'debug';
  }
}

export const errorClassificationService = new ErrorClassificationService();
