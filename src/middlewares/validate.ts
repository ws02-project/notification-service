import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import httpStatus from 'http-status';
import createApiError from '../utils/ApiError';

type Schema = {
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  body?: Joi.ObjectSchema;
};

const validate = (schema: Schema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: string[] = [];

    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.push(...error.details.map((detail) => detail.message));
      }
    }

    if (errors.length > 0) {
      next(createApiError(httpStatus.BAD_REQUEST, errors.join(', ')));
    } else {
      next();
    }
  };
};

export default validate;
