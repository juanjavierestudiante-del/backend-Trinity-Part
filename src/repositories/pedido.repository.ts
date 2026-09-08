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

export const create = (
  idUsuario: number,
  total: number,
  items: { idVariante: number; cantidad: number; precioUnitario: number }[],
  contacto: { nombreContacto: string; telefonoContacto: string; direccionEntrega?: string | null; notas?: string | null }
) => {
  return prisma.pedido.create({
    data: {
      idUsuario,
      total,
      estado: EstadoPedido.PENDIENTE,
      nombreContacto: contacto.nombreContacto,
      telefonoContacto: contacto.telefonoContacto,
      direccionEntrega: contacto.direccionEntrega ?? null,
      notas: contacto.notas ?? null,
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