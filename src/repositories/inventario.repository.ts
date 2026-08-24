// Capa de acceso a datos para Inventario.

import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

export const findByVariante = (idVariante: number | string) => {
  return prisma.inventario.findUnique({ where: { idVariante: Number(idVariante) } });
};

export const upsert = (idVariante: number | string, data: Prisma.InventarioUpdateInput) => {
  return prisma.inventario.upsert({
    where: { idVariante: Number(idVariante) },
    update: data,
    create: { variante: { connect: { idVariante: Number(idVariante) } }, stockActual: 0, stockMinimo: 0 },
  });
};

interface BajoStockRow {
  id_inventario: number;
  id_variante: number;
  stock_actual: number;
  stock_minimo: number;
  stock_maximo: number | null;
  sku: string;
  id_producto: number;
}

// Productos con stock por debajo del mínimo (útil para alertas en el admin)
export const findBajoStock = () => {
  return prisma.$queryRaw<BajoStockRow[]>`
    SELECT i.*, pv.sku, pv.id_producto
    FROM inventario i
    JOIN producto_variante pv ON pv.id_variante = i.id_variante
    WHERE i.stock_actual <= i.stock_minimo
  `;
};
