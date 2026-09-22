import { Prisma } from '@prisma/client';
import * as repository from '../repositories/precio-cantidad-admin.repository.js';
import { ErrorPrecioCantidad } from '../types/precio-cantidad.types.js';
import { resolverPrecioUmbral } from '../utils/resolver-precio-umbral.js';
import { AppError } from '../utils/helpers.js';
import type { AsignarListaPrecioInput, ListaPrecioInput, PrevisualizarPrecioCantidadInput, ReglaPrecioCantidadInput } from '../validations/precio-cantidad.validation.js';

const serializarRegla = (regla: { idReglaPrecio: number; nombre: string; cantidadMinima: number; precioPorPresentacion: Prisma.Decimal; principal: boolean; activo: boolean; orden: number }) => ({ ...regla, precioPorPresentacion: regla.precioPorPresentacion.toFixed(2) });

const validarReglas = (reglas: ReglaPrecioCantidadInput[]) => {
  const cantidades = new Set<number>(); let activas = 0; let principales = 0; let minima = false;
  for (const regla of reglas) {
    if (!regla.nombre.trim() || !Number.isSafeInteger(regla.cantidadMinima) || regla.cantidadMinima <= 0 || !Number.isSafeInteger(regla.orden)) throw new AppError('Cada umbral debe tener una cantidad entera mayor a 0.', 400);
    if (cantidades.has(regla.cantidadMinima)) throw new AppError(`Ya existe un precio desde ${regla.cantidadMinima} presentaciones.`, 400);
    cantidades.add(regla.cantidadMinima);
    if (!/^\d+(?:\.\d{1,2})?$/.test(regla.precioPorPresentacion) || !new Prisma.Decimal(regla.precioPorPresentacion).gt(0)) throw new AppError('El precio por presentación debe ser mayor a Bs 0.', 400);
    if (regla.activo) activas += 1;
    if (regla.activo && regla.principal) principales += 1;
    if (regla.activo && regla.cantidadMinima === 1) minima = true;
  }
  if (!activas || !minima) throw new AppError('Debe existir un umbral activo desde 1 presentación.', 400);
  if (principales !== 1) throw new AppError('Selecciona exactamente una venta principal activa.', 400);
};

const validarLista = (input: ListaPrecioInput) => {
  if (!input.nombre.trim()) throw new AppError('El nombre de la lista es obligatorio.', 400);
  if (!input.activo && input.principal) throw new AppError('La lista principal debe estar activa.', 400);
  validarReglas(input.reglas);
};

export const obtenerConfiguracion = async (idProducto: number) => {
  const config = await repository.obtenerConfiguracion(idProducto);
  if (!config) throw new AppError('Producto no encontrado', 404);
  const principal = config.listaPrecios.find((lista) => lista.principal && lista.activo);
  return {
    producto: { idProducto: config.idProducto, nombre: config.nombre },
    listasPrecio: config.listaPrecios.map((lista) => ({ ...lista, reglas: lista.reglas.map(serializarRegla) })),
    variantes: config.variantes.map((variante) => ({
      idVariante: variante.idVariante, sku: variante.sku, idListaPrecio: variante.idListaPrecio,
      listaEfectiva: variante.idListaPrecio ?? principal?.idListaPrecio ?? null,
      nombreVisible: variante.varianteAtributo.length ? variante.varianteAtributo.map(({ valorAtributo }) => `${valorAtributo.atributo.nombre}: ${valorAtributo.valor}`).join(' · ') : variante.sku,
    })),
  };
};

export const guardarLista = async (idProducto: number, idListaPrecio: number | null, input: ListaPrecioInput) => {
  validarLista(input);
  try {
    const resultado = await repository.guardarLista(idProducto, idListaPrecio, input);
    if (!resultado) throw new AppError('Producto no encontrado', 404);
    return { idListaPrecio: resultado.idListaPrecio, reglas: resultado.reglas.map(serializarRegla) };
  } catch (error) {
    if (error instanceof Error && error.message === 'LISTA_NO_PERTENECE_AL_PRODUCTO') throw new AppError('La lista no pertenece al producto indicado.', 400);
    if (error instanceof Error && error.message === 'LISTA_PRINCIPAL_REQUERIDA') throw new AppError('El producto debe conservar una lista principal activa.', 400);
    if (error instanceof Error && error.message === 'REGLA_NO_PERTENECE_A_LISTA') throw new AppError('Una regla no pertenece a esta lista.', 400);
    throw error;
  }
};

export const eliminarLista = async (idProducto: number, idListaPrecio: number) => {
  const resultado = await repository.eliminarLista(idProducto, idListaPrecio);
  if (resultado === 'NO_ENCONTRADA') throw new AppError('Lista no encontrada.', 404);
  if (resultado === 'PRINCIPAL') throw new AppError('Define otra lista principal antes de eliminar esta lista.', 400);
  if (resultado === 'ASIGNADA') throw new AppError('Reasigna las variantes antes de eliminar esta lista.', 400);
};

export const asignarLista = async (idProducto: number, input: AsignarListaPrecioInput) => {
  try {
    if (!await repository.asignarLista(idProducto, input.idsVariante, input.idListaPrecio)) throw new AppError('Una o más variantes no pertenecen al producto indicado.', 400);
  } catch (error) {
    if (error instanceof Error && error.message === 'LISTA_NO_PERTENECE_AL_PRODUCTO') throw new AppError('La lista debe pertenecer al mismo producto y estar activa.', 400);
    throw error;
  }
};

export const previsualizar = (input: PrevisualizarPrecioCantidadInput) => {
  validarReglas(input.reglas);
  try {
    const resultado = resolverPrecioUmbral(input.cantidad, input.reglas.map((regla, indice) => ({ idReglaPrecio: regla.idReglaPrecio ?? -(indice + 1), nombre: regla.nombre, cantidadMinima: regla.cantidadMinima, precioPorPresentacion: new Prisma.Decimal(regla.precioPorPresentacion), principal: regla.principal, activo: regla.activo, orden: regla.orden })));
    return { cantidad: resultado.cantidad, idReglaPrecio: resultado.idReglaPrecio, cantidadMinimaAplicada: resultado.cantidadMinimaAplicada, precioPorPresentacion: resultado.precioPorPresentacion.toFixed(2), subtotal: resultado.subtotal.toFixed(2) };
  } catch (error) {
    if (error instanceof ErrorPrecioCantidad) throw new AppError('No existe un umbral aplicable para esa cantidad.', 400);
    throw error;
  }
};
