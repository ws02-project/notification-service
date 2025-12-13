/**
 * Custom API Error class for consistent error handling across the service
 */
class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Factory function to create ApiError instances
 */
const createApiError = (
  statusCode: number,
  message: string,
  isOperational = true,
  stack = '',
): ApiError => {
  return new ApiError(statusCode, message, isOperational, stack);
};

export { ApiError };
export default createApiError;
