import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

const idsOrdenados = (ids: number[]) => [...new Set(ids)].sort((a, b) => a - b);

/** Protege la asignación idPerfilPrecio mientras se descubre y bloquea el perfil. */
export const bloquearVariantesParaVenta = async (ids: number[], db: Prisma.TransactionClient) => {
  const idsUnicos = idsOrdenados(ids);
  if (!idsUnicos.length) return;
  await db.$queryRaw`SELECT id_variante FROM producto_variante
    WHERE id_variante IN (${Prisma.join(idsUnicos)}) ORDER BY id_variante ASC FOR SHARE`;
};

/** Descubrimiento de IDs únicamente: todavía no se resuelven precios. */
export const obtenerIdsPerfilesEfectivos = async (ids: number[], db: Prisma.TransactionClient) => {
  const idsUnicos = idsOrdenados(ids);
  if (!idsUnicos.length) return [];
  return db.$queryRaw<Array<{ idPerfilPrecio: number | null }>>`
    SELECT DISTINCT COALESCE(v.id_perfil_precio, p.id_perfil_precio) AS "idPerfilPrecio"
    FROM producto_variante v LEFT JOIN perfil_precio p
      ON p.id_producto=v.id_producto AND p.principal AND p.activo
    WHERE v.id_variante IN (${Prisma.join(idsUnicos)})`;
};

export const bloquearPerfilesParaVenta = async (ids: number[], db: Prisma.TransactionClient) => {
  const idsUnicos = idsOrdenados(ids);
  if (!idsUnicos.length) return;
  await db.$queryRaw`SELECT id_perfil_precio FROM perfil_precio
    WHERE id_perfil_precio IN (${Prisma.join(idsUnicos)}) ORDER BY id_perfil_precio ASC FOR SHARE`;
};

export const bloquearListasParaVenta = async (ids: number[], db: Prisma.TransactionClient) => {
  const idsUnicos = idsOrdenados(ids);
  if (!idsUnicos.length) return;
  await db.$queryRaw`SELECT id_lista_precio FROM lista_precio
    WHERE id_lista_precio IN (${Prisma.join(idsUnicos)}) ORDER BY id_lista_precio ASC FOR SHARE`;
};

/** Se bloquean también las reglas inactivas, para impedir su activación concurrente. */
export const bloquearReglasParaVenta = async (idsListas: number[], db: Prisma.TransactionClient) => {
  const idsUnicos = idsOrdenados(idsListas);
  if (!idsUnicos.length) return;
  await db.$queryRaw`SELECT id_regla_precio FROM regla_precio_cantidad
    WHERE id_lista_precio IN (${Prisma.join(idsUnicos)}) ORDER BY id_regla_precio ASC FOR SHARE`;
};

/** Contrato obligatorio para TODA escritura CREATE/UPDATE/DELETE de reglas.
 * Adquirir este lock ANTES de leer/modificar reglas, en la MISMA transacción.
 * NO KEY UPDATE entra en conflicto con SHARE del checkout: protege incluso INSERT.
 * La FK sola (KEY SHARE) NO ofrece esta protección. SQL externo debe respetar el contrato.
 */
export const bloquearListasParaEscrituraReglas = async (ids: number[], db: Prisma.TransactionClient) => {
  const idsUnicos = idsOrdenados(ids);
  if (!idsUnicos.length) return;
  await db.$queryRaw`SELECT id_lista_precio FROM lista_precio
    WHERE id_lista_precio IN (${Prisma.join(idsUnicos)}) ORDER BY id_lista_precio ASC FOR NO KEY UPDATE`;
};

/** Mantiene nombre, actividad y cantidadBase estables hasta terminar el checkout.
 * SHARE bloquea UPDATE de columnas no clave, que KEY SHARE permitiría.
 * Los checkouts pueden compartir estas filas; los IDs se bloquean en orden estable.
 */
export const bloquearPresentacionesParaVenta = async (ids: number[], db: Prisma.TransactionClient) => {
  const ordenados = idsOrdenados(ids);
  if (!ordenados.length) return;
  await db.$queryRaw`SELECT id_presentacion FROM presentacion_venta
    WHERE id_presentacion IN (${Prisma.join(ordenados)})
    ORDER BY id_presentacion ASC FOR SHARE`;
};

