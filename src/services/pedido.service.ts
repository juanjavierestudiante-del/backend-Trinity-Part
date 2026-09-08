import prisma from '../config/prisma.js';
import * as pedidoRepository from '../repositories/pedido.repository.js';
import { AppError } from '../utils/helpers.js';
import type { EstadoPedido } from '@prisma/client';
import type { CrearPedidoInput } from '../validations/pedido.validation.js';

export const crear = async (idUsuario: number, input: CrearPedidoInput) => {
  return prisma.$transaction(
    async (tx) => {
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
          estado: 'PENDIENTE',
          nombreContacto: input.nombreContacto,
          telefonoContacto: input.telefonoContacto,
          direccionEntrega: input.direccionEntrega ?? null,
          notas: input.notas ?? null,
          items: {
            create: itemsConPrecio.map((item) => ({
              idVariante: item.idVariante,
              cantidad: item.cantidad,
              precioUnitario: item.precioUnitario,
            })),
          },
        },
      });

      const descuentos = await Promise.all(
        carrito.items.map(async (item) => {
          const stockAnterior = item.variante.inventario?.stockActual ?? 0;
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

          return {
            idVariante: item.idVariante,
            cantidad: item.cantidad,
            stockAnterior,
            stockNuevo: stockAnterior - item.cantidad,
          };
        })
      );

      await tx.movimientoInventario.createMany({
        data: descuentos.map((d) => ({
          idVariante: d.idVariante,
          tipo: 'Salida',
          cantidad: d.cantidad,
          stockAnterior: d.stockAnterior,
          stockNuevo: d.stockNuevo,
          motivo: `Pedido #${pedido.idPedido}`,
          idUsuario,
        })),
      });

      await tx.carritoDetalle.deleteMany({
        where: { idCarrito: carrito.idCarrito },
      });

      return pedido;
    },
    { timeout: 15000, maxWait: 15000 }
  );
};

export const listarPorUsuario = async (idUsuario: number) => {
  return pedidoRepository.findByUsuario(idUsuario);
};

export const listarTodos = async (page = 1, limit = 20) => {
  return pedidoRepository.findAll(page, limit);
};

export const cambiarEstado = async (idPedido: number, estado: EstadoPedido) => {
  const existe = await pedidoRepository.findById(idPedido);
  if (!existe) {
    throw new AppError('Pedido no encontrado', 404);
  }

  return pedidoRepository.updateEstado(idPedido, estado);
};