// Controlador de Inventario.

import type { Request, Response } from 'express';
import * as inventarioService from '../services/inventario.service.js';
import { asyncHandler, parsePaginacion } from '../utils/helpers.js';

// Extrae el usuario autenticado (authMiddleware) y el motivo del body.
const contextoDesdeRequest = (req: Request) => ({
  idUsuario: req.usuario?.id_usuario ?? null,
  motivo: typeof req.body?.motivo === 'string' ? req.body.motivo : null,
});

export const listarTodo = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePaginacion(req.query);
  const { items, total } = await inventarioService.listar(page, limit);
  res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
});

export const alertasBajoStock = asyncHandler(async (req: Request, res: Response) => {
  const alertas = await inventarioService.listarAlertas();
  res.json(alertas);
});

export const obtenerPorVariante = asyncHandler(async (req: Request, res: Response) => {
  const inventario = await inventarioService.obtenerPorVariante(req.params.idVariante);
  res.json(inventario);
});

export const historial = asyncHandler(async (req: Request, res: Response) => {
  const movimientos = await inventarioService.historialPorVariante(req.params.idVariante);
  res.json(movimientos);
});

export const actualizarStock = asyncHandler(async (req: Request, res: Response) => {
  const { motivo, ...datos } = req.body;
  const inventario = await inventarioService.actualizarStock(
    req.params.idVariante,
    datos,
    contextoDesdeRequest(req)
  );
  res.json(inventario);
});

export const ajustarStock = asyncHandler(async (req: Request, res: Response) => {
  const { cantidad } = req.body as { cantidad: number };
  const inventario = await inventarioService.ajustarStock(
    req.params.idVariante,
    cantidad,
    contextoDesdeRequest(req)
  );
  res.json(inventario);
});
