import type { Request, Response } from 'express';
import * as service from '../services/comercial-admin.service.js';
import { AppError, asyncHandler } from '../utils/helpers.js';
const id = (value: string) => {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 2147483647) throw new AppError('Identificador inválido.', 400);
  return result;
};
export const obtener = asyncHandler(async (req: Request, res: Response) => res.json(await service.obtenerConfiguracion(id(req.params.idProducto))));
export const crearPresentacion = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await service.guardarPresentacion(id(req.params.idProducto), null, req.body)));
export const editarPresentacion = asyncHandler(async (req: Request, res: Response) => res.json(await service.guardarPresentacion(id(req.params.idProducto), id(req.params.idPresentacion), req.body)));
export const crearPerfil = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await service.guardarPerfil(id(req.params.idProducto), null, req.body)));
export const editarPerfil = asyncHandler(async (req: Request, res: Response) => res.json(await service.guardarPerfil(id(req.params.idProducto), id(req.params.idPerfilPrecio), req.body)));
export const asignarPerfil = asyncHandler(async (req: Request, res: Response) => {
  await service.asignarPerfiles(id(req.params.idProducto), [{ idVariante: id(req.params.idVariante), idPerfilPrecio: req.body.idPerfilPrecio }]); res.status(204).end();
});
export const asignarPerfiles = asyncHandler(async (req: Request, res: Response) => { await service.asignarPerfiles(id(req.params.idProducto), req.body.asignaciones); res.status(204).end(); });
export const crearRegla = asyncHandler(async (req: Request, res: Response) => res.status(201).json(await service.guardarRegla(id(req.params.idProducto), id(req.params.idListaPrecio), null, req.body)));
export const editarRegla = asyncHandler(async (req: Request, res: Response) => res.json(await service.guardarRegla(id(req.params.idProducto), id(req.params.idListaPrecio), id(req.params.idReglaPrecio), req.body)));
export const eliminarRegla = asyncHandler(async (req: Request, res: Response) => { await service.eliminarRegla(id(req.params.idProducto), id(req.params.idListaPrecio), id(req.params.idReglaPrecio)); res.status(204).end(); });
