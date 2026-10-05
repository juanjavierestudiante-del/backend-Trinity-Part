import { Prisma } from '@prisma/client';
import * as repository from '../repositories/resolucion-comercial.repository.js';
import type { ContextoComercialBase, ContextoVentaResuelto, IdentidadGrupoComercial } from '../types/resolucion-comercial.types.js';
import { AppError } from '../utils/helpers.js';
import { resolverPrecioUmbral, validarCantidadPrecio } from '../utils/resolver-precio-umbral.js';

const validarId = (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) throw new AppError('Identificador comercial inválido', 400);
};
function errorConfiguracion(detalle: string): never {
  throw new AppError(`Configuración comercial inválida: ${detalle}`, 409);
}

export const resolverContextoComercialBase = async (
  idVariante: number,
  idPresentacion?: number,
  db?: Prisma.TransactionClient
): Promise<ContextoComercialBase> => {
  validarId(idVariante);
  if (idPresentacion !== undefined) validarId(idPresentacion);
  const variante = await repository.obtenerVarianteComercial(idVariante, idPresentacion, db);
  const identidad = resolverIdentidadComercial(variante, idPresentacion);
  const listas = await repository.obtenerListasComerciales(identidad.idProducto, identidad.presentacion.idPresentacion, identidad.perfilPrecio.idPerfilPrecio, db);
  return completarContexto(identidad, listas);
};

const resolverIdentidadComercial = (variante: Awaited<ReturnType<typeof repository.obtenerVarianteComercial>>, idPresentacion?: number) => {
  if (!variante) throw new AppError('Variante no encontrada', 404);
  if (variante.estado !== 'Activo') throw new AppError('La variante no está activa', 409);
  if (variante.producto.estado !== 'Activo') throw new AppError('El producto no está activo', 409);

  const presentaciones = variante.producto.presentaciones;
  if (presentaciones.length !== 1) {
    if (idPresentacion !== undefined) throw new AppError('La presentación no existe o no pertenece al producto de la variante', 400);
    errorConfiguracion('se requiere exactamente una presentación principal activa');
  }
  const presentacion = presentaciones[0];
  if (presentacion.idProducto !== variante.idProducto) throw new AppError('La presentación pertenece a otro producto', 400);
  if (!presentacion.activo) throw new AppError('La presentación no está activa', 409);
  if (!Number.isSafeInteger(presentacion.cantidadBase) || presentacion.cantidadBase <= 0) errorConfiguracion('cantidadBase debe ser un entero positivo');

  let perfil = variante.perfilPrecio;
  if (variante.idPerfilPrecio === null) {
    const principales = variante.producto.perfilesPrecio;
    if (principales.length !== 1) errorConfiguracion('se requiere exactamente un perfil principal activo');
    perfil = principales[0];
  }
  if (!perfil) errorConfiguracion('perfil asignado no encontrado');
  if (perfil.idProducto !== variante.idProducto) errorConfiguracion('el perfil pertenece a otro producto');
  if (!perfil.activo) errorConfiguracion('el perfil no está activo');

  return {
    idProducto: variante.idProducto, idVariante: variante.idVariante,
    presentacion: { idPresentacion: presentacion.idPresentacion, nombre: presentacion.nombre, cantidadBase: presentacion.cantidadBase },
    perfilPrecio: { idPerfilPrecio: perfil.idPerfilPrecio, nombre: perfil.nombre },
  };
};
const completarContexto = (identidad: ReturnType<typeof resolverIdentidadComercial>, listas: Awaited<ReturnType<typeof repository.obtenerListasComerciales>>): ContextoComercialBase => {
  if (listas.length !== 1) errorConfiguracion('se requiere exactamente una lista activa para producto, presentación y perfil');
  return { ...identidad, listaPrecio: listas[0] };
};

