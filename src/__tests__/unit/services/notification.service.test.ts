// Must mock logger first as it's used by notification.service
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock the email service
const mockSendTaskAssignmentEmail = jest.fn();
jest.mock('../../../services/email.service', () => ({
  sendTaskAssignmentEmail: mockSendTaskAssignmentEmail,
  sendTestEmail: jest.fn(),
}));

import { handleTaskAssigned } from '../../../services/notification.service';
import { EventMetadata } from '../../../messaging/EventBus';

describe('Notification Service', () => {
  const mockMetadata: EventMetadata = {
    eventId: 'event-123',
    eventType: 'task.assigned',
    timestamp: Date.now(),
    sourceService: 'task-service',
    correlationId: 'corr-123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleTaskAssigned', () => {
    it('should send email when task is assigned', async () => {
      const event = {
        taskId: 'task-123',
        assignedTo: 'user@example.com',
        projectId: 'project-123',
        assignedBy: 'manager@example.com',
        title: 'Test Task',
        description: 'Test Description',
      };

      mockSendTaskAssignmentEmail.mockResolvedValue(undefined);

      await handleTaskAssigned(event, mockMetadata);

      expect(mockSendTaskAssignmentEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          taskId: 'task-123',
          taskTitle: 'Test Task',
          taskDescription: 'Test Description',
          projectId: 'project-123',
          assignedBy: 'manager@example.com',
        }),
      );
    });

    it('should skip notification when no assignedTo email', async () => {
      const logger = require('../../../utils/logger');
      const event = {
        taskId: 'task-123',
        assignedTo: '',
      };

      await handleTaskAssigned(event, mockMetadata);

      expect(mockSendTaskAssignmentEmail).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Notification skipped - No email', expect.any(Object));
    });

    it('should use default task title when not provided', async () => {
      const event = {
        taskId: 'task-123',
        assignedTo: 'user@example.com',
      };

      mockSendTaskAssignmentEmail.mockResolvedValue(undefined);

      await handleTaskAssigned(event, mockMetadata);

      expect(mockSendTaskAssignmentEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          taskTitle: 'Untitled Task',
        }),
      );
    });

    it('should log and throw error when email sending fails', async () => {
      const logger = require('../../../utils/logger');
      const event = {
        taskId: 'task-123',
        assignedTo: 'user@example.com',
      };

      mockSendTaskAssignmentEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(handleTaskAssigned(event, mockMetadata)).rejects.toThrow('SMTP error');
      expect(logger.error).toHaveBeenCalledWith('Notification failed', expect.any(Object));
    });

    it('should log event reception info', async () => {
      const logger = require('../../../utils/logger');
      const event = {
        taskId: 'task-123',
        assignedTo: 'user@example.com',
        projectId: 'project-456',
      };

      mockSendTaskAssignmentEmail.mockResolvedValue(undefined);

      await handleTaskAssigned(event, mockMetadata);

      expect(logger.info).toHaveBeenCalledWith(
        'Event received - task.assigned',
        expect.objectContaining({
          type: 'event_received',
          eventType: 'task.assigned',
          taskId: 'task-123',
        }),
      );
    });

    it('should handle taskDescription being undefined', async () => {
      const event = {
        taskId: 'task-123',
        assignedTo: 'user@example.com',
        title: 'Task Without Description',
      };

      mockSendTaskAssignmentEmail.mockResolvedValue(undefined);

      await handleTaskAssigned(event, mockMetadata);

      expect(mockSendTaskAssignmentEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.objectContaining({
          taskDescription: undefined,
        }),
      );
    });
  });
});
