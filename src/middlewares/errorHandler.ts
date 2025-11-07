import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import logger from '../utils/logger';
import createApiError from '../utils/ApiError';

export const errorConverter = (err: Error, _req: Request, _res: Response, next: NextFunction) => {
  let error = err;
  if (!(error instanceof Error)) {
    const statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    const message = String(error) || httpStatus[statusCode];
    error = createApiError(statusCode, message);
  }
  next(error);
};

export const errorHandler = (
  err: Error & { statusCode?: number; isOperational?: boolean },
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let { statusCode, message } = err;

  if (!statusCode || !err.isOperational) {
    statusCode = httpStatus.INTERNAL_SERVER_ERROR;
    message = message || 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  const response = {
    success: false,
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  logger.error(err);

  res.status(statusCode).send(response);
};
