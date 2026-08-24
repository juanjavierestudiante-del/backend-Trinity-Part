// Capa de acceso a datos para Categoría.

import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

// Obtener todos los IDs descendientes por slug (CTE recursivo)
export const getIdsDescendientes = async (slug: string): Promise<number[]> => {
  const result = await prisma.$queryRaw<{ id_categoria: number }[]>`
    WITH RECURSIVE categorias AS (
      SELECT id_categoria
      FROM categoria
      WHERE slug = ${slug}

      UNION ALL

      SELECT c.id_categoria
      FROM categoria c
      INNER JOIN categorias ct
        ON c.id_categoria_padre = ct.id_categoria
    )
    SELECT id_categoria FROM categorias;
  `;

  return result.map(r => r.id_categoria);
};

// Obtener todos los IDs descendientes por ID (para inactivación en cascada)
export const getIdsDescendientesPorId = async (idCategoria: number): Promise<number[]> => {
  const result = await prisma.$queryRaw<{ id_categoria: number }[]>`
    WITH RECURSIVE categorias AS (
      SELECT id_categoria
      FROM categoria
      WHERE id_categoria = ${idCategoria}

      UNION ALL

      SELECT c.id_categoria
      FROM categoria c
      INNER JOIN categorias ct
        ON c.id_categoria_padre = ct.id_categoria
    )
    SELECT id_categoria FROM categorias;
  `;

  return result.map(r => r.id_categoria);
};

export const findAll = () => {
  return prisma.categoria.findMany({
    include: { subcategorias: true },
    orderBy: { orden: 'asc' },
  });
};

// Categorías raíz activas con subcategorías activas (catálogo público)
export const findRaiz = () => {
  return prisma.categoria.findMany({
    where: { idCategoriaPadre: null, estado: 'Activo' },
    include: {
      subcategorias: {
        where: { estado: 'Activo' },
      },
    },
    orderBy: { orden: 'asc' },
  });
};

export const findById = (idCategoria: number | string) => {
  return prisma.categoria.findUnique({ where: { idCategoria: Number(idCategoria) } });
};

export const findByIdConHijos = (idCategoria: number | string) => {
  return prisma.categoria.findUnique({
    where: { idCategoria: Number(idCategoria) },
    include: { subcategorias: true },
  });
};

export const findBySlug = (slug: string) => {
  return prisma.categoria.findUnique({ where: { slug }, include: { subcategorias: true } });
};

// Verificar si ya existe una categoría activa con el mismo slug (excluyendo una ID)
export const existeSlugActivo = async (slug: string, excludingId?: number): Promise<boolean> => {
  const where: Prisma.CategoriaWhereInput = { slug, estado: 'Activo' };
  if (excludingId) {
    where.idCategoria = { not: excludingId };
  }
  const count = await prisma.categoria.count({ where });
  return count > 0;
};

// Contar subcategorías directas
export const contarSubcategorias = async (idCategoria: number): Promise<number> => {
  return prisma.categoria.count({
    where: { idCategoriaPadre: idCategoria },
  });
};

export const create = (data: Prisma.CategoriaCreateInput) => prisma.categoria.create({ data });

export const update = (idCategoria: number | string, data: Prisma.CategoriaUpdateInput) =>
  prisma.categoria.update({ where: { idCategoria: Number(idCategoria) }, data });

// Soft delete: inactivar categoría
export const inactivar = (idCategoria: number | string) =>
  prisma.categoria.update({
    where: { idCategoria: Number(idCategoria) },
    data: { estado: 'Inactivo' },
  });

// Reactivar categoría
export const reactivar = (idCategoria: number | string) =>
  prisma.categoria.update({
    where: { idCategoria: Number(idCategoria) },
    data: { estado: 'Activo' },
  });

// Inactivar múltiples categorías en cascada
export const inactivarMuchas = (ids: number[]) =>
  prisma.categoria.updateMany({
    where: { idCategoria: { in: ids } },
    data: { estado: 'Inactivo' },
  });

export const remove = (idCategoria: number | string) =>
  prisma.categoria.delete({ where: { idCategoria: Number(idCategoria) } });
