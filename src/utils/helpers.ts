// Envuelve funciones async de controladores para capturar errores
// automáticamente y mandarlos al errorMiddleware, sin escribir try/catch
// en cada controlador.

import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export const asyncHandler = (fn: AsyncRouteHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Genera un slug simple a partir de un texto (ej: "Globo de Látex" -> "globo-de-latex")
export const generarSlug = (texto: string): string => {
  return texto
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// Error de aplicación con statusCode, para que errorMiddleware responda el código correcto
export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface Paginacion {
  page: number;
  limit: number;
}

// Lee page/limit de la querystring con defaults y límites razonables.
export const parsePaginacion = (query: Record<string, unknown>): Paginacion => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
};
