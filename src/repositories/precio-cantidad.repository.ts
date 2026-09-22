import prisma from '../config/prisma.js';
import type { Prisma } from '@prisma/client';
import type { ContextoListaPrecio, ListaPrecioAplicable } from '../types/precio-cantidad.types.js';

const seleccionReglas = { idReglaPrecio: true, nombre: true, cantidadMinima: true, precioPorPresentacion: true, principal: true, activo: true, orden: true } as const;
const convertirLista = (lista: ListaPrecioAplicable | null) => lista;

export const obtenerContextoListaPrecio = async (idVariante: number): Promise<ContextoListaPrecio | null> => {
  const variante = await prisma.productoVariante.findUnique({
    where: { idVariante },
    select: {
      idVariante: true, idProducto: true, idListaPrecio: true,
      listaPrecio: { select: { idListaPrecio: true, idProducto: true, nombre: true, principal: true, activo: true, reglas: { select: seleccionReglas, orderBy: [{ orden: 'asc' }, { idReglaPrecio: 'asc' }] } } },
      producto: { select: { listaPrecios: { where: { principal: true, activo: true }, select: { idListaPrecio: true, idProducto: true, nombre: true, principal: true, activo: true, reglas: { select: seleccionReglas, orderBy: [{ orden: 'asc' }, { idReglaPrecio: 'asc' }] } }, take: 1 } } },
    },
  });
  if (!variante) return null;
  return {
    idVariante: variante.idVariante,
    idProducto: variante.idProducto,
    idListaPrecioAsignada: variante.idListaPrecio,
    listaAsignada: convertirLista(variante.listaPrecio),
    listaPrincipal: convertirLista(variante.producto.listaPrecios[0] ?? null),
  };
};

/**
 * Carga todos los contextos que necesita el pricing de un carrito en un número
 * fijo de queries Prisma. La resolución posterior ocurre enteramente en memoria.
 */
export const obtenerContextosListaPrecio = async (
  idsVariantes: number[],
  db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ContextoListaPrecio[]> => {
  if (idsVariantes.length === 0) return [];
  const variantes = await db.productoVariante.findMany({
    where: { idVariante: { in: idsVariantes } },
    select: { idVariante: true, idProducto: true, idListaPrecio: true },
  });
  const idsProductos = [...new Set(variantes.map((variante) => variante.idProducto))];
  const idsListasAsignadas = [...new Set(variantes.flatMap((variante) => variante.idListaPrecio === null ? [] : [variante.idListaPrecio]))];
  const listas = await db.listaPrecio.findMany({
    where: {
      OR: [
        ...(idsListasAsignadas.length ? [{ idListaPrecio: { in: idsListasAsignadas } }] : []),
        { idProducto: { in: idsProductos }, principal: true, activo: true },
      ],
    },
    select: {
      idListaPrecio: true, idProducto: true, nombre: true, principal: true, activo: true,
      reglas: { select: seleccionReglas, orderBy: [{ orden: 'asc' }, { idReglaPrecio: 'asc' }] },
    },
  });
  const listasPorId = new Map(listas.map((lista) => [lista.idListaPrecio, lista]));
  const principalesPorProducto = new Map(listas.filter((lista) => lista.principal && lista.activo).map((lista) => [lista.idProducto, lista]));
  return variantes.map((variante) => ({
    idVariante: variante.idVariante,
    idProducto: variante.idProducto,
    idListaPrecioAsignada: variante.idListaPrecio,
    listaAsignada: convertirLista(variante.idListaPrecio === null ? null : listasPorId.get(variante.idListaPrecio) ?? null),
    listaPrincipal: convertirLista(principalesPorProducto.get(variante.idProducto) ?? null),
  }));
};
