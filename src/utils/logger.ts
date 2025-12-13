import winston from 'winston';
import { config } from '../config';

// JSON format for production (Fluent Bit compatible)
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Human-readable format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${service}] ${level}: ${message}${metaStr}`;
  }),
);

const logger = winston.createLogger({
  level: config.logLevel,
  format: jsonFormat,
  defaultMeta: {
    service: config.serviceName,
    version: process.env.APP_VERSION || '1.0.0',
    environment: config.environment,
  },
  transports: [
    new winston.transports.Console({
      format: config.env === 'production' ? jsonFormat : devFormat,
    }),
  ],
});

// Create child logger with additional context
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

export default logger;
