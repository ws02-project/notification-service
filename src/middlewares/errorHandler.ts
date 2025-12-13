import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { config } from '../config';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';

/**
 * Convert any error to ApiError format
 */
export const errorConverter = (err: Error, _req: Request, _res: Response, next: NextFunction) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode =
      (error as { statusCode?: number }).statusCode || httpStatus.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, false, err.stack);
  }

  next(error);
};

/**
 * Handle errors and send standardized JSON response
 */
export const errorHandler = (err: ApiError, _req: Request, res: Response, _next: NextFunction) => {
  let { statusCode, message } = err;

  // In production, hide internal error details
  if (config.env === 'production' && !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  const response = {
    success: false,
    code: statusCode,
    message,
    ...(config.env === 'development' && { stack: err.stack }),
  };

  if (config.env === 'development') {
    logger.error(err);
  }

  res.status(statusCode).json(response);
};
