// Lógica de negocio para Categoría.

import { Prisma } from '@prisma/client';
import * as categoriaRepository from '../repositories/categoria.repository.js';
import { generarSlug, AppError } from '../utils/helpers.js';

export const listar = () => categoriaRepository.findAll();

export const listarRaiz = () => categoriaRepository.findRaiz();

export const obtenerPorId = async (idCategoria: number | string) => {
  const categoria = await categoriaRepository.findById(idCategoria);
  if (!categoria) {
    throw new AppError('Categoría no encontrada', 404);
  }
  return categoria;
};

export const obtenerPorIdConHijos = async (idCategoria: number | string) => {
  const categoria = await categoriaRepository.findByIdConHijos(idCategoria);
  if (!categoria) {
    throw new AppError('Categoría no encontrada', 404);
  }
  return categoria;
};

export const crear = async (datos: Prisma.CategoriaCreateInput & { nombre: string }) => {
  const slug = datos.slug || generarSlug(datos.nombre);

  // Validar que el slug no esté en uso por otra categoría activa
  const slugExiste = await categoriaRepository.existeSlugActivo(slug);
  if (slugExiste) {
    throw new AppError('Ya existe una categoría activa con ese nombre', 409);
  }

  return categoriaRepository.create({ ...datos, slug });
};

export const actualizar = async (idCategoria: number | string, datos: Prisma.CategoriaUpdateInput) => {
  await obtenerPorId(idCategoria);

  // Si cambió el nombre, regenerar slug y validar unicidad
  if (datos.nombre && typeof datos.nombre === 'string') {
    const nuevoSlug = generarSlug(datos.nombre);
    const slugEnUso = await categoriaRepository.existeSlugActivo(nuevoSlug, Number(idCategoria));
    if (slugEnUso) {
      throw new AppError('Ya existe otra categoría activa con ese nombre', 409);
    }
    (datos as any).slug = nuevoSlug;
  }

  return categoriaRepository.update(idCategoria, datos);
};

// Cambiar estado de categoría (inactivar/reactivar)
export const cambiarEstado = async (idCategoria: number | string, nuevoEstado: 'Activo' | 'Inactivo') => {
  const categoria = await obtenerPorId(idCategoria);

  if (nuevoEstado === 'Inactivo') {
    // Inactivar en cascada: buscar todos los descendientes
    const idsDescendientes = await categoriaRepository.getIdsDescendientesPorId(Number(idCategoria));
    // Excluir la categoría misma
    const idsHijos = idsDescendientes.filter(id => id !== Number(idCategoria));

    if (idsHijos.length > 0) {
      await categoriaRepository.inactivarMuchas(idsHijos);
    }
    await categoriaRepository.inactivar(idCategoria);

    return {
      categoria: await categoriaRepository.findById(idCategoria),
      hijosInactivados: idsHijos.length,
    };
  }

  // Reactivar: solo la categoría, NO hijos
  await categoriaRepository.reactivar(idCategoria);
  return {
    categoria: await categoriaRepository.findById(idCategoria),
    hijosInactivados: 0,
  };
};

// Contar subcategorías directas (para confirmación en frontend)
export const contarSubcategorias = async (idCategoria: number | string) => {
  await obtenerPorId(idCategoria);
  return categoriaRepository.contarSubcategorias(Number(idCategoria));
};

// Eliminar físicamente (solo si no tiene hijos ni productos)
export const eliminar = async (idCategoria: number | string) => {
  const categoria = await obtenerPorId(idCategoria);

  // Verificar si tiene subcategorías hijas
  const numHijos = await categoriaRepository.contarSubcategorias(Number(idCategoria));
  if (numHijos > 0) {
    throw new AppError(
      'La categoría tiene subcategorías. Inactivala en su lugar.',
      409
    );
  }

  return categoriaRepository.remove(idCategoria);
};
