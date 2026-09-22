import type { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils/helpers.js';
import { resolverPreciosAgrupados } from '../services/precio-cantidad.service.js';
import { ErrorPrecioCantidad, type ResultadoPreciosAgrupados } from '../types/precio-cantidad.types.js';

export const previsualizar = asyncHandler(async (req: Request, res: Response) => {
  const idProducto = Number(req.params.idProducto);
  let resultado: ResultadoPreciosAgrupados;
  try {
    resultado = await resolverPreciosAgrupados(req.body.lineas);
  } catch (error) {
    if (error instanceof ErrorPrecioCantidad) {
      throw new AppError('No se pudo calcular el precio para la cantidad solicitada', 409);
    }
    throw error;
  }
  if (resultado.lineas.some((linea) => linea.idProducto !== idProducto)) {
    throw new AppError('Una variante no pertenece al producto indicado', 400);
  }
  res.json({
    grupos: resultado.grupos.map((grupo) => ({
      idProducto: grupo.idProducto,
      idListaPrecio: grupo.idListaPrecio,
      cantidadTotal: grupo.cantidadTotal,
      idReglaPrecio: grupo.idReglaPrecio,
      cantidadMinimaAplicada: grupo.cantidadMinimaAplicada,
      precioPorPresentacion: grupo.precioPorPresentacion.toFixed(2),
      subtotalGrupo: grupo.subtotalGrupo.toFixed(2),
    })),
    lineas: resultado.lineas.map((linea) => ({
      idVariante: linea.idVariante,
      cantidad: linea.cantidad,
      idListaPrecioEfectiva: linea.idListaPrecioEfectiva,
      cantidadMinimaAplicada: linea.cantidadMinimaAplicada,
      precioPorPresentacion: linea.precioPorPresentacion.toFixed(2),
      subtotal: linea.subtotal.toFixed(2),
    })),
    total: resultado.total.toFixed(2),
  });
});
