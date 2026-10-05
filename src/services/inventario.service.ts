// Lógica de negocio para Inventario.

import * as inventarioRepository from '../repositories/inventario.repository.js';
import * as productoVarianteRepository from '../repositories/productoVariante.repository.js';
import { AppError } from '../utils/helpers.js';
import type { ActualizarInventarioInput } from '../validations/inventario.validation.js';

interface ContextoUsuario {
  idUsuario?: number | null;
  motivo?: string | null;
}

type FilaAdmin = Awaited<ReturnType<typeof inventarioRepository.findTodos>>['items'][number];

const conDisponibilidad = (fila: FilaAdmin) => ({
  ...fila,
  presentaciones: fila.presentaciones.map(p => ({
    ...p, disponible: Math.floor(fila.stockActual / p.cantidadBase),
  })),
});

export const listar = async (page = 1, limit = 20) => {
  const resultado = await inventarioRepository.findTodos(page, limit);
  return { ...resultado, items: resultado.items.map(conDisponibilidad) };
};

export const listarAlertas = async () => (await inventarioRepository.findBajoStock()).map(conDisponibilidad);

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
