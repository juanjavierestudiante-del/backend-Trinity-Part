import type { Request, Response } from 'express';
import * as carritoService from '../services/carrito.service.js';
import { asyncHandler } from '../utils/helpers.js';

export const obtener = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const carrito = await carritoService.obtenerCarrito(idUsuario);
  res.json(carrito);
});

export const agregarItem = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const item = await carritoService.agregarItem(idUsuario, req.body);
  res.status(201).json(item);
});

export const actualizarItem = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const idDetalle = Number(req.params.idDetalle);
  const item = await carritoService.actualizarItem(idUsuario, idDetalle, req.body.cantidad);
  res.json(item);
});

export const eliminarItem = asyncHandler(async (req: Request, res: Response) => {
  const idUsuario = req.usuario!.id_usuario;
  const idDetalle = Number(req.params.idDetalle);
  await carritoService.eliminarItem(idUsuario, idDetalle);
  res.status(204).send();
});
