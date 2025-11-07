import Joi from 'joi';

export const sendTestEmailSchema = {
  body: Joi.object({
    to: Joi.string().email().required(),
    subject: Joi.string().optional().max(255),
    message: Joi.string().optional().max(5000),
  }),
};
