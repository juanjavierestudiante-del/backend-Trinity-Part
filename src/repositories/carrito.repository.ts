import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

const includeCompleto = {
  items: {
    include: {
      variante: {
        include: {
          producto: true,
          imagenes: { orderBy: { ordenImagen: 'asc' } },
          inventario: true,
        },
      },
    },
  },
} satisfies Prisma.CarritoInclude;

export const findOrCreateByUsuario = async (idUsuario: number) => {
  let carrito = await prisma.carrito.findUnique({
    where: { idUsuario },
    include: includeCompleto,
  });

  if (!carrito) {
    carrito = await prisma.carrito.create({
      data: { idUsuario },
      include: includeCompleto,
    });
  }

  return carrito;
};

export const findItemById = (idDetalle: number) => {
  return prisma.carritoDetalle.findUnique({ where: { idDetalle } });
};

export const upsertItem = (idCarrito: number, idVariante: number, cantidad: number) => {
  return prisma.carritoDetalle.upsert({
    where: { idCarrito_idVariante: { idCarrito, idVariante } },
    update: { cantidad: { increment: cantidad } },
    create: { idCarrito, idVariante, cantidad },
  });
};

export const updateItemCantidad = (idDetalle: number, cantidad: number) => {
  return prisma.carritoDetalle.update({
    where: { idDetalle },
    data: { cantidad },
  });
};

export const deleteItem = (idDetalle: number) => {
  return prisma.carritoDetalle.delete({ where: { idDetalle } });
};

export const clearItems = (idCarrito: number) => {
  return prisma.carritoDetalle.deleteMany({ where: { idCarrito } });
};
