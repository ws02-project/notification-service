import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import httpStatus from 'http-status';
import { config } from './config';
import routes from './routes';
import { errorConverter, errorHandler } from './middlewares/errorHandler';
import createApiError from './utils/ApiError';

const app: Application = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors());
// Note: app.use(cors()) already handles OPTIONS requests, so explicit app.options is not needed
// If explicit OPTIONS handling is required, use app.options('/*', cors()) instead of '*'

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// API routes
app.use(`/api/${config.apiVersion}`, routes);

// 404 handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(createApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Error handling
app.use(errorConverter);
app.use(errorHandler);

export default app;
