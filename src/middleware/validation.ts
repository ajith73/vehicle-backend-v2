import { NextFunction, Request, Response } from 'express';
import { Validator } from '../validation/schema';

type RequestSegment = 'body' | 'params' | 'query';

const validateSegment = <T>(segment: RequestSegment, validator: Validator<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = validator(req[segment], segment);
      (req as any)[segment] = parsed;
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateBody = <T>(validator: Validator<T>) => validateSegment('body', validator);
