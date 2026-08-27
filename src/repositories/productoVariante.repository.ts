// Capa de acceso a datos para ProductoVariante.

import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

const includeCompleto = {
  marca: true,
  unidad: true,
  inventario: true,
  imagenes: { orderBy: { ordenImagen: 'asc' } },
  varianteAtributo: { include: { valorAtributo: { include: { atributo: true } } } },
} satisfies Prisma.ProductoVarianteInclude;

export const findByProducto = (idProducto: number | string) => {
  return prisma.productoVariante.findMany({
    where: { idProducto: Number(idProducto) },
    include: includeCompleto,
  });
};

export const findById = (idVariante: number | string) => {
  return prisma.productoVariante.findUnique({
    where: { idVariante: Number(idVariante) },
    include: includeCompleto,
  });
};

export const findBySku = (sku: string) => {
  return prisma.productoVariante.findUnique({ where: { sku } });
};

export const existePorId = async (idVariante: number | string) => {
  const count = await prisma.productoVariante.count({ where: { idVariante: Number(idVariante) } });
  return count > 0;
};

// Crea la variante junto con su registro de inventario (stockActual: 0) en una
// sola transacción, para que ninguna variante exista sin inventario.
export const create = (data: Prisma.ProductoVarianteCreateInput) => {
  return prisma.$transaction(async (tx) => {
    const variante = await tx.productoVariante.create({ data });
    await tx.inventario.create({
      data: { idVariante: variante.idVariante, stockActual: 0, stockMinimo: 0 },
    });
    return tx.productoVariante.findUnique({
      where: { idVariante: variante.idVariante },
      include: includeCompleto,
    });
  });
};

export const update = (idVariante: number | string, data: Prisma.ProductoVarianteUpdateInput) => {
  return prisma.productoVariante.update({
    where: { idVariante: Number(idVariante) },
    data,
    include: includeCompleto,
  });
};

export const remove = (idVariante: number | string) => {
  return prisma.productoVariante.delete({ where: { idVariante: Number(idVariante) } });
};
