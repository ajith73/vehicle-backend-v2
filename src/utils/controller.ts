import { Request, Response } from 'express';
import { logger } from '../lib/logger';

export const handleControllerError = (
  req: Request,
  res: Response,
  error: unknown,
  clientMessage: string,
  statusCode = 500
) => {
  logger.error('controller_error', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    error
  });

  res.status(statusCode).json({
    error: clientMessage,
    requestId: req.requestId,
    actualError: error instanceof Error ? error.message : String(error)
  });
};
