import 'reflect-metadata';
import { Server } from 'http';
import app from './app';
import { config } from './config';
import logger from './utils/logger';
import { initializeMessaging, closeMessaging } from './messaging';
import { verifyEmailConfig } from './services/email.service';

let server: Server | undefined;

const startServer = async () => {
  try {
    // Verify email configuration
    const emailConfigValid = await verifyEmailConfig();
    if (!emailConfigValid) {
      logger.warn('⚠️ Email configuration is invalid. Email notifications may not work.');
    }

    // Initialize EventBus messaging system
    await initializeMessaging();
    logger.info('✅ EventBus messaging initialized successfully');

    // Start HTTP server
    server = app.listen(config.port, () => {
      logger.info(`🚀 ${config.serviceName} is running on port ${config.port}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔗 API: http://localhost:${config.port}/api/${config.apiVersion}`);
      logger.info(`🐰 RabbitMQ: Connected`);
      logger.info(`📧 Email: ${emailConfigValid ? 'Configured' : 'Not configured'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const exitHandler = async () => {
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      await closeMessaging();
      process.exit(1);
    });
  } else {
    await closeMessaging();
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error: Error) => {
  logger.error('Unexpected error:', error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close(async () => {
      await closeMessaging();
    });
  }
});

startServer();
