import type { Request, Response } from 'express';
import * as pedidoService from '../services/pedido.service.js';
import { asyncHandler } from '../utils/helpers.js';

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const pedido = await pedidoService.crear(idUsuario);
  res.status(201).json(pedido);
});

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const pedidos = await pedidoService.listarPorUsuario(idUsuario);
  res.json(pedidos);
});
