import type { Request, Response } from 'express';
import { asyncHandler, AppError } from '../utils/helpers.js';
import { resolverVentasAgrupadas } from '../services/resolucion-comercial.service.js';
import { ErrorPrecioCantidad } from '../types/precio-cantidad.types.js';

export const previsualizar = asyncHandler(async (req: Request, res: Response) => {
  const idProducto = Number(req.params.idProducto);
  let resultado: Awaited<ReturnType<typeof resolverVentasAgrupadas>>;
  try {
    resultado = await resolverVentasAgrupadas(req.body.lineas);
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
      idListaPrecio: grupo.listaPrecio.idListaPrecio,
      cantidadTotal: grupo.cantidadPresentaciones,
      idReglaPrecio: grupo.reglaPrecio.idReglaPrecio,
      cantidadMinimaAplicada: grupo.reglaPrecio.cantidadMinima,
      precioPorPresentacion: grupo.precioPorPresentacion.toFixed(2),
      subtotalGrupo: grupo.subtotal.toFixed(2),
    })),
    lineas: resultado.lineas.map((linea) => ({
      idVariante: linea.idVariante,
      idPresentacion: linea.presentacion.idPresentacion,
      cantidad: linea.cantidadPresentaciones,
      idListaPrecioEfectiva: linea.listaPrecio.idListaPrecio,
      cantidadMinimaAplicada: linea.reglaPrecio.cantidadMinima,
      precioPorPresentacion: linea.precioPorPresentacion.toFixed(2),
      subtotal: linea.subtotal.toFixed(2),
    })),
    total: resultado.total.toFixed(2),
  });
});
