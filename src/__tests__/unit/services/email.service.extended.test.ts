// Mock dependencies BEFORE importing the module
jest.mock('../../../config', () => ({
  config: {
    email: {
      host: 'smtp.test.com',
      port: 587,
      secure: false,
      user: 'test@example.com',
      password: 'password',
      from: 'noreply@example.com',
      fromName: 'Test System',
    },
    env: 'test',
  },
}));

const mockSendMail = jest.fn();
const mockVerify = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
    verify: mockVerify,
  })),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Now import the module
import * as emailService from '../../../services/email.service';

describe('Email Service - Extended Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail.mockReset();
    mockVerify.mockReset();
  });

  describe('verifyEmailConfig', () => {
    it('should return true when transporter verifies successfully', async () => {
      mockVerify.mockResolvedValue(true);

      const result = await emailService.verifyEmailConfig();

      expect(result).toBe(true);
    });

    it('should return false when transporter verification fails', async () => {
      mockVerify.mockRejectedValue(new Error('Connection failed'));

      const result = await emailService.verifyEmailConfig();

      expect(result).toBe(false);
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-123' });

      await emailService.sendTestEmail('test@example.com', 'Test Subject', 'Test Message');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Subject',
        }),
      );
    });

    it('should throw error when sending fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        emailService.sendTestEmail('test@example.com', 'Subject', 'Message'),
      ).rejects.toThrow('SMTP error');
    });
  });

  describe('sendTaskAssignmentEmail', () => {
    it('should send task assignment email with all details', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-456' });

      await emailService.sendTaskAssignmentEmail('user@example.com', {
        taskId: 'task-123',
        taskTitle: 'Complete Feature X',
        taskDescription: 'Implement the new feature',
        projectId: 'project-456',
        assignedBy: 'manager@example.com',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Complete Feature X'),
        }),
      );
    });

    it('should send email without optional fields', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-789' });

      await emailService.sendTaskAssignmentEmail('user@example.com', {
        taskId: 'task-123',
        taskTitle: 'Simple Task',
      });

      expect(mockSendMail).toHaveBeenCalled();
    });

    it('should throw error when sending fails', async () => {
      mockSendMail.mockRejectedValue(new Error('Connection refused'));

      await expect(
        emailService.sendTaskAssignmentEmail('user@example.com', {
          taskId: 'task-123',
          taskTitle: 'Task',
        }),
      ).rejects.toThrow('Connection refused');
    });
  });
});
