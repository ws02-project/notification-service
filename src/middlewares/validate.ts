import { Request, Response, NextFunction, RequestHandler } from 'express';
import Joi from 'joi';
import httpStatus from 'http-status';
import createApiError from '../utils/ApiError';

/**
 * Validation schema type for request validation
 */
type ValidationSchema = {
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
};

/**
 * Middleware to validate request data against Joi schemas
 *
 * @param schema - Object containing Joi schemas for params, query, and/or body
 * @returns Express middleware function
 *
 * @example
 * router.post('/notifications', validate({ body: notificationSchema }), controller.send);
 */
const validate = (schema: ValidationSchema): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const validSchema = Object.keys(schema).reduce(
      (acc, key) => {
        if (['params', 'query', 'body'].includes(key)) {
          acc[key] = req[key as keyof Pick<Request, 'params' | 'query' | 'body'>];
        }
        return acc;
      },
      {} as Record<string, unknown>,
    );

    const { value, error } = Joi.compile(schema)
      .prefs({ errors: { label: 'key' }, abortEarly: false })
      .validate(validSchema);

    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      next(createApiError(httpStatus.BAD_REQUEST, errorMessage));
      return;
    }

    Object.assign(req, value);
    next();
  };
};

export default validate;
