import { Request, Response, NextFunction } from 'express';
import catchAsync from '../../../utils/catchAsync';

describe('catchAsync', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call the wrapped function with req, res, next', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);
    const wrapped = catchAsync(mockFn);

    await wrapped(mockReq as Request, mockRes as Response, mockNext);

    expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it('should not call next when function succeeds', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);
    const wrapped = catchAsync(mockFn);

    await wrapped(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next with error when function throws', async () => {
    const error = new Error('Test error');
    const mockFn = jest.fn().mockRejectedValue(error);
    const wrapped = catchAsync(mockFn);

    await wrapped(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle rejected promise', async () => {
    const error = new Error('Async error');
    const mockFn = jest.fn().mockRejectedValue(error);
    const wrapped = catchAsync(mockFn);

    await wrapped(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should pass through response when function responds', async () => {
    const mockFn = jest.fn().mockImplementation((_req, res) => {
      res.status(200).json({ success: true });
      return Promise.resolve();
    });
    const wrapped = catchAsync(mockFn);

    await wrapped(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
  });
});
