// Middleware de manejo de errores centralizado.
// Cualquier error pasado con next(error) termina aquí.

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

interface ErrorConCodigo extends Error {
  statusCode?: number;
  code?: string;
  meta?: { target?: string };
}

export const errorMiddleware = (
  err: ErrorConCodigo,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(err.message, err.stack);

  // Error de Prisma: registro único duplicado (ej: slug o sku repetido)
  if (err.code === 'P2002') {
    res.status(409).json({
      error: `Ya existe un registro con ese valor en el campo: ${err.meta?.target}`,
    });
    return;
  }

  // Error de Prisma: registro no encontrado
  if (err.code === 'P2025') {
    res.status(404).json({ error: 'Registro no encontrado' });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({ error: message });
};

// 404 para rutas que no existen
export const notFoundMiddleware = (req: Request, res: Response): void => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};
