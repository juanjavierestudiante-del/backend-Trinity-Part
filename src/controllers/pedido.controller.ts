import type { Request, Response } from 'express';
import * as pedidoService from '../services/pedido.service.js';
import { asyncHandler, AppError } from '../utils/helpers.js';

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const pedido = await pedidoService.crear(idUsuario, req.body);
  res.status(201).json(pedido);
});

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const pedidos = await pedidoService.listarPorUsuario(idUsuario);
  res.json(pedidos);
});

export const listarAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const pedidos = await pedidoService.listarTodos();
  res.json(pedidos);
});

export const cambiarEstadoAdmin = asyncHandler(async (req: Request, res: Response) => {
  const idPedido = Number(req.params.id);
  if (!Number.isInteger(idPedido) || idPedido <= 0) {
    throw new AppError('Pedido no encontrado', 404);
  }
  const pedido = await pedidoService.cambiarEstado(idPedido, req.body.estado);
  res.json(pedido);
});