import prisma from '../config/prisma.js';
import * as pedidoRepository from '../repositories/pedido.repository.js';
import { AppError } from '../utils/helpers.js';

export const crear = async (idUsuario: number) => {
  return prisma.$transaction(async (tx) => {
    const carrito = await tx.carrito.findUnique({
      where: { idUsuario },
      include: {
        items: {
          include: {
            variante: {
              include: { inventario: true },
            },
          },
        },
      },
    });

    if (!carrito || carrito.items.length === 0) {
      throw new AppError('El carrito está vacío', 400);
    }

    for (const item of carrito.items) {
      const stock = item.variante.inventario?.stockActual ?? 0;
      if (stock < item.cantidad) {
        throw new AppError(
          `Stock insuficiente para ${item.variante.sku}: disponible ${stock}, solicitado ${item.cantidad}`,
          400
        );
      }
    }

    const itemsConPrecio = carrito.items.map((item) => {
      const precio = item.variante.precioOferta ?? item.variante.precioVenta;
      return {
        idVariante: item.idVariante,
        cantidad: item.cantidad,
        precioUnitario: Number(precio),
      };
    });

    const total = itemsConPrecio.reduce(
      (sum, item) => sum + item.precioUnitario * item.cantidad,
      0
    );

    const pedido = await tx.pedido.create({
      data: {
        idUsuario,
        total,
        estado: 'pendiente',
        items: {
          create: itemsConPrecio.map((item) => ({
            idVariante: item.idVariante,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          })),
        },
      },
    });

    for (const item of carrito.items) {
      const resultado = await tx.inventario.updateMany({
        where: {
          idVariante: item.idVariante,
          stockActual: { gte: item.cantidad },
        },
        data: {
          stockActual: { decrement: item.cantidad },
        },
      });

      if (resultado.count === 0) {
        throw new AppError(
          `Stock insuficiente para ${item.variante.sku} (transacción abortada)`,
          400
        );
      }

      const inventario = await tx.inventario.findUniqueOrThrow({
        where: { idVariante: item.idVariante },
      });

      await tx.movimientoInventario.create({
        data: {
          idVariante: item.idVariante,
          tipo: 'Salida',
          cantidad: item.cantidad,
          stockAnterior: inventario.stockActual + item.cantidad,
          stockNuevo: inventario.stockActual,
          motivo: `Pedido #${pedido.idPedido}`,
          idUsuario,
        },
      });
    }

    await tx.carritoDetalle.deleteMany({
      where: { idCarrito: carrito.idCarrito },
    });

    return pedido;
  });
};

export const listarPorUsuario = async (idUsuario: number) => {
  return pedidoRepository.findByUsuario(idUsuario);
};
