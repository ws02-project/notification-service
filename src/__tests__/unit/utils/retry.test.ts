import { retry, isRetryableError } from '../../../utils/retry';

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Retry Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retry(fn, { maxAttempts: 3, initialDelayMs: 10 });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const result = await retry(fn, { maxAttempts: 5, initialDelayMs: 10, maxDelayMs: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should return failure after max attempts exceeded', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Always fails'));

      const result = await retry(fn, { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 20 });

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Always fails');
      expect(result.attempts).toBe(3);
    });

    it('should use default options when not provided', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retry(fn);

      expect(result.success).toBe(true);
    });

    it('should call onRetry callback on each retry', async () => {
      const fn = jest.fn().mockRejectedValueOnce(new Error('Failure')).mockResolvedValue('success');
      const onRetry = jest.fn();

      await retry(fn, { maxAttempts: 3, initialDelayMs: 10, onRetry });

      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should stop retrying when shouldRetry returns false', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Non-retryable'));
      const shouldRetry = jest.fn().mockReturnValue(false);

      const result = await retry(fn, { maxAttempts: 5, initialDelayMs: 10, shouldRetry });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      expect(isRetryableError(new Error('ECONNREFUSED'))).toBe(true);
      expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
      expect(isRetryableError(new Error('socket hang up'))).toBe(true);
    });

    it('should return true for timeout errors', () => {
      expect(isRetryableError(new Error('Operation timeout'))).toBe(true);
    });

    it('should return true for service unavailable errors', () => {
      expect(isRetryableError(new Error('503 Service Unavailable'))).toBe(true);
      expect(isRetryableError(new Error('Service temporarily unavailable'))).toBe(true);
    });

    it('should return false for auth errors', () => {
      expect(isRetryableError(new Error('Unauthorized'))).toBe(false);
      expect(isRetryableError(new Error('Forbidden'))).toBe(false);
    });

    it('should return false for validation errors', () => {
      expect(isRetryableError(new Error('Invalid input'))).toBe(false);
      expect(isRetryableError(new Error('Bad request'))).toBe(false);
    });

    it('should return false for unknown errors', () => {
      expect(isRetryableError(new Error('Some random error'))).toBe(false);
    });
  });
});
