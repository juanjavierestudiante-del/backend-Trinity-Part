import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

export interface CarritoItemView {
  idDetalle: number;
  idVariante: number;
  cantidad: number;
  stock: number;
  sku: string;
  producto: { idProducto: number; nombre: string; slug: string; imagen: string | null };
}

export interface CarritoView {
  idCarrito: number;
  items: CarritoItemView[];
  totalItems: number;
}

type CarritoRow = {
  idCarrito: number;
  idDetalle: number | null;
  idVariante: number | null;
  cantidad: number | null;
  stock: number | null;
  sku: string | null;
  idProducto: number | null;
  nombre: string | null;
  slug: string | null;
  imagen: string | null;
};

type MutationRow = {
  estado: 'ACTUALIZADO' | 'ELIMINADO' | 'NO_ENCONTRADO' | 'STOCK_INSUFICIENTE';
  idDetalle: number | null;
  idVariante: number | null;
  cantidad: number | null;
};

type AgregarItemRow = { idDetalle: number; idCarrito: number; idVariante: number; cantidad: number };

export const obtenerVistaPorUsuario = async (idUsuario: number): Promise<CarritoView> => {
  const rows = await prisma.$queryRaw<CarritoRow[]>`
    WITH carrito_usuario AS (
      INSERT INTO "carrito" ("id_usuario")
      VALUES (${idUsuario})
      ON CONFLICT ("id_usuario") DO NOTHING
      RETURNING "id_carrito"
    ), carrito_resuelto AS (
      SELECT "id_carrito" FROM carrito_usuario
      UNION ALL
      SELECT c."id_carrito" FROM "carrito" c
      WHERE c."id_usuario" = ${idUsuario}
        AND NOT EXISTS (SELECT 1 FROM carrito_usuario)
      LIMIT 1
    )
    SELECT
      cr."id_carrito" AS "idCarrito",
      cd."id_detalle" AS "idDetalle",
      cd."id_variante" AS "idVariante",
      cd."cantidad",
      COALESCE(inv."stock_actual", 0) AS stock,
      pv.sku,
      p."id_producto" AS "idProducto",
      p.nombre,
      p.slug,
      COALESCE(imagen_variante.url, imagen_producto.url) AS imagen
    FROM carrito_resuelto cr
    LEFT JOIN "carrito_detalle" cd ON cd."id_carrito" = cr."id_carrito"
    LEFT JOIN "producto_variante" pv ON pv."id_variante" = cd."id_variante"
    LEFT JOIN "producto" p ON p."id_producto" = pv."id_producto"
    LEFT JOIN "inventario" inv ON inv."id_variante" = pv."id_variante"
    LEFT JOIN LATERAL (
      SELECT iv.url FROM "imagen_variante" iv
      WHERE iv."id_variante" = pv."id_variante"
      ORDER BY iv.principal DESC, iv."orden_imagen" ASC, iv."id_imagen" ASC
      LIMIT 1
    ) imagen_variante ON true
    LEFT JOIN LATERAL (
      SELECT ip.url FROM "imagen_producto" ip
      WHERE ip."id_producto" = p."id_producto"
      ORDER BY ip.principal DESC, ip."orden_imagen" ASC, ip."id_imagen" ASC
      LIMIT 1
    ) imagen_producto ON true
    ORDER BY cd."id_detalle" ASC
  `;

  const idCarrito = rows[0]?.idCarrito;
  if (!idCarrito) throw new Error('No se pudo resolver el carrito');
  const items = rows.flatMap((row): CarritoItemView[] => row.idDetalle === null || row.idVariante === null || row.cantidad === null || row.stock === null || row.sku === null || row.idProducto === null || row.nombre === null || row.slug === null
    ? []
    : [{
        idDetalle: row.idDetalle,
        idVariante: row.idVariante,
        cantidad: row.cantidad,
        stock: row.stock,
        sku: row.sku,
        producto: { idProducto: row.idProducto, nombre: row.nombre, slug: row.slug, imagen: row.imagen },
      }]);
  return { idCarrito, items, totalItems: items.length };
};

export const agregarItemAtomico = (idUsuario: number, idVariante: number, cantidad: number) =>
  prisma.$queryRaw<AgregarItemRow[]>`SELECT * FROM agregar_item_carrito(${idUsuario}::integer, ${idVariante}::integer, ${cantidad}::integer)`;

