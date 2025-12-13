import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { errorConverter, errorHandler } from '../../../middlewares/errorHandler';
import { ApiError } from '../../../utils/ApiError';

jest.mock('../../../config', () => ({
  config: {
    env: 'development',
  },
}));

jest.mock('../../../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      method: 'GET',
      path: '/test',
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      locals: {},
    };

    mockNext = jest.fn();
  });

  describe('errorConverter', () => {
    it('should pass ApiError without modification', () => {
      const apiError = new ApiError(httpStatus.BAD_REQUEST, 'Bad request');

      errorConverter(apiError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(apiError);
    });

    it('should convert regular Error to ApiError', () => {
      const error = new Error('Regular error');

      errorConverter(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      const convertedError = mockNext.mock.calls[0][0] as ApiError;
      expect(convertedError.statusCode).toBe(httpStatus.INTERNAL_SERVER_ERROR);
      expect(convertedError.message).toBe('Regular error');
    });

    it('should handle error without message', () => {
      const error = new Error();

      errorConverter(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
    });
  });

  describe('errorHandler', () => {
    it('should return error response with correct status', () => {
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Bad request');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: httpStatus.BAD_REQUEST,
          message: 'Bad request',
        }),
      );
    });

    it('should return 500 for internal errors', () => {
      const error = new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Server error');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it('should include stack trace in development', () => {
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Test error');
      error.stack = 'Error: Test error\n  at test.ts:1:1';

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
        }),
      );
    });

    it('should set error message in res.locals', () => {
      const error = new ApiError(httpStatus.BAD_REQUEST, 'Test error message');

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.locals!.errorMessage).toBe('Test error message');
    });
  });
});
