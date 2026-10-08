import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

export type CarritoParaCheckout = {
  idCarrito: number;
  items: {
    idVariante: number; idPresentacion: number; cantidad: number;
    variante: { sku: string | null; producto: { nombre: string; idAtributoPrincipal: number | null };
      varianteAtributo: { valorAtributo: { idAtributo: number; valor: string; atributo: { nombre: string } } }[] };
  }[];
};

/** Sólo checkout: mismo snapshot inicial, sin stock no autoritativo ni queries por relación.
 * El coordinador ya mantiene FOR UPDATE sobre carrito. No sustituye los locks comerciales.
 */
export const obtenerCarritoParaCheckout = async (idUsuario: number, tx: Prisma.TransactionClient) => {
  const rows = await tx.$queryRaw<CarritoParaCheckout[]>`
    SELECT c.id_carrito AS "idCarrito", COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'idVariante', d.id_variante, 'idPresentacion', d.id_presentacion, 'cantidad', d.cantidad,
        'variante', jsonb_build_object('sku', v.sku,
          'producto', jsonb_build_object('nombre', p.nombre, 'idAtributoPrincipal', p.id_atributo_principal),
          'varianteAtributo', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'valorAtributo', jsonb_build_object('idAtributo', va.id_atributo, 'valor', va.valor,
              'atributo', jsonb_build_object('nombre', a.nombre))))
            FROM variante_atributo rel JOIN valor_atributo va ON va.id_valor=rel.id_valor
              JOIN atributo a ON a.id_atributo=va.id_atributo WHERE rel.id_variante=v.id_variante), '[]'::jsonb)))
        ORDER BY d.id_detalle)
      FROM carrito_detalle d JOIN producto_variante v ON v.id_variante=d.id_variante
        JOIN producto p ON p.id_producto=v.id_producto WHERE d.id_carrito=c.id_carrito
    ), '[]'::jsonb) AS items FROM carrito c WHERE c.id_usuario=${idUsuario}`;
  return rows[0] ?? null;
};

const includeDetalles = {
  items: {
    include: {
      variante: {
        select: {
          idVariante: true,
          sku: true,
          producto: {
            select: {
              idProducto: true,
              nombre: true,
              idAtributoPrincipal: true,
            },
          },
          varianteAtributo: {
            select: {
              valorAtributo: {
                select: {
                  idValor: true,
                  idAtributo: true,
                  valor: true,
                },
              },
            },
          },
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

export const findByIdEnTx = (tx: Prisma.TransactionClient, idPedido: number) => {
  return tx.pedido.findUnique({
    where: { idPedido },
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
