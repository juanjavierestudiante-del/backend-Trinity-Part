import * as carritoRepository from '../repositories/carrito.repository.js';
import { AppError } from '../utils/helpers.js';
import type { AgregarItemInput } from '../validations/carrito.validation.js';

export const obtenerCarrito = async (idUsuario: number) => {
  return carritoRepository.findOrCreateByUsuario(idUsuario);
};

export const contarItems = async (idUsuario: number) => {
  return carritoRepository.contarItems(idUsuario);
};

export const agregarItem = async (idUsuario: number, input: AgregarItemInput) => {
  const carrito = await carritoRepository.findOrCreateByUsuario(idUsuario);
  return carritoRepository.upsertItem(carrito.idCarrito, input.idVariante, input.cantidad);
};

export const actualizarItem = async (idUsuario: number, idDetalle: number, cantidad: number) => {
  const carrito = await carritoRepository.findOrCreateByUsuario(idUsuario);
  const item = await carritoRepository.findItemById(idDetalle);

  if (!item || item.idCarrito !== carrito.idCarrito) {
    throw new AppError('Item no encontrado en tu carrito', 404);
  }

  return carritoRepository.updateItemCantidad(idDetalle, cantidad);
};

export const eliminarItem = async (idUsuario: number, idDetalle: number) => {
  const carrito = await carritoRepository.findOrCreateByUsuario(idUsuario);
  const item = await carritoRepository.findItemById(idDetalle);

  if (!item || item.idCarrito !== carrito.idCarrito) {
    throw new AppError('Item no encontrado en tu carrito', 404);
  }

  return carritoRepository.deleteItem(idDetalle);
};
