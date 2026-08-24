// Controlador de Inventario.

import type { Request, Response } from 'express';
import * as inventarioService from '../services/inventario.service.js';
import { asyncHandler } from '../utils/helpers.js';

export const obtenerPorVariante = asyncHandler(async (req: Request, res: Response) => {
  const inventario = await inventarioService.obtenerPorVariante(req.params.idVariante);
  res.json(inventario);
});

export const actualizarStock = asyncHandler(async (req: Request, res: Response) => {
  const inventario = await inventarioService.actualizarStock(req.params.idVariante, req.body);
  res.json(inventario);
});

export const ajustarStock = asyncHandler(async (req: Request, res: Response) => {
  const { cantidad } = req.body as { cantidad: number };
  const inventario = await inventarioService.ajustarStock(req.params.idVariante, cantidad);
  res.json(inventario);
});

export const alertasBajoStock = asyncHandler(async (req: Request, res: Response) => {
  const alertas = await inventarioService.obtenerAlertasBajoStock();
  res.json(alertas);
});
