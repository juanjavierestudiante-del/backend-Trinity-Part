// Middleware genérico para validar req.body contra un schema de Zod.
// Uso: router.post('/productos', validate(productoSchema), controller.crear)

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const errores = result.error.errors.map((e) => ({
        campo: e.path.join('.'),
        mensaje: e.message,
      }));
      res.status(400).json({ error: 'Datos inválidos', detalles: errores });
      return;
    }

    req.body = result.data;
    next();
  };
};

export const validateParams = (schema: ZodSchema): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);

    if (!result.success) {
      const errores = result.error.errors.map((e) => ({
        campo: e.path.join('.'),
        mensaje: e.message,
      }));
      res.status(400).json({ error: 'Parámetros inválidos', detalles: errores });
      return;
    }

    req.params = result.data;
    next();
  };
};
