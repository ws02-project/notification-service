import { Request, Response } from 'express';
import httpStatus from 'http-status';
import * as notificationController from '../../../controllers/notification.controller';
import * as emailService from '../../../services/email.service';

// Mock the service layer
jest.mock('../../../services/email.service');

const mockedEmailService = emailService as jest.Mocked<typeof emailService>;

describe('Notification Controller', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
      query: {},
      params: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('healthCheck', () => {
    it('should return ok status', async () => {
      await notificationController.healthCheck(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          service: 'notification-service',
        }),
      );
    });
  });

  describe('sendTestEmail', () => {
    it('should send test email with provided subject and message', async () => {
      mockReq.body = {
        to: 'test@example.com',
        subject: 'Custom Subject',
        message: 'Custom Message',
      };
      mockedEmailService.sendTestEmail.mockResolvedValue(undefined);

      await notificationController.sendTestEmail(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedEmailService.sendTestEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Custom Subject',
        'Custom Message',
      );
      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Test email sent successfully',
        data: {
          to: 'test@example.com',
          subject: 'Custom Subject',
        },
      });
    });

    it('should use default subject and message when not provided', async () => {
      mockReq.body = {
        to: 'test@example.com',
      };
      mockedEmailService.sendTestEmail.mockResolvedValue(undefined);

      await notificationController.sendTestEmail(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedEmailService.sendTestEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test Email',
        'This is a test email',
      );
    });
  });
});
