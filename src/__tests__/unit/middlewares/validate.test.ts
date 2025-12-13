import { Request, Response } from 'express';
import httpStatus from 'http-status';
import Joi from 'joi';
import validate from '../../../middlewares/validate';

describe('Validate Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      body: {},
      query: {},
      params: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  it('should pass validation when data is valid', () => {
    const schema = {
      body: Joi.object({
        to: Joi.string().email().required(),
      }),
    };

    mockReq.body = { to: 'test@example.com' };

    const middleware = validate(schema);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should fail validation when required field is missing', () => {
    const schema = {
      body: Joi.object({
        to: Joi.string().email().required(),
      }),
    };

    mockReq.body = {};

    const middleware = validate(schema);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: httpStatus.BAD_REQUEST,
    }));
  });

  it('should fail validation when email is invalid', () => {
    const schema = {
      body: Joi.object({
        to: Joi.string().email().required(),
      }),
    };

    mockReq.body = { to: 'invalid-email' };

    const middleware = validate(schema);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: httpStatus.BAD_REQUEST,
    }));
  });

  it('should validate query', () => {
    const schema = {
      query: Joi.object({
        limit: Joi.number().integer().min(1),
      }),
    };

    mockReq.query = { limit: '0' as unknown as string };

    const middleware = validate(schema);
    middleware(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: httpStatus.BAD_REQUEST,
    }));
  });
});