/** Cantidad y subtotal siempre se expresan en presentaciones, nunca en unidades base. */
export const resolverPrecioCantidad = (contexto: ContextoComercialBase, cantidadPresentaciones: number): ContextoVentaResuelto => {
  validarCantidadPrecio(cantidadPresentaciones);
  const cantidadBaseTotal = cantidadPresentaciones * contexto.presentacion.cantidadBase;
  if (!Number.isSafeInteger(cantidadBaseTotal) || cantidadBaseTotal <= 0) throw new AppError('Cantidad total de unidades base fuera del rango seguro', 400);
  const precio = resolverPrecioUmbral(cantidadPresentaciones, contexto.listaPrecio.reglas);
  return {
    ...contexto,
    reglaPrecio: { idReglaPrecio: precio.idReglaPrecio, cantidadMinima: precio.cantidadMinimaAplicada, precioPorPresentacion: precio.precioPorPresentacion },
    cantidadPresentaciones, precioPorPresentacion: precio.precioPorPresentacion,
    subtotal: precio.subtotal, cantidadBaseTotal,
  };
};

export const resolverVenta = async (
  idVariante: number,
  cantidadPresentaciones: number,
  idPresentacion?: number,
  db?: Prisma.TransactionClient
): Promise<ContextoVentaResuelto> => {
  validarCantidadPrecio(cantidadPresentaciones);
  return resolverPrecioCantidad(await resolverContextoComercialBase(idVariante, idPresentacion, db), cantidadPresentaciones);
};

/** Colores comparten grupo solo si producto, presentación y perfil coinciden. */
export const construirClaveAgrupacionComercial = (contexto: IdentidadGrupoComercial): string =>
  `${contexto.idProducto}:${contexto.presentacion.idPresentacion}:${contexto.perfilPrecio.idPerfilPrecio}`;

export interface LineaVentaSolicitada { idVariante: number; idPresentacion?: number; cantidad: number }

/** Dos lecturas en lote, independientemente del número de líneas. */
export const resolverContextosComerciales = async (lineas: LineaVentaSolicitada[], db?: Prisma.TransactionClient): Promise<ContextoComercialBase[]> => {
  if (!lineas.length) return [];
  for (const l of lineas) { validarId(l.idVariante); if (l.idPresentacion !== undefined) validarId(l.idPresentacion); validarCantidadPrecio(l.cantidad); }
  const variantes = await repository.obtenerVariantesComerciales(lineas.map(l => l.idVariante), db);
  const porId = new Map(variantes.map(v => [v.idVariante, v]));
  const identidades = lineas.map(l => {
    const v = porId.get(l.idVariante);
    return resolverIdentidadComercial(v ? { ...v, producto: { ...v.producto, presentaciones: v.producto.presentaciones.filter(p => l.idPresentacion === undefined ? p.principal && p.activo : p.idPresentacion === l.idPresentacion) } } : null, l.idPresentacion);
  });
  const listas = await repository.obtenerListasComercialesEnLote(identidades, db);
  return identidades.map(i => completarContexto(i, listas.filter(l => l.idProducto === i.idProducto && l.idPresentacion === i.presentacion.idPresentacion && l.idPerfilPrecio === i.perfilPrecio.idPerfilPrecio)));
};

export const resolverVentasAgrupadas = async (lineas: LineaVentaSolicitada[], db?: Prisma.TransactionClient) => {
  const contextos = await resolverContextosComerciales(lineas, db);
  return resolverVentasAgrupadasConContextos(lineas, contextos);
};

/** Sólo checkout, con carrito/variantes/presentaciones ya bloqueados por el coordinador.
 * Descubre IDs; adquiere perfiles -> listas -> reglas; después lee reglas definitivas.
 * Si la selección cambió mientras esperaba un lock, aborta en vez de usar IDs sin protección.
 */
