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

export const findAll = ({
  estado,
  idsCategorias,
  busqueda,
}: {
  estado?: EstadoProducto;
  idsCategorias?: number[];
  busqueda?: string;
}) => {
  const where: Prisma.ProductoWhereInput = {
    ...(estado ? { estado } : {}),

    // 🔥 NUEVO: ahora filtramos por IDs, no por slug
    ...(idsCategorias?.length
      ? { idCategoria: { in: idsCategorias } }
      : {}),

    ...(busqueda
      ? { nombre: { contains: busqueda, mode: 'insensitive' } }
      : {}),
  };

  return prisma.producto.findMany({
    where,
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
