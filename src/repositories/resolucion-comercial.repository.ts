import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

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
