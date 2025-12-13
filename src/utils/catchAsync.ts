import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to catch rejected promises and pass errors to Express error handler
 *
 * @param fn - Async route handler function
 * @returns Wrapped function that forwards errors to next()
 *
 * @example
 * router.post('/notifications', catchAsync(async (req, res) => {
 *   await notificationService.send(req.body);
 *   res.json({ success: true });
 * }));
 */
const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default catchAsync;
