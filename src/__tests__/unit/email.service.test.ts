import * as emailService from '../../services/email.service';

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  }),
}));

jest.mock('../../config', () => ({
  config: {
    email: {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      user: 'test@test.com',
      password: 'password',
      from: 'noreply@test.com',
      fromName: 'Test App',
    },
  },
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('Email Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyEmailConfig', () => {
    it('should return true when email config is valid', async () => {
      const result = await emailService.verifyEmailConfig();

      expect(result).toBe(true);
    });
  });

  describe('sendTaskAssignmentEmail', () => {
    it('should send task assignment email successfully', async () => {
      const taskData = {
        taskId: 'task-123',
        taskTitle: 'Test Task',
        taskDescription: 'Test Description',
        projectId: 'project-123',
        assignedBy: 'user-1',
      };

      await expect(
        emailService.sendTaskAssignmentEmail('user@example.com', taskData),
      ).resolves.not.toThrow();
    });

    it('should handle minimal task data', async () => {
      const taskData = {
        taskId: 'task-123',
        taskTitle: 'Test Task',
      };

      await expect(
        emailService.sendTaskAssignmentEmail('user@example.com', taskData),
      ).resolves.not.toThrow();
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      await expect(
        emailService.sendTestEmail('user@example.com', 'Test Subject', 'Test Message'),
      ).resolves.not.toThrow();
    });
  });
});
