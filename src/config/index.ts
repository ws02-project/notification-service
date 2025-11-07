import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  serviceName: process.env.SERVICE_NAME || 'notification-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin123@rabbitmq:5672',
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@example.com',
    fromName: process.env.EMAIL_FROM_NAME || 'Task Management System',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
};

export const isProduction = config.env === 'production';
export const isDevelopment = config.env === 'development';

export default config;
