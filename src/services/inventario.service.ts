// Lógica de negocio para Inventario.

import * as inventarioRepository from '../repositories/inventario.repository.js';
import { AppError } from '../utils/helpers.js';

export const obtenerPorVariante = (idVariante: number | string) =>
  inventarioRepository.findByVariante(idVariante);

export const actualizarStock = (
  idVariante: number | string,
  datos: { stockActual?: number; stockMinimo?: number; stockMaximo?: number }
) => inventarioRepository.upsert(idVariante, datos);

// Suma o resta stock (útil para ventas o reposiciones)
export const ajustarStock = async (idVariante: number | string, cantidad: number) => {
  const inventario = await inventarioRepository.findByVariante(idVariante);
  if (!inventario) {
    throw new AppError('Inventario no encontrado para esta variante', 404);
  }
  const nuevoStock = inventario.stockActual + cantidad;
  if (nuevoStock < 0) {
    throw new AppError('Stock insuficiente', 400);
  }
  return inventarioRepository.upsert(idVariante, { stockActual: nuevoStock });
};

export const obtenerAlertasBajoStock = () => inventarioRepository.findBajoStock();
