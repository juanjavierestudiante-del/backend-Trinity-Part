import prisma from '../config/prisma.js';
import * as pedidoRepository from '../repositories/pedido.repository.js';
import { AppError } from '../utils/helpers.js';
import { MetodoEntrega, Prisma, type EstadoPedido, type TipoPuntoEntrega } from '@prisma/client';
import type { CrearPedidoInput } from '../validations/pedido.validation.js';
import { normalizarTelefonoBolivia } from '../utils/auth.helpers.js';
import { resolverPreciosAgrupados } from './precio-cantidad.service.js';
import { ErrorPrecioCantidad } from '../types/precio-cantidad.types.js';

const tipoEsperadoPorMetodo: Record<
  Exclude<MetodoEntrega, 'DELIVERY'>,
  TipoPuntoEntrega
> = {
  [MetodoEntrega.PUNTO_ENTREGA]: 'PUNTO_ENTREGA',
  [MetodoEntrega.RECOJO_TIENDA]: 'RECOJO_TIENDA',
};

const esContratoLogistico = (
  input: CrearPedidoInput
): input is Exclude<CrearPedidoInput, { direccionEntrega?: string | null }> =>
  'metodoEntrega' in input;

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

      let precios;
      try {
        precios = await resolverPreciosAgrupados(
          carrito.items.map((item) => ({ idVariante: item.idVariante, cantidad: item.cantidad })),
          tx
        );
      } catch (error) {
        if (error instanceof ErrorPrecioCantidad) {
          throw new AppError('No se pudo resolver el precio actual de los productos del carrito', 409);
        }
        throw error;
      }
      const preciosPorVariante = new Map(precios.lineas.map((linea) => [linea.idVariante, linea.precioPorPresentacion]));
      const itemsConPrecio = carrito.items.map((item) => ({
        idVariante: item.idVariante,
        cantidad: item.cantidad,
        precioUnitario: preciosPorVariante.get(item.idVariante)!,
      }));

      const total = precios.total;

      const telefonoContacto = normalizarTelefonoBolivia(input.telefonoContacto);
      let entrega: Prisma.PedidoUncheckedCreateInput = {
        idUsuario,
        total,
        estado: 'PENDIENTE',
        nombreContacto: input.nombreContacto,
        telefonoContacto,
        notas: input.notas ?? null,
      };

      if (!esContratoLogistico(input)) {
        entrega = {
          ...entrega,
          direccionEntrega: input.direccionEntrega ?? null,
        };
      } else if (input.metodoEntrega === MetodoEntrega.DELIVERY) {
        const configuracion = await tx.configuracionEntrega.upsert({
          where: { id: 1 },
          update: {},
          create: { id: 1, deliveryHabilitado: true, montoMinimoDelivery: 150 },
        });

        if (!configuracion.deliveryHabilitado) {
          throw new AppError('Delivery no está habilitado actualmente', 409);
        }
        if (total.lessThan(configuracion.montoMinimoDelivery)) {
          throw new AppError(
            `Delivery disponible desde Bs ${configuracion.montoMinimoDelivery.toString()}`,
            409
          );
        }

        entrega = {
          ...entrega,
          metodoEntrega: MetodoEntrega.DELIVERY,
          direccionEntrega: input.deliveryDireccion,
          deliveryZona: input.deliveryZona,
          deliveryDireccion: input.deliveryDireccion,
          deliveryReferencia: input.deliveryReferencia ?? null,
        };
      } else {
        const punto = await tx.puntoEntrega.findUnique({
          where: { idPuntoEntrega: input.idPuntoEntrega },
        });
        if (!punto) {
          throw new AppError('Punto de entrega no encontrado', 404);
        }
        if (!punto.activo) {
          throw new AppError('El punto de entrega no está disponible', 409);
        }
        if (punto.tipo !== tipoEsperadoPorMetodo[input.metodoEntrega]) {
          throw new AppError('El punto no corresponde al método de entrega seleccionado', 400);
        }

        entrega = {
          ...entrega,
          metodoEntrega: input.metodoEntrega,
          idPuntoEntrega: punto.idPuntoEntrega,
          puntoEntregaNombre: punto.nombre,
          puntoEntregaReferencia: punto.referencia,
        };
      }

      const pedido = await tx.pedido.create({
        data: {
          ...entrega,
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
