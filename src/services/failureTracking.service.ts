/**
 * Failure Tracking Service
 *
 * Tracks failed notification delivery attempts and manages retry workflows.
 * - Monitors consecutive failures per recipient
 * - Tracks failure patterns and metrics
 * - Coordinates with Dead Letter Queues (DLQ) for permanent failures
 */

import logger from '../utils/logger';

/**
 * Failure record for tracking notification delivery attempts
 */
export interface FailureRecord {
  eventId: string;
  taskId: string;
  recipientEmail: string;
  attemptCount: number;
  lastError: string;
  firstFailureTime: number;
  lastFailureTime: number;
  isRetryable: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Failure tracking statistics
 */
export interface FailureStats {
  totalFailures: number;
  retryableFailures: number;
  permanentFailures: number;
  averageAttemptsPerFailure: number;
  recentFailures: FailureRecord[];
}

/**
 * In-memory failure tracking (can be extended to use persistent storage like Redis)
 */
class FailureTracker {
  private failures: Map<string, FailureRecord> = new Map();
  private readonly maxTrackedFailures: number = 1000;
  private readonly failureRetentionMs: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Record a failed notification delivery
   */
  recordFailure(
    eventId: string,
    taskId: string,
    recipientEmail: string,
    error: Error,
    isRetryable: boolean,
    metadata?: Record<string, unknown>,
  ): void {
    const key = `${taskId}:${recipientEmail}`;
    const now = Date.now();

    let record = this.failures.get(key);

    if (record) {
      // Update existing failure record
      record.attemptCount++;
      record.lastError = error.message;
      record.lastFailureTime = now;
    } else {
      // Create new failure record
      record = {
        eventId,
        taskId,
        recipientEmail,
        attemptCount: 1,
        lastError: error.message,
        firstFailureTime: now,
        lastFailureTime: now,
        isRetryable,
        metadata,
      };
    }

    this.failures.set(key, record);

    logger.warn('📋 Failure recorded', {
      taskId,
      recipientEmail,
      attemptCount: record.attemptCount,
      isRetryable,
      error: error.message,
    });

    // Cleanup old records periodically
    if (this.failures.size > this.maxTrackedFailures) {
      this.cleanupOldFailures();
    }
  }

  /**
   * Get failure record for a specific task-recipient combination
   */
  getFailure(taskId: string, recipientEmail: string): FailureRecord | undefined {
    const key = `${taskId}:${recipientEmail}`;
    return this.failures.get(key);
  }

  /**
   * Mark a failure as resolved (successful retry)
   */
  markResolved(taskId: string, recipientEmail: string): void {
    const key = `${taskId}:${recipientEmail}`;
    this.failures.delete(key);

    logger.info('✅ Failure resolved', {
      taskId,
      recipientEmail,
    });
  }

  /**
   * Get all failures for a recipient (to check if they should be on blocklist)
   */
  getRecipientFailures(recipientEmail: string): FailureRecord[] {
    return Array.from(this.failures.values()).filter((f) => f.recipientEmail === recipientEmail);
  }

  /**
   * Check if a recipient should be temporarily blocked due to high failure rate
   */
  shouldBlockRecipient(recipientEmail: string, threshold: number = 5): boolean {
    const failures = this.getRecipientFailures(recipientEmail);
    const permanentFailures = failures.filter((f) => !f.isRetryable).length;

    if (permanentFailures >= threshold) {
      logger.warn('⛔ Recipient blocked due to high permanent failure rate', {
        recipientEmail,
        permanentFailures,
        threshold,
      });
      return true;
    }

    return false;
  }

  /**
   * Get failure statistics
   */
  getStats(): FailureStats {
    const failures = Array.from(this.failures.values());

    return {
      totalFailures: failures.length,
      retryableFailures: failures.filter((f) => f.isRetryable).length,
      permanentFailures: failures.filter((f) => !f.isRetryable).length,
      averageAttemptsPerFailure:
        failures.length > 0
          ? failures.reduce((sum, f) => sum + f.attemptCount, 0) / failures.length
          : 0,
      recentFailures: failures.sort((a, b) => b.lastFailureTime - a.lastFailureTime).slice(0, 10),
    };
  }

  /**
   * Remove old failures to prevent memory growth
   */
  private cleanupOldFailures(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, record] of this.failures.entries()) {
      if (now - record.lastFailureTime > this.failureRetentionMs) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.failures.delete(key));

    if (expiredKeys.length > 0) {
      logger.info('🧹 Cleaned up old failure records', {
        count: expiredKeys.length,
      });
    }
  }

  /**
   * Clear all tracked failures
   */
  clear(): void {
    this.failures.clear();
    logger.info('🗑️ All failure records cleared');
  }
}

// Export singleton instance
export const failureTracker = new FailureTracker();

/**
 * Get failure information for monitoring/analytics
 */
export function getFailureMetrics(): FailureStats {
  return failureTracker.getStats();
}

/**
 * Reset failure tracking (useful for testing and operations)
 */
export function resetFailureTracking(): void {
  failureTracker.clear();
}
