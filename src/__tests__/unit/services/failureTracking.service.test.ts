import {
  failureTracker,
  getFailureMetrics,
  resetFailureTracking,
} from '../../../services/failureTracking.service';

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Failure Tracking Service', () => {
  beforeEach(() => {
    resetFailureTracking();
    jest.clearAllMocks();
  });

  describe('recordFailure', () => {
    it('should record a new failure', () => {
      failureTracker.recordFailure(
        'event-123',
        'task-123',
        'user@example.com',
        new Error('SMTP error'),
        true,
      );

      const failure = failureTracker.getFailure('task-123', 'user@example.com');

      expect(failure).toBeDefined();
      expect(failure!.attemptCount).toBe(1);
      expect(failure!.lastError).toBe('SMTP error');
      expect(failure!.isRetryable).toBe(true);
    });

    it('should increment attempt count for existing failure', () => {
      failureTracker.recordFailure(
        'event-123',
        'task-123',
        'user@example.com',
        new Error('First error'),
        true,
      );

      failureTracker.recordFailure(
        'event-456',
        'task-123',
        'user@example.com',
        new Error('Second error'),
        true,
      );

      const failure = failureTracker.getFailure('task-123', 'user@example.com');

      expect(failure!.attemptCount).toBe(2);
      expect(failure!.lastError).toBe('Second error');
    });

    it('should store metadata', () => {
      failureTracker.recordFailure(
        'event-123',
        'task-123',
        'user@example.com',
        new Error('Error'),
        true,
        { source: 'test' },
      );

      const failure = failureTracker.getFailure('task-123', 'user@example.com');

      expect(failure!.metadata).toEqual({ source: 'test' });
    });
  });

  describe('getFailure', () => {
    it('should return undefined for non-existent failure', () => {
      const failure = failureTracker.getFailure('nonexistent', 'nobody@example.com');

      expect(failure).toBeUndefined();
    });
  });

  describe('markResolved', () => {
    it('should remove failure record', () => {
      failureTracker.recordFailure(
        'event-123',
        'task-123',
        'user@example.com',
        new Error('Error'),
        true,
      );

      failureTracker.markResolved('task-123', 'user@example.com');

      const failure = failureTracker.getFailure('task-123', 'user@example.com');
      expect(failure).toBeUndefined();
    });
  });

  describe('getRecipientFailures', () => {
    it('should return all failures for a recipient', () => {
      failureTracker.recordFailure(
        'event-1',
        'task-1',
        'user@example.com',
        new Error('Error 1'),
        true,
      );

      failureTracker.recordFailure(
        'event-2',
        'task-2',
        'user@example.com',
        new Error('Error 2'),
        true,
      );

      failureTracker.recordFailure(
        'event-3',
        'task-3',
        'other@example.com',
        new Error('Error 3'),
        true,
      );

      const failures = failureTracker.getRecipientFailures('user@example.com');

      expect(failures.length).toBe(2);
    });
  });

  describe('shouldBlockRecipient', () => {
    it('should return false when below threshold', () => {
      failureTracker.recordFailure(
        'event-1',
        'task-1',
        'user@example.com',
        new Error('Error'),
        false, // permanent failure
      );

      expect(failureTracker.shouldBlockRecipient('user@example.com')).toBe(false);
    });

    it('should return true when at or above threshold', () => {
      for (let i = 0; i < 5; i++) {
        failureTracker.recordFailure(
          `event-${i}`,
          `task-${i}`,
          'user@example.com',
          new Error('Permanent error'),
          false, // permanent failure
        );
      }

      expect(failureTracker.shouldBlockRecipient('user@example.com')).toBe(true);
    });

    it('should not count retryable failures toward block threshold', () => {
      for (let i = 0; i < 10; i++) {
        failureTracker.recordFailure(
          `event-${i}`,
          `task-${i}`,
          'user@example.com',
          new Error('Retryable error'),
          true, // retryable
        );
      }

      expect(failureTracker.shouldBlockRecipient('user@example.com')).toBe(false);
    });
  });

  describe('getStats / getFailureMetrics', () => {
    it('should return correct statistics', () => {
      failureTracker.recordFailure(
        'event-1',
        'task-1',
        'user1@example.com',
        new Error('Error 1'),
        true,
      );

      failureTracker.recordFailure(
        'event-2',
        'task-2',
        'user2@example.com',
        new Error('Error 2'),
        false,
      );

      const stats = getFailureMetrics();

      expect(stats.totalFailures).toBe(2);
      expect(stats.retryableFailures).toBe(1);
      expect(stats.permanentFailures).toBe(1);
      expect(stats.averageAttemptsPerFailure).toBe(1);
    });

    it('should return empty stats when no failures', () => {
      const stats = getFailureMetrics();

      expect(stats.totalFailures).toBe(0);
      expect(stats.averageAttemptsPerFailure).toBe(0);
    });
  });

  describe('resetFailureTracking', () => {
    it('should clear all failures', () => {
      failureTracker.recordFailure(
        'event-1',
        'task-1',
        'user@example.com',
        new Error('Error'),
        true,
      );

      resetFailureTracking();

      const stats = getFailureMetrics();
      expect(stats.totalFailures).toBe(0);
    });
  });
});
