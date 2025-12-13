import { Request, Response, RequestHandler } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync';
import { sendTestEmail as sendTestEmailService } from '../services/email.service';

/**
 * Health check endpoint
 */
export const healthCheck: RequestHandler = catchAsync(async (_req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    status: 'ok',
    service: 'notification-service',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Send test email endpoint
 */
export const sendTestEmail: RequestHandler = catchAsync(async (req: Request, res: Response) => {
  const { to, subject, message } = req.body;

  await sendTestEmailService(to, subject || 'Test Email', message || 'This is a test email');

  res.status(httpStatus.OK).json({
    success: true,
    message: 'Test email sent successfully',
    data: {
      to,
      subject: subject || 'Test Email',
    },
  });
});
