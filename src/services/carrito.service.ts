import * as carritoRepository from '../repositories/carrito.repository.js';
import { AppError } from '../utils/helpers.js';
import type { AgregarItemInput } from '../validations/carrito.validation.js';
import { resolverContextoComercialBase, resolverVentasAgrupadas } from './resolucion-comercial.service.js';
import { ErrorPrecioCantidad } from '../types/precio-cantidad.types.js';

export const obtenerCarrito = async (idUsuario: number) => {
  const carrito = await carritoRepository.obtenerVistaPorUsuario(idUsuario);
  if (!carrito.items.length) return { ...carrito, total: '0.00' };
  try {
    const precios = await resolverVentasAgrupadas(carrito.items);
    return {
      ...carrito,
      items: carrito.items.map((item, index) => {
        const r = precios.lineas[index];
        return { ...item, presentacion: r.presentacion, cantidadBaseTotal: r.cantidadBaseTotal,
          stockBase: item.stock, stock: Math.floor(item.stock / r.presentacion.cantidadBase),
          idListaPrecioEfectiva: r.listaPrecio.idListaPrecio,
          precioPorPresentacion: r.precioPorPresentacion.toFixed(2), subtotal: r.subtotal.toFixed(2) };
      }),
      total: precios.total.toFixed(2),
      gruposPrecio: precios.grupos.map(g => ({ idProducto: g.idProducto, idPresentacion: g.presentacion.idPresentacion,
        idPerfilPrecio: g.perfilPrecio.idPerfilPrecio, idListaPrecioEfectiva: g.listaPrecio.idListaPrecio,
        cantidadTotalGrupo: g.cantidadPresentaciones, cantidadMinimaAplicada: g.reglaPrecio.cantidadMinima,
        precioPorPresentacion: g.precioPorPresentacion.toFixed(2), subtotalGrupo: g.subtotal.toFixed(2),
        idsVariantes: g.indices.map(i => carrito.items[i].idVariante), idsDetalles: g.indices.map(i => carrito.items[i].idDetalle) })),
    };
  } catch (error) {
    if (error instanceof ErrorPrecioCantidad) throw new AppError('No se pudo resolver el precio actual de un producto del carrito', 409);
    throw error;
  }
};

export const contarItems = async (idUsuario: number) => {
  return carritoRepository.contarItems(idUsuario);
};

export const agregarItem = async (idUsuario: number, input: AgregarItemInput) => {
  try {
    const contexto = await resolverContextoComercialBase(input.idVariante, input.idPresentacion);
    const [item] = await carritoRepository.agregarItemAtomico(idUsuario, input.idVariante, contexto.presentacion.idPresentacion, input.cantidad);
    return item;
  } catch (error: any) {
    const codigo = error?.meta?.code ?? error?.code;
    if (codigo !== 'P0001') throw error;
    const mensajes: Record<string, [string, number]> = {
      CART_VARIANT_NOT_AVAILABLE: ['Variante no encontrada o no disponible', 404],
      CART_INVALID_QUANTITY: ['Cantidad inválida', 400],
      CART_MAX_QUANTITY: ['La cantidad máxima por producto es 100', 400],
      CART_INSUFFICIENT_STOCK: ['Stock insuficiente', 400],
    };
    const [mensaje, status] = mensajes[String(error?.meta?.message ?? error.message).replace(/^ERROR: /, '')] ?? ['No se pudo agregar el producto', 400];
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
