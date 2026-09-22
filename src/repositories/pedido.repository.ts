import { Prisma, EstadoPedido } from '@prisma/client';
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

const includeAdmin = {
  ...includeDetalles,
  usuario: {
    select: {
      id_usuario: true,
      nombre: true,
      email: true,
      rol: true,
    },
  },
} satisfies Prisma.PedidoInclude;

export const findByUsuario = (idUsuario: number) => {
  return prisma.pedido.findMany({
    where: { idUsuario },
    include: includeDetalles,
    orderBy: { fechaCreacion: 'desc' },
  });
};

export const findAll = async (page = 1, limit = 20) => {
  const [items, total] = await prisma.$transaction([
    prisma.pedido.findMany({
      include: includeAdmin,
      orderBy: { fechaCreacion: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pedido.count(),
  ]);

  return { items, total };
};

export const findById = (idPedido: number) => {
  return prisma.pedido.findUnique({
    where: { idPedido },
    include: includeAdmin,
  });
};

export const updateEstado = (idPedido: number, estado: EstadoPedido) => {
  return prisma.pedido.update({
    where: { idPedido },
    data: { estado },
    include: includeAdmin,
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
