import logger from './logger';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  jitterFactor: number;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  shouldRetry?: (error: Error, attempt: number) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalDurationMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  jitterFactor: 0.1,
};

/**
 * Calculate exponential backoff delay with jitter
 * Prevents thundering herd problem by adding randomness to retry delays
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number,
  jitterFactor: number,
): number {
  // Exponential backoff: delay = initialDelay * (backoffFactor ^ attempt)
  let delay = initialDelayMs * Math.pow(backoffFactor, attempt);

  // Cap at maxDelay
  delay = Math.min(delay, maxDelayMs);

  // Add jitter: random value between 0 and jitterFactor * delay
  const jitter = Math.random() * jitterFactor * delay;
  return Math.floor(delay + jitter);
}

/**
 * Sleep for specified milliseconds
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry a function with exponential backoff strategy
 *
 * @param fn - Async function to retry
 * @param options - Retry configuration options
 * @returns Promise with retry result including success status, data, error, and attempt count
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => sendEmail(address),
 *   {
 *     maxAttempts: 5,
 *     initialDelayMs: 1000,
 *     maxDelayMs: 60000,
 *     backoffFactor: 2,
 *     onRetry: (attempt, error, nextDelay) => {
 *       logger.warn(`Retry attempt ${attempt}, waiting ${nextDelay}ms`);
 *     },
 *   }
 * );
 *
 * if (result.success) {
 *   logger.info('Operation succeeded', { attempts: result.attempts });
 * } else {
 *   logger.error('Operation failed after retries', { error: result.error });
 * }
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<RetryResult<T>> {
  const config: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      const data = await fn();
      const totalDurationMs = Date.now() - startTime;

      if (attempt > 0) {
        logger.info('Retry succeeded', {
          type: 'retry_success',
          attempts: attempt + 1,
          totalDurationMs,
        });
      }

      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalDurationMs,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if we should retry this error
      if (config.shouldRetry && !config.shouldRetry(lastError, attempt + 1)) {
        logger.warn('Non-retryable error', {
          type: 'retry_non_retryable',
          error: lastError.message,
          attempt: attempt + 1,
        });
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
        };
      }

      // Check if this is the last attempt
      if (attempt === config.maxAttempts - 1) {
        const totalDurationMs = Date.now() - startTime;
        logger.error('Retry exhausted', {
          type: 'retry_exhausted',
          attempts: attempt + 1,
          maxAttempts: config.maxAttempts,
          totalDurationMs,
          error: lastError.message,
        });

        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDurationMs,
        };
      }

      // Calculate backoff delay
      const nextDelayMs = calculateBackoffDelay(
        attempt,
        config.initialDelayMs,
        config.maxDelayMs,
        config.backoffFactor,
        config.jitterFactor,
      );

      if (config.onRetry) {
        config.onRetry(attempt + 1, lastError, nextDelayMs);
      }

      logger.warn('Retry attempt', {
        type: 'retry_attempt',
        attempt: attempt + 1,
        maxAttempts: config.maxAttempts,
        nextDelayMs,
        error: lastError.message,
      });

      await sleep(nextDelayMs);
    }
  }

  // Should not reach here, but return error as fallback
  const totalDurationMs = Date.now() - startTime;
  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts: config.maxAttempts,
    totalDurationMs,
  };
}

/**
 * Determine if an error is retryable based on common patterns
 *
 * @param error - The error to check
 * @returns True if the error is likely transient and retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  // Network errors (transient)
  if (
    message.includes('econnrefused') ||
    message.includes('etimedout') ||
    message.includes('ehostunreach') ||
    message.includes('enetunreach') ||
    message.includes('socket hang up') ||
    message.includes('connection reset')
  ) {
    return true;
  }

  // SMTP timeout errors (transient)
  if (message.includes('timeout') || message.includes('deadlocked')) {
    return true;
  }

  // Service unavailable (transient)
  if (
    message.includes('503') ||
    message.includes('service unavailable') ||
    message.includes('temporarily unavailable')
  ) {
    return true;
  }

  // RabbitMQ connection errors (transient)
  if (name.includes('amqp') || message.includes('rabbitmq') || message.includes('broker')) {
    return true;
  }

  // Auth errors are NOT retryable
  if (
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('auth')
  ) {
    return false;
  }

  // Validation errors are NOT retryable
  if (message.includes('invalid') || message.includes('bad request')) {
    return false;
  }

  return false; // Default: don't retry unknown errors
}
