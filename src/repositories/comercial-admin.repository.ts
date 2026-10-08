import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { bloquearListasParaEscrituraReglas } from './resolucion-comercial.repository.js';

export type TxComercial = Prisma.TransactionClient;
const seleccion = {
  idProducto: true, nombre: true, idAtributoPrincipal: true,
  presentaciones: { orderBy: [{ orden: 'asc' }, { idPresentacion: 'asc' }], include: { _count: { select: { carritoItems: true } } } },
  perfilesPrecio: { orderBy: [{ orden: 'asc' }, { idPerfilPrecio: 'asc' }] },
  listaPrecios: { orderBy: { idListaPrecio: 'asc' }, include: { reglas: { orderBy: [{ cantidadMinima: 'asc' }, { idReglaPrecio: 'asc' }] } } },
  variantes: { orderBy: { idVariante: 'asc' }, select: {
    idVariante: true, sku: true, estado: true, idPerfilPrecio: true,
    varianteAtributo: { select: { valorAtributo: { select: { idAtributo: true, valor: true, atributo: { select: { nombre: true } } } } } },
  } },
} satisfies Prisma.ProductoSelect;
export const obtener = (idProducto: number, db: TxComercial | PrismaClientLectura = prisma) => db.producto.findUnique({ where: { idProducto }, select: seleccion });
type PrismaClientLectura = typeof prisma;
export type ConfiguracionComercial = NonNullable<Awaited<ReturnType<typeof obtener>>>;

/** Serializa editores del mismo producto. Checkout no toma lock de Producto.
 * Después respeta variantes -> presentaciones -> perfiles -> listas.
 * NO KEY UPDATE bloquea SHARE del checkout y permite las FK existentes.
 */
export const bloquearProductoComercial = async (id: number, tx: TxComercial) => {
  const producto = await tx.$queryRaw<Array<{ id_producto: number }>>`SELECT id_producto FROM producto WHERE id_producto=${id} FOR NO KEY UPDATE`;
  if (!producto.length) return false;
  await tx.$queryRaw`SELECT id_variante FROM producto_variante WHERE id_producto=${id} ORDER BY id_variante ASC FOR NO KEY UPDATE`;
  await tx.$queryRaw`SELECT id_presentacion FROM presentacion_venta WHERE id_producto=${id} ORDER BY id_presentacion ASC FOR NO KEY UPDATE`;
  await tx.$queryRaw`SELECT id_perfil_precio FROM perfil_precio WHERE id_producto=${id} ORDER BY id_perfil_precio ASC FOR NO KEY UPDATE`;
  const listas = await tx.listaPrecio.findMany({ where: { idProducto: id }, select: { idListaPrecio: true } });
  await bloquearListasParaEscrituraReglas(listas.map(l => l.idListaPrecio), tx);
  return true;
};
export const transaccion = <T>(fn: (tx: TxComercial) => Promise<T>) => prisma.$transaction(fn, { timeout: 15000, maxWait: 15000 });
export const crearPresentacion = (tx: TxComercial, data: Prisma.PresentacionVentaUncheckedCreateInput) => tx.presentacionVenta.create({ data });
export const editarPresentacion = (tx: TxComercial, id: number, data: Prisma.PresentacionVentaUpdateInput) => tx.presentacionVenta.update({ where: { idPresentacion: id }, data });
export const quitarPrincipalPresentacion = (tx: TxComercial, idProducto: number) => tx.presentacionVenta.updateMany({ where: { idProducto, principal: true }, data: { principal: false } });
export const crearPerfil = (tx: TxComercial, data: Prisma.PerfilPrecioUncheckedCreateInput) => tx.perfilPrecio.create({ data });
export const editarPerfil = (tx: TxComercial, id: number, data: Prisma.PerfilPrecioUpdateInput) => tx.perfilPrecio.update({ where: { idPerfilPrecio: id }, data });
export const quitarPrincipalPerfil = (tx: TxComercial, idProducto: number) => tx.perfilPrecio.updateMany({ where: { idProducto, principal: true }, data: { principal: false } });
export const asignarPerfiles = async (tx: TxComercial, asignaciones: { idVariante: number; idPerfilPrecio: number | null }[]) => {
  const grupos = new Map<number | null, number[]>();
  for (const a of asignaciones) grupos.set(a.idPerfilPrecio, [...(grupos.get(a.idPerfilPrecio) ?? []), a.idVariante]);
  for (const [idPerfilPrecio, ids] of grupos) await tx.productoVariante.updateMany({ where: { idVariante: { in: ids } }, data: { idPerfilPrecio } });
};
export const guardarLista = (tx: TxComercial, id: number | null, data: Prisma.ListaPrecioUncheckedCreateInput) => id === null
  ? tx.listaPrecio.create({ data }) : tx.listaPrecio.update({ where: { idListaPrecio: id }, data });
export const quitarPrincipalLista = (tx: TxComercial, idProducto: number) => tx.listaPrecio.updateMany({ where: { idProducto, principal: true }, data: { principal: false } });
export const desactivarLista = (tx: TxComercial, id: number) => tx.listaPrecio.update({ where: { idListaPrecio: id }, data: { activo: false, principal: false } });
export const crearRegla = (tx: TxComercial, data: Prisma.ReglaPrecioCantidadUncheckedCreateInput) => tx.reglaPrecioCantidad.create({ data });
export const editarRegla = (tx: TxComercial, id: number, data: Prisma.ReglaPrecioCantidadUpdateInput) => tx.reglaPrecioCantidad.update({ where: { idReglaPrecio: id }, data });
export const eliminarRegla = (tx: TxComercial, id: number) => tx.reglaPrecioCantidad.delete({ where: { idReglaPrecio: id } });
export const principalRegla = async (tx: TxComercial, idListaPrecio: number) => {
  await tx.reglaPrecioCantidad.updateMany({ where: { idListaPrecio }, data: { principal: false } });
  const primera = await tx.reglaPrecioCantidad.findFirst({ where: { idListaPrecio, activo: true }, orderBy: [{ cantidadMinima: 'asc' }, { idReglaPrecio: 'asc' }] });
  if (primera) await tx.reglaPrecioCantidad.update({ where: { idReglaPrecio: primera.idReglaPrecio }, data: { principal: true } });
};