const seleccionPerfil = { idPerfilPrecio: true, idProducto: true, nombre: true, principal: true, activo: true } as const;

/** Carga identidad y candidatos del mismo producto; no consulta campos de precio legacy. */
export const obtenerVarianteComercial = (
  idVariante: number,
  idPresentacion?: number,
  db: Prisma.TransactionClient = prisma
) => db.productoVariante.findUnique({
  where: { idVariante },
  select: {
    idVariante: true, idProducto: true, estado: true, idPerfilPrecio: true,
    perfilPrecio: { select: seleccionPerfil },
    producto: {
      select: {
        idProducto: true, estado: true,
        presentaciones: {
          where: idPresentacion === undefined ? { principal: true, activo: true } : { idPresentacion },
          select: { idPresentacion: true, idProducto: true, nombre: true, cantidadBase: true, principal: true, activo: true },
          take: 2,
        },
        perfilesPrecio: { where: { principal: true, activo: true }, select: seleccionPerfil, take: 2 },
      },
    },
  },
});

/** Una segunda lectura exacta incluye las reglas para evitar queries posteriores por cantidad. */
export const obtenerListasComerciales = (
  idProducto: number,
  idPresentacion: number,
  idPerfilPrecio: number,
  db: Prisma.TransactionClient = prisma
) => db.listaPrecio.findMany({
  where: { idProducto, idPresentacion, idPerfilPrecio, activo: true },
  take: 2,
  select: {
    idListaPrecio: true, nombre: true,
    reglas: {
      select: { idReglaPrecio: true, nombre: true, cantidadMinima: true, precioPorPresentacion: true, principal: true, activo: true, orden: true },
    },
  },
});

export const obtenerVariantesComerciales = (ids: number[], db: Prisma.TransactionClient = prisma) => db.productoVariante.findMany({
  where: { idVariante: { in: [...new Set(ids)] } },
  select: {
    idVariante: true, idProducto: true, estado: true, idPerfilPrecio: true,
    perfilPrecio: { select: seleccionPerfil },
    producto: { select: { idProducto: true, estado: true,
      presentaciones: { select: { idPresentacion: true, idProducto: true, nombre: true, cantidadBase: true, principal: true, activo: true } },
      perfilesPrecio: { where: { principal: true, activo: true }, select: seleccionPerfil, take: 2 },
    } },
  },
});
export const obtenerListasComercialesEnLote = (identidades: { idProducto: number; presentacion: { idPresentacion: number }; perfilPrecio: { idPerfilPrecio: number } }[], db: Prisma.TransactionClient = prisma) => db.listaPrecio.findMany({
  where: { activo: true, OR: identidades.map(i => ({ idProducto: i.idProducto, idPresentacion: i.presentacion.idPresentacion, idPerfilPrecio: i.perfilPrecio.idPerfilPrecio })) },
  select: { idListaPrecio: true, idProducto: true, idPresentacion: true, idPerfilPrecio: true, nombre: true,
    reglas: { select: { idReglaPrecio: true, nombre: true, cantidadMinima: true, precioPorPresentacion: true, principal: true, activo: true, orden: true } },
  },
});

export const obtenerIdsListasComerciales = (identidades: { idProducto: number; presentacion: { idPresentacion: number }; perfilPrecio: { idPerfilPrecio: number } }[], db: Prisma.TransactionClient) => {
  if (!identidades.length) return Promise.resolve([]);
  return db.listaPrecio.findMany({
    where: { activo: true, OR: identidades.map(i => ({ idProducto: i.idProducto, idPresentacion: i.presentacion.idPresentacion, idPerfilPrecio: i.perfilPrecio.idPerfilPrecio })) },
    select: { idListaPrecio: true, idProducto: true, idPresentacion: true, idPerfilPrecio: true },
  });
};

/** Revalidación de identidad exclusiva de checkout, después de proteger perfiles.
 * Conserva candidatos principales (hasta dos), perfil explícito y todas las presentaciones;
 * las mismas validaciones de dominio siguen rechazando configuraciones inválidas.
 */
