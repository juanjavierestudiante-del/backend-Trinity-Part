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

type NodoArbol<T> = T & { subcategorias: NodoArbol<T>[] };

type FilaCategoria = {
  idCategoria: number;
  idCategoriaPadre: number | null;
  orden: number;
};

// Indexa filas planas en un Map por id y cuelga cada nodo bajo su padre (N niveles).
const mapearNodos = <T extends FilaCategoria>(nodos: T[]): Map<number, NodoArbol<T>> => {
  const mapa = new Map<number, NodoArbol<T>>();
  for (const nodo of nodos) {
    mapa.set(nodo.idCategoria, { ...nodo, subcategorias: [] });
  }
  for (const nodo of nodos) {
    if (nodo.idCategoriaPadre === null) continue;
    const padre = mapa.get(nodo.idCategoriaPadre);
    const hijo = mapa.get(nodo.idCategoria);
    if (padre && hijo) {
      padre.subcategorias.push(hijo);
    }
  }
  return mapa;
};

// Devuelve solo las raíces (idCategoriaPadre null o inexistente en el lote),
// cada una con su subárbol completo anidado y ordenado por "orden".
const construirArbol = <T extends FilaCategoria>(nodos: T[]): NodoArbol<T>[] => {
  const mapa = mapearNodos(nodos);
  const raices: NodoArbol<T>[] = [];
  for (const nodo of nodos) {
    if (nodo.idCategoriaPadre === null || !mapa.has(nodo.idCategoriaPadre)) {
      raices.push(mapa.get(nodo.idCategoria)!);
    }
  }
  for (const nodo of mapa.values()) {
    nodo.subcategorias.sort((a, b) => a.orden - b.orden);
  }
  return raices.sort((a, b) => a.orden - b.orden);
};

// Localiza un nodo por id dentro del lote y lo devuelve con su subárbol ya anidado.
const extraerSubarbol = <T extends FilaCategoria>(nodos: T[], idObjetivo: number): NodoArbol<T> | null => {
  return mapearNodos(nodos).get(idObjetivo) ?? null;
};

// Todas las categorías (activas e inactivas) como raíces con subárbol completo (admin)
export const findAll = async () => {
  const categorias = await prisma.categoria.findMany({ orderBy: { orden: 'asc' } });
  return construirArbol(categorias);
};

// Categorías raíz activas con su subárbol activo completo (catálogo público)
export const findRaiz = async () => {
  const categorias = await prisma.categoria.findMany({
    where: { estado: 'Activo' },
    orderBy: { orden: 'asc' },
  });
  return construirArbol(categorias);
};

export const findById = (idCategoria: number | string) => {
  return prisma.categoria.findUnique({ where: { idCategoria: Number(idCategoria) } });
};

export const findByIdConHijos = async (idCategoria: number | string) => {
  const categorias = await prisma.categoria.findMany({ orderBy: { orden: 'asc' } });
  return extraerSubarbol(categorias, Number(idCategoria));
};

export const findBySlug = async (slug: string) => {
  const categorias = await prisma.categoria.findMany({ orderBy: { orden: 'asc' } });
  const objetivo = categorias.find((categoria) => categoria.slug === slug);
  if (!objetivo) return null;
  return extraerSubarbol(categorias, objetivo.idCategoria);
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
