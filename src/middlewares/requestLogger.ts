import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

/**
 * Request logging middleware
 * Logs HTTP requests and responses with correlation IDs for tracing
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const traceId = (req.headers['x-trace-id'] as string) || uuidv4();
  const startTime = Date.now();

  // Attach IDs to request for downstream use
  req.requestId = requestId;
  req.traceId = traceId;

  // Set response headers for client correlation
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-trace-id', traceId);

  // Log incoming request
  logger.info('HTTP Request', {
    type: 'http_request',
    requestId,
    traceId,
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.socket.remoteAddress,
    contentLength: req.headers['content-length'],
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    logger[logLevel]('HTTP Response', {
      type: 'http_response',
      requestId,
      traceId,
      method: req.method,
      path: req.path,
      url: req.originalUrl,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration,
      contentLength: res.getHeader('content-length'),
    });

    // Log slow requests separately
    if (duration > 1000) {
      logger.warn('Slow Request Detected', {
        type: 'slow_request',
        requestId,
        traceId,
        method: req.method,
        path: req.path,
        duration,
        threshold: 1000,
      });
    }
  });

  next();
};

/**
 * Error logging middleware
 * Should be placed after all routes but before error handler
 */
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled Error', {
    type: 'unhandled_error',
    requestId: req.requestId,
    traceId: req.traceId,
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  next(err);
};
