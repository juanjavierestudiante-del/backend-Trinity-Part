// Capa de acceso a datos para Producto. Solo queries, sin lógica de negocio.

import { Prisma, EstadoProducto } from '@prisma/client';
import prisma from '../config/prisma.js';

const includeCompleto = {
  categoria: true,
  imagenes: { orderBy: { ordenImagen: 'asc' } },
  variantes: {
    include: {
      marca: true,
      unidad: true,
      inventario: true,
      imagenes: { orderBy: { ordenImagen: 'asc' } },
      varianteAtributo: { include: { valorAtributo: { include: { atributo: true } } } },
    },
  },
} satisfies Prisma.ProductoInclude;

interface FiltrosFindAll {
  estado?: EstadoProducto;
  idsCategorias?: number[];
  busqueda?: string;
}

const buildWhere = ({
  estado,
  idsCategorias,
  busqueda,
}: FiltrosFindAll): Prisma.ProductoWhereInput => ({
  ...(estado ? { estado } : {}),

  // 🔥 NUEVO: ahora filtramos por IDs, no por slug
  ...(idsCategorias?.length
    ? { idCategoria: { in: idsCategorias } }
    : {}),

  ...(busqueda
    ? { nombre: { contains: busqueda, mode: 'insensitive' } }
    : {}),
});

export const findAll = async (
  filtros: FiltrosFindAll,
  page = 1,
  limit = 20
) => {
  const where = buildWhere(filtros);

  const [items, total] = await prisma.$transaction([
    prisma.producto.findMany({
      where,
      include: includeCompleto,
      orderBy: { fechaRegistro: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.producto.count({ where }),
  ]);

  return { items, total };
};

// Variante sin paginar para el listado admin (mantiene el shape de array).
export const findAllSinPaginacion = (filtros: FiltrosFindAll) => {
  return prisma.producto.findMany({
    where: buildWhere(filtros),
    include: includeCompleto,
    orderBy: { fechaRegistro: 'desc' },
  });
};

export const findById = (idProducto: number | string) => {
  return prisma.producto.findUnique({
    where: { idProducto: Number(idProducto) },
    include: includeCompleto,
  });
};

export const findBySlug = (slug: string) => {
  return prisma.producto.findUnique({
    where: { slug },
    include: includeCompleto,
  });
};

export const create = (data: Prisma.ProductoCreateInput) => {
  return prisma.producto.create({ data, include: includeCompleto });
};

export const update = (idProducto: number | string, data: Prisma.ProductoUpdateInput) => {
  return prisma.producto.update({
    where: { idProducto: Number(idProducto) },
    data,
    include: includeCompleto,
  });
};

export const remove = (idProducto: number | string) => {
  return prisma.producto.delete({ where: { idProducto: Number(idProducto) } });
};
