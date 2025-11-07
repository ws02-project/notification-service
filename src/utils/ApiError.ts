class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

const createApiError = (statusCode: number, message: string): ApiError => {
  return new ApiError(statusCode, message);
};

export default createApiError;
