import request from 'supertest';
import app from '../app';
import * as emailService from '../services/email.service';

// Mock the email service
jest.mock('../services/email.service', () => ({
  sendTestEmail: jest.fn().mockResolvedValue(undefined),
  verifyEmailConfig: jest.fn().mockResolvedValue(true),
  sendTaskAssignmentEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('Notification API Endpoints', () => {
  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('service', 'notification-service');
    });
  });

  describe('POST /api/v1/test-email', () => {
    it('should send a test email', async () => {
      const emailData = {
        to: 'test@example.com',
        subject: 'Test Email',
        message: 'This is a test email',
      };

      const res = await request(app).post('/api/v1/test-email').send(emailData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('sent successfully');
      expect(emailService.sendTestEmail).toHaveBeenCalledWith(
        emailData.to,
        emailData.subject,
        emailData.message,
      );
    });

    it('should fail with invalid email data', async () => {
      const res = await request(app).post('/api/v1/test-email').send({});

      expect(res.status).toBe(400);
    });

    it('should fail with invalid email address', async () => {
      const res = await request(app)
        .post('/api/v1/test-email')
        .send({ to: 'invalid-email', subject: 'Test', message: 'Test' });

      expect(res.status).toBe(400);
    });
  });
});
