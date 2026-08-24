import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { logger } from '../lib/logger';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    requestId: req.requestId
  });
};

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const appError = error instanceof AppError
    ? error
    : new AppError('Internal server error');

  logger.error('request_failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: appError.statusCode,
    error,
    details: appError.details
  });

  res.status(appError.statusCode).json({
    error: appError.message,
    details: appError.details,
    requestId: req.requestId
  });
};
