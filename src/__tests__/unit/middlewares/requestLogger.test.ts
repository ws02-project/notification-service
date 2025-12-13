import { Request, Response, NextFunction } from 'express';
import { requestLogger, errorLogger } from '../../../middlewares/requestLogger';

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-1234'),
}));

describe('Request Logger Middleware', () => {
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const createMockReq = (path: string = '/api/v1/tasks'): Partial<Request> => ({
    method: 'GET',
    path,
    originalUrl: path,
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('100'),
    headers: {},
    query: {},
    socket: { remoteAddress: '127.0.0.1' } as never,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRes = {
      statusCode: 200,
      statusMessage: 'OK',
      get: jest.fn().mockReturnValue('50'),
      on: jest.fn(),
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe('requestLogger', () => {
    it('should skip logging for health check endpoints', () => {
      const healthPaths = ['/health', '/api/v1/health', '/healthz', '/ready', '/live'];

      healthPaths.forEach((path) => {
        const req = createMockReq(path);
        requestLogger(req as Request, mockRes as Response, mockNext);
      });

      // next should be called for each path
      expect(mockNext).toHaveBeenCalledTimes(healthPaths.length);
    });

    it('should add requestId to request object', () => {
      const req = createMockReq('/api/v1/tasks');

      requestLogger(req as Request, mockRes as Response, mockNext);

      expect((req as Request & { requestId: string }).requestId).toBeDefined();
    });

    it('should add traceId to request object', () => {
      const req = createMockReq('/api/v1/tasks');

      requestLogger(req as Request, mockRes as Response, mockNext);

      expect((req as Request & { traceId: string }).traceId).toBeDefined();
    });

    it('should call next()', () => {
      const req = createMockReq('/api/v1/tasks');

      requestLogger(req as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event listener on response', () => {
      const req = createMockReq('/api/v1/tasks');

      requestLogger(req as Request, mockRes as Response, mockNext);

      expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });
  });

  describe('errorLogger', () => {
    it('should log error details', () => {
      const error = new Error('Test error');
      const logger = require('../../../utils/logger');
      const req = createMockReq('/api/v1/tasks');

      (req as Request & { requestId: string; traceId: string }).requestId = 'req-123';
      (req as Request & { requestId: string; traceId: string }).traceId = 'trace-123';

      errorLogger(error, req as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled Error',
        expect.objectContaining({
          type: 'unhandled_error',
          error: 'Test error',
        }),
      );
    });

    it('should call next with the error', () => {
      const error = new Error('Test error');
      const req = createMockReq('/api/v1/tasks');

      errorLogger(error, req as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should include request details in log', () => {
      const error = new Error('Test error');
      const logger = require('../../../utils/logger');
      const req = { ...createMockReq('/api/v1/tasks'), method: 'POST' };

      errorLogger(error, req as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith(
        'Unhandled Error',
        expect.objectContaining({
          method: 'POST',
          path: '/api/v1/tasks',
        }),
      );
    });
  });
});

