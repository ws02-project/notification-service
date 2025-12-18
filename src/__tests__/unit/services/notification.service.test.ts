import logger from '../../../utils/logger';

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

// Mock the gRPC user client
const mockGetUserEmail = jest.fn();
jest.mock('../../../grpc/user.grpc.client', () => ({
  getUserEmail: mockGetUserEmail,
}));

import { handleTaskAssigned } from '../../../services/notification.service';
import { EventMetadata } from '../../../messaging/EventBus';

const mockedLogger = jest.mocked(logger);

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
        assignedTo: 'user-uuid-123',
        projectId: 'project-123',
        assignedBy: 'manager@example.com',
        title: 'Test Task',
        description: 'Test Description',
      };

      // Mock gRPC to return user email
      mockGetUserEmail.mockResolvedValue('user@example.com');
      mockSendTaskAssignmentEmail.mockResolvedValue(undefined);

      await handleTaskAssigned(event, mockMetadata);

      expect(mockGetUserEmail).toHaveBeenCalledWith('user-uuid-123');
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

    it('should skip notification when no assignedTo provided', async () => {
      const event = {
        taskId: 'task-123',
        assignedTo: '',
      };

      await handleTaskAssigned(event, mockMetadata);

      expect(mockGetUserEmail).not.toHaveBeenCalled();
      expect(mockSendTaskAssignmentEmail).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Notification skipped - No assignee',
        expect.any(Object),
      );
    });

    it('should skip notification when user email not found', async () => {
      const event = {
        taskId: 'task-123',
        assignedTo: 'user-uuid-123',
      };

      // Mock gRPC to return null (user not found)
      mockGetUserEmail.mockResolvedValue(null);

      await handleTaskAssigned(event, mockMetadata);

      expect(mockGetUserEmail).toHaveBeenCalledWith('user-uuid-123');
      expect(mockSendTaskAssignmentEmail).not.toHaveBeenCalled();
      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Notification skipped - No email found for user',
        expect.any(Object),
      );
    });

    it('should use default task title when not provided', async () => {
      const event = {
        taskId: 'task-123',
        assignedTo: 'user-uuid-123',
      };

      mockGetUserEmail.mockResolvedValue('user@example.com');
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
      const event = {
        taskId: 'task-123',
        assignedTo: 'user-uuid-123',
      };

      mockGetUserEmail.mockResolvedValue('user@example.com');
      mockSendTaskAssignmentEmail.mockRejectedValue(new Error('SMTP error'));

      await expect(handleTaskAssigned(event, mockMetadata)).rejects.toThrow('SMTP error');
      expect(mockedLogger.error).toHaveBeenCalledWith('Notification failed', expect.any(Object));
    });

    it('should log event reception info', async () => {
      const event = {
        taskId: 'task-123',
        assignedTo: 'user-uuid-123',
        projectId: 'project-456',
      };

      mockGetUserEmail.mockResolvedValue('user@example.com');
      mockSendTaskAssignmentEmail.mockResolvedValue(undefined);

      await handleTaskAssigned(event, mockMetadata);

      expect(mockedLogger.info).toHaveBeenCalledWith(
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
        assignedTo: 'user-uuid-123',
        title: 'Task Without Description',
      };

      mockGetUserEmail.mockResolvedValue('user@example.com');
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
