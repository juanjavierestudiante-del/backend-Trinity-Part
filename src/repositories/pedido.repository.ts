import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

const includeDetalles = {
  items: {
    include: {
      variante: {
        include: {
          producto: true,
        },
      },
    },
  },
} satisfies Prisma.PedidoInclude;

export const create = (idUsuario: number, total: number, items: { idVariante: number; cantidad: number; precioUnitario: number }[]) => {
  return prisma.pedido.create({
    data: {
      idUsuario,
      total,
      estado: 'pendiente',
      items: {
        create: items.map((item) => ({
          idVariante: item.idVariante,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
        })),
      },
    },
    include: includeDetalles,
  });
};

export const findByUsuario = (idUsuario: number) => {
  return prisma.pedido.findMany({
    where: { idUsuario },
    include: includeDetalles,
    orderBy: { fechaCreacion: 'desc' },
  });
};

export const findCarritoWithItems = (idUsuario: number) => {
  return prisma.carrito.findUnique({
    where: { idUsuario },
    include: {
      items: {
        include: {
          variante: {
            include: {
              inventario: true,
            },
          },
        },
      },
    },
  });
};
