import prisma from '../config/prisma.js';
import * as pedidoRepository from '../repositories/pedido.repository.js';
import { AppError } from '../utils/helpers.js';
import { EstadoPedido, MetodoEntrega, Prisma, type TipoPuntoEntrega } from '@prisma/client';
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

type VarianteParaSnapshot = {
  sku: string | null;
  producto?: {
    nombre: string | null;
    idAtributoPrincipal: number | null;
  } | null;
  varianteAtributo?: {
    valorAtributo: {
      idAtributo: number;
      valor: string;
      atributo: { nombre: string };
    };
  }[];
};

const resolverSnapshotsDetalle = (variante: VarianteParaSnapshot) => {
  const producto = variante.producto;
  const idPrincipal = producto?.idAtributoPrincipal ?? null;

  let nombreAtributoPrincipalSnapshot: string | null = null;
  let valorAtributoPrincipalSnapshot: string | null = null;

  if (idPrincipal != null && variante.varianteAtributo) {
    const match = variante.varianteAtributo.find(
      (va) => va.valorAtributo.idAtributo === idPrincipal
    );
    if (match) {
      nombreAtributoPrincipalSnapshot = match.valorAtributo.atributo.nombre;
      valorAtributoPrincipalSnapshot = match.valorAtributo.valor;
    }
  }

  return {
    nombreProductoSnapshot: producto?.nombre ?? null,
    skuSnapshot: variante.sku ?? null,
    nombreAtributoPrincipalSnapshot,
    valorAtributoPrincipalSnapshot,
  };
};

export const crear = async (idUsuario: number, input: CrearPedidoInput) => {
  return prisma.$transaction(
    async (tx) => {
      const carrito = await tx.carrito.findUnique({
        where: { idUsuario },
        include: {
          items: {
            include: {
              variante: {
                select: {
                  sku: true,
                  producto: {
                    select: {
                      nombre: true,
                      idAtributoPrincipal: true,
                    },
                  },
                  varianteAtributo: {
                    select: {
                      valorAtributo: {
                        select: {
                          idAtributo: true,
                          valor: true,
                          atributo: {
                            select: {
                              nombre: true,
                            },
                          },
                        },
                      },
                    },
                  },
                  inventario: true,
                },
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
        ...resolverSnapshotsDetalle(item.variante),
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
              nombreProductoSnapshot: item.nombreProductoSnapshot,
              skuSnapshot: item.skuSnapshot,
              nombreAtributoPrincipalSnapshot: item.nombreAtributoPrincipalSnapshot,
              valorAtributoPrincipalSnapshot: item.valorAtributoPrincipalSnapshot,
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

const TRANSICIONES_PERMITIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  PENDIENTE: [EstadoPedido.CONFIRMADO, EstadoPedido.CANCELADO],
  CONFIRMADO: [EstadoPedido.CANCELADO],
  CANCELADO: [],
};

// Devuelve stock de forma atómica (increment) para cada variante del pedido y
// registra un movimiento de Entrada coherente con el valor real posterior a la
// transacción. Agrupa cantidades por idVariante por si una variante apareciera
// en más de una línea del pedido: se restaura una sola vez y se genera un único
// movimiento.
const devolverInventarioTx = async (
  tx: Prisma.TransactionClient,
  idPedido: number,
  items: { idVariante: number; cantidad: number }[]
) => {
  const cantidadesPorVariante = new Map<number, number>();
  for (const item of items) {
    cantidadesPorVariante.set(
      item.idVariante,
      (cantidadesPorVariante.get(item.idVariante) ?? 0) + item.cantidad
    );
  }

  for (const [idVariante, cantidad] of cantidadesPorVariante) {
    const actualizado = await tx.inventario.update({
      where: { idVariante },
      data: { stockActual: { increment: cantidad } },
      select: { stockActual: true },
    });

    await tx.movimientoInventario.create({
      data: {
        idVariante,
        tipo: 'Entrada',
        cantidad,
        stockAnterior: actualizado.stockActual - cantidad,
        stockNuevo: actualizado.stockActual,
        motivo: `Cancelación Pedido #${idPedido}`,
        idUsuario: null,
      },
    });
  }
};

export const cambiarEstado = async (idPedido: number, estado: EstadoPedido) => {
  return prisma.$transaction(
    async (tx) => {
      const actual = await tx.pedido.findUnique({
        where: { idPedido },
        select: {
          idPedido: true,
          estado: true,
          items: { select: { idVariante: true, cantidad: true } },
        },
      });

      if (!actual) {
        throw new AppError('Pedido no encontrado', 404);
      }

      if (actual.estado === estado) {
        return pedidoRepository.findByIdEnTx(tx, idPedido);
      }

      if (!TRANSICIONES_PERMITIDAS[actual.estado].includes(estado)) {
        throw new AppError(
          `No se puede cambiar un pedido ${actual.estado} a ${estado}.`,
          409
        );
      }

      const gate = await tx.pedido.updateMany({
        where: { idPedido, estado: actual.estado },
        data: { estado },
      });

      if (gate.count === 0) {
        const persistido = await tx.pedido.findUnique({
          where: { idPedido },
          select: { estado: true },
        });

        if (persistido?.estado === estado) {
          return pedidoRepository.findByIdEnTx(tx, idPedido);
        }

        throw new AppError(
          `El pedido fue modificado simultáneamente por otro usuario. Estado actual: ${persistido?.estado ?? 'desconocido'}.`,
          409
        );
      }

      if (estado === EstadoPedido.CANCELADO) {
        await devolverInventarioTx(tx, idPedido, actual.items);
      }

      return pedidoRepository.findByIdEnTx(tx, idPedido);
    },
    { timeout: 15000, maxWait: 15000 }
  );
};
