// Lógica de negocio para Inventario.

import * as inventarioRepository from '../repositories/inventario.repository.js';
import * as productoVarianteRepository from '../repositories/productoVariante.repository.js';
import { AppError } from '../utils/helpers.js';
import type { ActualizarInventarioInput } from '../validations/inventario.validation.js';

interface ContextoUsuario {
  idUsuario?: number | null;
  motivo?: string | null;
}

export const listar = () => inventarioRepository.findTodos();

export const listarAlertas = () => inventarioRepository.findBajoStock();

export const obtenerPorVariante = async (idVariante: number | string) => {
  const inventario = await inventarioRepository.findByVariante(idVariante);
  if (!inventario) {
    throw new AppError('Inventario no encontrado para esta variante', 404);
  }
  return inventario;
};

export const actualizarStock = (
  idVariante: number | string,
  datos: ActualizarInventarioInput,
  ctx: ContextoUsuario = {}
) => inventarioRepository.upsertConMovimiento(idVariante, datos, ctx);

export const ajustarStock = (
  idVariante: number | string,
  cantidad: number,
  ctx: ContextoUsuario = {}
) => inventarioRepository.ajustarConMovimiento(idVariante, cantidad, ctx);

export const historialPorVariante = async (idVariante: number | string) => {
  const existe = await productoVarianteRepository.existePorId(idVariante);
  if (!existe) {
    throw new AppError('Variante no encontrada', 404);
  }
  return inventarioRepository.findHistorialPorVariante(Number(idVariante));
};
