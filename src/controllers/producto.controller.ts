// Controlador de Producto: recibe la request, llama al service, responde.

import type { Request, Response } from 'express';
import * as productoService from '../services/producto.service.js';
import { asyncHandler, parsePaginacion } from '../utils/helpers.js';

export const listar = asyncHandler(async (req: Request, res: Response) => {
  // Antes: const { estado } = req.query;
  // Ahora: también leemos "categoria" y "q" de la URL
  const { estado, categoria, q } = req.query;
  const { page, limit } = parsePaginacion(req.query);

  const { items, total } = await productoService.listar(
    {
      estado: estado as string | undefined,
      categoria: categoria as string | undefined, // NUEVO
      q: q as string | undefined,                   // NUEVO
    },
    { page, limit }
  );

  res.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// Listado admin sin paginar (mantiene el shape de array de siempre).
export const listarTodos = asyncHandler(async (req: Request, res: Response) => {
  const { estado, categoria, q } = req.query;

  const productos = await productoService.listarTodos({
    estado: estado as string | undefined,
    categoria: categoria as string | undefined,
    q: q as string | undefined,
  });

  res.json(productos);
});

export const obtenerPorId = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productoService.obtenerPorId(req.params.id);
  res.json(producto);
});

export const obtenerPorSlug = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productoService.obtenerPorSlug(req.params.slug);
  res.json(producto);
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productoService.crear(req.body);
  res.status(201).json(producto);
});

export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const producto = await productoService.actualizar(req.params.id, req.body);
  res.json(producto);
});

export const eliminar = asyncHandler(async (req: Request, res: Response) => {
  await productoService.eliminar(req.params.id);
  res.status(204).send();
});
