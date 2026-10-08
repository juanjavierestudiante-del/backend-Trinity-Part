import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import type { ReglaPrecioCantidadInput } from '../validations/precio-cantidad.validation.js';
import { bloquearListasParaEscrituraReglas } from './resolucion-comercial.repository.js';

const seleccionRegla = { idReglaPrecio: true, nombre: true, cantidadMinima: true, precioPorPresentacion: true, principal: true, activo: true, orden: true } satisfies Prisma.ReglaPrecioCantidadSelect;
const seleccionLista = { idListaPrecio: true, nombre: true, principal: true, activo: true, reglas: { select: seleccionRegla, orderBy: [{ orden: 'asc' }, { idReglaPrecio: 'asc' }] } } satisfies Prisma.ListaPrecioSelect;
type Tx = Prisma.TransactionClient;

const datosRegla = (regla: ReglaPrecioCantidadInput) => ({ nombre: regla.nombre, cantidadMinima: regla.cantidadMinima, precioPorPresentacion: new Prisma.Decimal(regla.precioPorPresentacion), activo: regla.activo, orden: regla.orden });

export const sincronizarReglas = async (tx: Tx, idListaPrecio: number, reglas: ReglaPrecioCantidadInput[]) => {
  await bloquearListasParaEscrituraReglas([idListaPrecio], tx);
  const actuales = await tx.reglaPrecioCantidad.findMany({ where: { idListaPrecio }, select: { idReglaPrecio: true } });
  const ids = new Set(actuales.map((regla) => regla.idReglaPrecio));
  if (reglas.some((regla) => regla.idReglaPrecio && !ids.has(regla.idReglaPrecio))) throw new Error('REGLA_NO_PERTENECE_A_LISTA');
  await tx.reglaPrecioCantidad.updateMany({ where: { idListaPrecio }, data: { principal: false } });
  const recibidos = new Set(reglas.flatMap((regla) => regla.idReglaPrecio ? [regla.idReglaPrecio] : []));
  const eliminar = actuales.map((regla) => regla.idReglaPrecio).filter((id) => !recibidos.has(id));
  if (eliminar.length) await tx.reglaPrecioCantidad.deleteMany({ where: { idReglaPrecio: { in: eliminar } } });
  const guardadas: Array<{ idReglaPrecio: number; principal: boolean; activo: boolean }> = [];
  for (const regla of reglas) {
    const resultado = regla.idReglaPrecio
      ? await tx.reglaPrecioCantidad.update({ where: { idReglaPrecio: regla.idReglaPrecio }, data: datosRegla(regla), select: { idReglaPrecio: true, activo: true } })
      : await tx.reglaPrecioCantidad.create({ data: { idListaPrecio, ...datosRegla(regla), principal: false }, select: { idReglaPrecio: true, activo: true } });
    guardadas.push({ ...resultado, principal: regla.principal });
  }
  const principal = guardadas.find((regla) => regla.principal && regla.activo);
  if (principal) await tx.reglaPrecioCantidad.update({ where: { idReglaPrecio: principal.idReglaPrecio }, data: { principal: true } });
  return tx.reglaPrecioCantidad.findMany({ where: { idListaPrecio }, select: seleccionRegla, orderBy: [{ orden: 'asc' }, { idReglaPrecio: 'asc' }] });
};

export const obtenerConfiguracion = (idProducto: number) => prisma.producto.findUnique({ where: { idProducto }, select: {
  idProducto: true, nombre: true,
  listaPrecios: { select: seleccionLista, orderBy: [{ principal: 'desc' }, { idListaPrecio: 'asc' }] },
  variantes: {
    select: {
      idVariante: true, sku: true, idListaPrecio: true,
      varianteAtributo: {
        select: {
          valorAtributo: { select: { valor: true, atributo: { select: { nombre: true } } } },
        },
      },
    },
    orderBy: { idVariante: 'asc' },
  },
} });

export const asignarLista = (idProducto: number, idsVariante: number[], idListaPrecio: number | null) => prisma.$transaction(async (tx) => {
  const variantes = await tx.productoVariante.count({ where: { idProducto, idVariante: { in: idsVariante } } });
  if (variantes !== new Set(idsVariante).size) return false;
  if (idListaPrecio && !await tx.listaPrecio.findFirst({ where: { idListaPrecio, idProducto, activo: true }, select: { idListaPrecio: true } })) throw new Error('LISTA_NO_PERTENECE_AL_PRODUCTO');
  await tx.productoVariante.updateMany({ where: { idProducto, idVariante: { in: idsVariante } }, data: { idListaPrecio } });
  return true;
});
