import request from 'supertest';
import express from 'express';
import httpStatus from 'http-status';

// Create a mock app for testing
const createMockApp = () => {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Send test email
  app.post('/api/v1/notifications/test-email', (req, res) => {
    const { to, subject } = req.body;

    if (!to) {
      res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Recipient email is required',
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      res.status(httpStatus.BAD_REQUEST).json({
        success: false,
        message: 'Invalid email format',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        to,
        subject: subject || 'Test Email',
      },
    });
  });

  // Notification preferences
  app.get('/api/v1/notifications/preferences/:userId', (req, res) => {
    res.json({
      success: true,
      data: {
        userId: req.params.userId,
        email: true,
        push: true,
        slack: false,
      },
    });
  });

  app.patch('/api/v1/notifications/preferences/:userId', (req, res) => {
    res.json({
      success: true,
      data: {
        userId: req.params.userId,
        ...req.body,
      },
    });
  });

  return app;
};

describe('Notification API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createMockApp();
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('notification-service');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/v1/notifications/test-email', () => {
    it('should send test email successfully', async () => {
      const res = await request(app).post('/api/v1/notifications/test-email').send({
        to: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test Message',
      });

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.to).toBe('test@example.com');
    });

    it('should return 400 when recipient is missing', async () => {
      const res = await request(app).post('/api/v1/notifications/test-email').send({
        subject: 'Test Subject',
      });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for invalid email format', async () => {
      const res = await request(app).post('/api/v1/notifications/test-email').send({
        to: 'invalid-email',
      });

      expect(res.status).toBe(httpStatus.BAD_REQUEST);
      expect(res.body.success).toBe(false);
    });

    it('should use default subject when not provided', async () => {
      const res = await request(app).post('/api/v1/notifications/test-email').send({
        to: 'test@example.com',
      });

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.data.subject).toBe('Test Email');
    });
  });

  describe('GET /api/v1/notifications/preferences/:userId', () => {
    it('should return user notification preferences', async () => {
      const res = await request(app).get('/api/v1/notifications/preferences/user-123');

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe('user-123');
      expect(res.body.data).toHaveProperty('email');
      expect(res.body.data).toHaveProperty('push');
      expect(res.body.data).toHaveProperty('slack');
    });
  });

  describe('PATCH /api/v1/notifications/preferences/:userId', () => {
    it('should update user notification preferences', async () => {
      const updateData = {
        email: false,
        push: true,
        slack: true,
      };

      const res = await request(app)
        .patch('/api/v1/notifications/preferences/user-123')
        .send(updateData);

      expect(res.status).toBe(httpStatus.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(false);
      expect(res.body.data.slack).toBe(true);
    });
  });
});