export const actualizarCantidadPropia = async (idUsuario: number, idDetalle: number, cantidad: number) => {
  const [result] = await prisma.$queryRaw<MutationRow[]>`
    WITH objetivo AS (
      SELECT cd."id_detalle", cd."id_variante", COALESCE(i."stock_actual", 0) AS stock
      FROM "carrito_detalle" cd
      INNER JOIN "carrito" c ON c."id_carrito" = cd."id_carrito"
      LEFT JOIN "inventario" i ON i."id_variante" = cd."id_variante"
      WHERE cd."id_detalle" = ${idDetalle} AND c."id_usuario" = ${idUsuario}
    ), actualizado AS (
      UPDATE "carrito_detalle" cd
      SET "cantidad" = ${cantidad}
      FROM objetivo o
      WHERE cd."id_detalle" = o."id_detalle" AND o.stock >= ${cantidad}
      RETURNING cd."id_detalle" AS "idDetalle", cd."id_variante" AS "idVariante", cd."cantidad"
    )
    SELECT
      CASE
        WHEN EXISTS (SELECT 1 FROM actualizado) THEN 'ACTUALIZADO'
        WHEN EXISTS (SELECT 1 FROM objetivo) THEN 'STOCK_INSUFICIENTE'
        ELSE 'NO_ENCONTRADO'
      END AS estado,
      (SELECT "idDetalle" FROM actualizado) AS "idDetalle",
      (SELECT "idVariante" FROM actualizado) AS "idVariante",
      (SELECT cantidad FROM actualizado) AS cantidad
  `;
  return result;
};

export const eliminarItemPropio = async (idUsuario: number, idDetalle: number) => {
  const [result] = await prisma.$queryRaw<MutationRow[]>`
    WITH eliminado AS (
      DELETE FROM "carrito_detalle" cd
      USING "carrito" c
      WHERE cd."id_detalle" = ${idDetalle}
        AND cd."id_carrito" = c."id_carrito"
        AND c."id_usuario" = ${idUsuario}
      RETURNING cd."id_detalle" AS "idDetalle", cd."id_variante" AS "idVariante", cd.cantidad
    )
    SELECT
      CASE WHEN EXISTS (SELECT 1 FROM eliminado) THEN 'ELIMINADO' ELSE 'NO_ENCONTRADO' END AS estado,
      (SELECT "idDetalle" FROM eliminado) AS "idDetalle",
      (SELECT "idVariante" FROM eliminado) AS "idVariante",
      (SELECT cantidad FROM eliminado) AS cantidad
  `;
  return result;
};

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
    try {
      carrito = await prisma.carrito.create({
        data: { idUsuario },
        include: includeCompleto,
      });
    } catch (error) {
      // Dos primeras lecturas concurrentes pueden intentar crear el mismo
      // carrito por la restricción única de idUsuario. Sólo se reintenta ese
      // conflicto conocido; cualquier otro error de Prisma se propaga.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }
      carrito = await prisma.carrito.findUnique({
        where: { idUsuario },
        include: includeCompleto,
      });
    }
  }

  return carrito;
};

// Las mutaciones sólo necesitan la clave del carrito. Evitar el include del
// detalle completo aquí impide cargar productos, imágenes e inventario antes
// de cada alta, cambio de cantidad o eliminación.
export const findOrCreateIdByUsuario = (idUsuario: number) => {
  return prisma.carrito.upsert({
    where: { idUsuario },
    update: {},
    create: { idUsuario },
    select: { idCarrito: true },
  });
};

export const findIdByUsuario = (idUsuario: number) => {
  return prisma.carrito.findUnique({
    where: { idUsuario },
    select: { idCarrito: true },
  });
};

// El badge representa líneas/variantes distintas, no presentaciones.
export const contarItems = async (idUsuario: number): Promise<number> => {
  const res = await prisma.carritoDetalle.aggregate({
    where: { carrito: { idUsuario } },
    _count: { idDetalle: true },
  });
  return res._count.idDetalle;
};

export const findItemById = (idDetalle: number) => {
  return prisma.carritoDetalle.findUnique({ where: { idDetalle } });
};

export const findItemByCarritoYVariante = (idCarrito: number, idVariante: number) => {
  return prisma.carritoDetalle.findUnique({
    where: { idCarrito_idVariante: { idCarrito, idVariante } },
  });
};

export const findVarianteConInventario = (idVariante: number) => {
  return prisma.productoVariante.findUnique({
    where: { idVariante },
    select: {
      idVariante: true,
      inventario: { select: { stockActual: true } },
    },
  });
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