export const obtenerVariantesComercialesParaCheckout = async (ids: number[], db: Prisma.TransactionClient) => {
  const unicos = idsOrdenados(ids);
  if (!unicos.length) return [];
  return db.$queryRaw<Awaited<ReturnType<typeof obtenerVariantesComerciales>>>`
    SELECT v.id_variante AS "idVariante", v.id_producto AS "idProducto", v.estado::text AS estado,
      v.id_perfil_precio AS "idPerfilPrecio",
      CASE WHEN explicito.id_perfil_precio IS NULL THEN NULL ELSE jsonb_build_object(
        'idPerfilPrecio', explicito.id_perfil_precio, 'idProducto', explicito.id_producto,
        'nombre', explicito.nombre, 'principal', explicito.principal, 'activo', explicito.activo) END AS "perfilPrecio",
      jsonb_build_object('idProducto', p.id_producto, 'estado', p.estado::text,
        'presentaciones', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'idPresentacion', pv.id_presentacion, 'idProducto', pv.id_producto, 'nombre', pv.nombre,
          'cantidadBase', pv.cantidad_base, 'principal', pv.principal, 'activo', pv.activo) ORDER BY pv.id_presentacion)
          FROM presentacion_venta pv WHERE pv.id_producto=p.id_producto), '[]'::jsonb),
        'perfilesPrecio', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'idPerfilPrecio', principal.id_perfil_precio, 'idProducto', principal.id_producto,
          'nombre', principal.nombre, 'principal', principal.principal, 'activo', principal.activo))
          FROM (SELECT pp.* FROM perfil_precio pp WHERE pp.id_producto=p.id_producto AND pp.principal AND pp.activo
            ORDER BY pp.id_perfil_precio LIMIT 2) principal), '[]'::jsonb)) AS producto
    FROM producto_variante v JOIN producto p ON p.id_producto=v.id_producto
      LEFT JOIN perfil_precio explicito ON explicito.id_perfil_precio=v.id_perfil_precio
    WHERE v.id_variante IN (${Prisma.join(unicos)}) ORDER BY v.id_variante`;
};

/** Lectura definitiva después de SHARE sobre listas/reglas. Decimal via texto, sin float. */
export const obtenerListasComercialesParaCheckout = async (
  identidades: { idProducto: number; presentacion: { idPresentacion: number }; perfilPrecio: { idPerfilPrecio: number } }[],
  db: Prisma.TransactionClient
) => {
  if (!identidades.length) return [];
  type Lista = Awaited<ReturnType<typeof obtenerListasComercialesEnLote>>[number];
  type Fila = Omit<Lista, 'reglas'> & { reglas: (Omit<Lista['reglas'][number], 'precioPorPresentacion'> & { precioPorPresentacion: string })[] };
  const rows = await db.$queryRaw<Fila[]>`
    SELECT l.id_lista_precio AS "idListaPrecio", l.id_producto AS "idProducto",
      l.id_presentacion AS "idPresentacion", l.id_perfil_precio AS "idPerfilPrecio", l.nombre,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'idReglaPrecio', r.id_regla_precio, 'nombre', r.nombre, 'cantidadMinima', r.cantidad_minima,
        'precioPorPresentacion', r.precio_por_presentacion::text, 'principal', r.principal,
        'activo', r.activo, 'orden', r.orden) ORDER BY r.id_regla_precio)
        FROM regla_precio_cantidad r WHERE r.id_lista_precio=l.id_lista_precio), '[]'::jsonb) AS reglas
    FROM lista_precio l WHERE l.activo AND (l.id_producto,l.id_presentacion,l.id_perfil_precio) IN (
      ${Prisma.join(identidades.map(i => Prisma.sql`(${i.idProducto},${i.presentacion.idPresentacion},${i.perfilPrecio.idPerfilPrecio})`))})
    ORDER BY l.id_lista_precio`;
  return rows.map(row => ({ ...row, reglas: row.reglas.map(r => ({ ...r, precioPorPresentacion: new Prisma.Decimal(r.precioPorPresentacion) })) }));
};
