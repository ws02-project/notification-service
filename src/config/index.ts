import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  environment: process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  apiVersion: process.env.API_VERSION || 'v1',
  serviceName: process.env.SERVICE_NAME || 'notification-service',
  logLevel: process.env.LOG_LEVEL || 'info',
  rabbitmq: {
    host: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT || '5672', 10),
    user: process.env.RABBITMQ_USER || 'admin',
    password: process.env.RABBITMQ_PASSWORD || 'admin123',
    get url(): string {
      // URL-encode credentials to handle special characters like @
      const encodedUser = encodeURIComponent(this.user);
      const encodedPassword = encodeURIComponent(this.password);
      return `amqp://${encodedUser}:${encodedPassword}@${this.host}:${this.port}`;
    },
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
  grpc: {
    userServiceUrl: process.env.USER_SERVICE_GRPC_URL || 'user-service:50053',
  },
};

export const isProduction = config.env === 'production';
export const isDevelopment = config.env === 'development';

export default config;
