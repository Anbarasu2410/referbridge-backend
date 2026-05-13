import { Request, Response, NextFunction } from 'express';
import { z, ZodTypeAny } from 'zod';

export const validate = (schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body) as z.SafeParseReturnType<unknown, unknown>;
    if (!result.success) {
      return next(result.error);
    }
    req.body = result.data;
    next();
  };
};

export const validateQuery = (schema: ZodTypeAny) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query) as z.SafeParseReturnType<unknown, unknown>;
    if (!result.success) {
      return next(result.error);
    }
    req.query = result.data as any;
    next();
  };
};
