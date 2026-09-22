import * as carritoRepository from '../repositories/carrito.repository.js';
import { AppError } from '../utils/helpers.js';
import type { AgregarItemInput } from '../validations/carrito.validation.js';
import { resolverPreciosAgrupados } from './precio-cantidad.service.js';
import { ErrorPrecioCantidad } from '../types/precio-cantidad.types.js';

export const obtenerCarrito = async (idUsuario: number) => {
  const carrito = await carritoRepository.obtenerVistaPorUsuario(idUsuario);
  if (carrito.items.length === 0) return { ...carrito, total: '0.00' };
  try {
    const precios = await resolverPreciosAgrupados(carrito.items.map((item) => ({ idVariante: item.idVariante, cantidad: item.cantidad })));
    const porVariante = new Map(precios.lineas.map((linea) => [linea.idVariante, linea]));
    const detallesPorVariante = new Map(carrito.items.map((item) => [item.idVariante, item.idDetalle]));
    return {
      ...carrito,
      items: carrito.items.map((item) => {
        const precio = porVariante.get(item.idVariante)!;
        return {
          ...item,
          idListaPrecioEfectiva: precio.idListaPrecioEfectiva,
          precioPorPresentacion: precio.precioPorPresentacion.toFixed(2),
          subtotal: precio.subtotal.toFixed(2),
        };
      }),
      total: precios.total.toFixed(2),
      gruposPrecio: precios.grupos.map((grupo) => {
        const lineas = precios.lineas.filter((linea) => linea.idProducto === grupo.idProducto && linea.idListaPrecioEfectiva === grupo.idListaPrecio);
        return {
          idProducto: grupo.idProducto,
          idListaPrecioEfectiva: grupo.idListaPrecio,
          cantidadTotalGrupo: grupo.cantidadTotal,
          cantidadMinimaAplicada: grupo.cantidadMinimaAplicada,
          precioPorPresentacion: grupo.precioPorPresentacion.toFixed(2),
          subtotalGrupo: grupo.subtotalGrupo.toFixed(2),
          idsVariantes: lineas.map((linea) => linea.idVariante),
          idsDetalles: lineas.map((linea) => detallesPorVariante.get(linea.idVariante)!),
        };
      }),
    };
  } catch (error) {
    if (error instanceof ErrorPrecioCantidad) {
      throw new AppError('No se pudo resolver el precio actual de un producto del carrito', 409);
    }
    throw error;
  }
};

export const contarItems = async (idUsuario: number) => {
  return carritoRepository.contarItems(idUsuario);
};

export const agregarItem = async (idUsuario: number, input: AgregarItemInput) => {
  try {
    const [item] = await carritoRepository.agregarItemAtomico(idUsuario, input.idVariante, input.cantidad);
    return item;
  } catch (error: any) {
    if (error?.code !== 'P0001') throw error;
    const mensajes: Record<string, [string, number]> = {
      CART_VARIANT_NOT_AVAILABLE: ['Variante no encontrada o no disponible', 404],
      CART_INVALID_QUANTITY: ['Cantidad inválida', 400],
      CART_MAX_QUANTITY: ['La cantidad máxima por producto es 100', 400],
      CART_INSUFFICIENT_STOCK: ['Stock insuficiente', 400],
    };
    const [mensaje, status] = mensajes[error.message] ?? ['No se pudo agregar el producto', 400];
    throw new AppError(mensaje, status);
  }
};

export const actualizarItem = async (idUsuario: number, idDetalle: number, cantidad: number) => {
  const resultado = await carritoRepository.actualizarCantidadPropia(idUsuario, idDetalle, cantidad);
  if (resultado.estado === 'NO_ENCONTRADO') {
    throw new AppError('Item no encontrado en tu carrito', 404);
  }
  if (resultado.estado === 'STOCK_INSUFICIENTE') throw new AppError('Stock insuficiente', 400);
  return resultado;
};

export const eliminarItem = async (idUsuario: number, idDetalle: number) => {
  const resultado = await carritoRepository.eliminarItemPropio(idUsuario, idDetalle);
  if (resultado.estado === 'NO_ENCONTRADO') {
    throw new AppError('Item no encontrado en tu carrito', 404);
  }
};