export const resolverVentasAgrupadasParaCheckout = async (lineas: LineaVentaSolicitada[], db: Prisma.TransactionClient) => {
  if (!lineas.length) return resolverVentasAgrupadasConContextos([], []);
  for (const l of lineas) { validarId(l.idVariante); if (l.idPresentacion !== undefined) validarId(l.idPresentacion); validarCantidadPrecio(l.cantidad); }
  const perfiles = await repository.obtenerIdsPerfilesEfectivos(lineas.map(l => l.idVariante), db);
  const idsPerfiles = perfiles.flatMap(p => p.idPerfilPrecio === null ? [] : [p.idPerfilPrecio]);
  await repository.bloquearPerfilesParaVenta(idsPerfiles, db);
  const variantes = await repository.obtenerVariantesComerciales(lineas.map(l => l.idVariante), db);
  const porId = new Map(variantes.map(v => [v.idVariante, v]));
  const identidades = lineas.map(l => {
    const v = porId.get(l.idVariante);
    const i = resolverIdentidadComercial(v ? { ...v, producto: { ...v.producto,
      presentaciones: v.producto.presentaciones.filter(p => l.idPresentacion === undefined ? p.principal && p.activo : p.idPresentacion === l.idPresentacion),
    } } : null, l.idPresentacion);
    if (!idsPerfiles.includes(i.perfilPrecio.idPerfilPrecio)) errorConfiguracion('el perfil cambió durante la resolución; reintenta la compra');
    return i;
  });
  const iniciales = await repository.obtenerIdsListasComerciales(identidades, db);
  const idsListas = iniciales.map(l => l.idListaPrecio);
  await repository.bloquearListasParaVenta(idsListas, db);
  await repository.bloquearReglasParaVenta(idsListas, db);
  const listas = await repository.obtenerListasComercialesEnLote(identidades, db);
  const contextos = identidades.map(i => {
    const c = completarContexto(i, listas.filter(l => l.idProducto === i.idProducto && l.idPresentacion === i.presentacion.idPresentacion && l.idPerfilPrecio === i.perfilPrecio.idPerfilPrecio));
    if (!idsListas.includes(c.listaPrecio.idListaPrecio)) errorConfiguracion('la lista cambió durante la resolución; reintenta la compra');
    return c;
  });
  return resolverVentasAgrupadasConContextos(lineas, contextos);
};

export const resolverVentasAgrupadasConContextos = (lineas: LineaVentaSolicitada[], contextos: ContextoComercialBase[]) => {
  if (lineas.length !== contextos.length) errorConfiguracion('contextos incompletos');
  const grupos = new Map<string, { contexto: ContextoComercialBase; cantidad: number; indices: number[] }>();
  lineas.forEach((l, index) => {
    validarCantidadPrecio(l.cantidad);
    const c = contextos[index];
    if (c.idVariante !== l.idVariante || (l.idPresentacion !== undefined && c.presentacion.idPresentacion !== l.idPresentacion)) errorConfiguracion('contexto no corresponde a la línea');
    const clave = construirClaveAgrupacionComercial(c);
    const grupo = grupos.get(clave) ?? { contexto: c, cantidad: 0, indices: [] };
    grupo.cantidad += l.cantidad; grupo.indices.push(index); grupos.set(clave, grupo);
  });
  const resultados = new Map<string, ContextoVentaResuelto>();
  const gruposResueltos = [...grupos.entries()].map(([clave, g]) => {
    const r = resolverPrecioCantidad(g.contexto, g.cantidad); resultados.set(clave, r);
    return { ...r, indices: g.indices };
  });
  const resueltas = contextos.map((c, index) => {
    const grupo = resultados.get(construirClaveAgrupacionComercial(c))!;
    const propio = { ...c, cantidadPresentaciones: lineas[index].cantidad, cantidadBaseTotal: lineas[index].cantidad * c.presentacion.cantidadBase };
    return { ...propio, reglaPrecio: grupo.reglaPrecio, precioPorPresentacion: grupo.precioPorPresentacion, subtotal: grupo.precioPorPresentacion.mul(lineas[index].cantidad) };
  });
  const total = resueltas.reduce((t, r) => t.plus(r.subtotal), new Prisma.Decimal(0));
  return { lineas: resueltas, grupos: gruposResueltos, total };
};
