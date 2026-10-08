import { Prisma } from '@prisma/client';
import * as repository from '../repositories/comercial-admin.repository.js';
import { bloquearListasParaEscrituraReglas } from '../repositories/resolucion-comercial.repository.js';
import { sincronizarReglas } from '../repositories/precio-cantidad-admin.repository.js';
import { AppError } from '../utils/helpers.js';
import type { AsignacionPerfil, ListaComercialInput, PerfilInput, PresentacionInput, ReglaInput } from '../validations/comercial-admin.validation.js';

type Config = repository.ConfiguracionComercial;
const incompleta = (detalle: string): never => { throw new AppError(`Configuración comercial incompleta: ${detalle}`, 409); };
const presentacion = (c: Config, id: number) => {
  const p = c.presentaciones.find(p => p.idPresentacion === id);
  if (!p) throw new AppError('La presentación no existe o pertenece a otro producto.', 404);
  return p;
};
const perfil = (c: Config, id: number) => {
  const p = c.perfilesPrecio.find(p => p.idPerfilPrecio === id);
  if (!p) throw new AppError('El perfil no existe o pertenece a otro producto.', 404);
  return p;
};
const lista = (c: Config, id: number) => {
  const l = c.listaPrecios.find(l => l.idListaPrecio === id);
  if (!l) throw new AppError('La lista no existe o pertenece a otro producto.', 404);
  return l;
};
const validarNombreOrden = (data: { nombre: string; orden: number }) => {
  if (!data.nombre.trim() || data.nombre.trim().length > 100) throw new AppError('El nombre es obligatorio y admite hasta 100 caracteres.', 400);
  if (!Number.isInteger(data.orden) || data.orden < 0 || data.orden > 2147483647) throw new AppError('Orden inválido.', 400);
};
export const validarReglasComerciales = (reglas: { cantidadMinima: number; precioPorPresentacion: string | Prisma.Decimal; activo: boolean }[], activo: boolean) => {
  const umbrales = new Set<number>();
  for (const r of reglas) {
    if (!Number.isInteger(r.cantidadMinima) || r.cantidadMinima < 1 || r.cantidadMinima > 2147483647) throw new AppError('Cantidad mínima inválida.', 400);
    if (umbrales.has(r.cantidadMinima)) throw new AppError('Ya existe una regla con esa cantidad mínima.', 409);
    umbrales.add(r.cantidadMinima);
    const texto = r.precioPorPresentacion.toString();
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(texto) || !new Prisma.Decimal(texto).gt(0)) throw new AppError('El precio por presentación debe ser positivo y tener hasta dos decimales.', 400);
  }
  if (activo && !reglas.some(r => r.activo && r.cantidadMinima === 1)) incompleta('la lista activa requiere una regla desde 1 presentación');
};

/** Los borradores no participan en ventas. No se inventan listas ni precios. */
export const validarConfiguracion = (c: Config) => {
  const ps = c.presentaciones.filter(p => p.activo);
  const fs = c.perfilesPrecio.filter(p => p.activo);
  if (ps.length && ps.filter(p => p.principal).length !== 1) incompleta('se requiere una presentación principal activa');
  if (fs.length && fs.filter(p => p.principal).length !== 1) incompleta('se requiere un perfil principal activo');
  const principal = fs.find(p => p.principal);
  const efectivos = new Set<number>(principal ? [principal.idPerfilPrecio] : []);
  for (const v of c.variantes) {
    if (v.idPerfilPrecio !== null) {
      if (!fs.some(p => p.idPerfilPrecio === v.idPerfilPrecio)) incompleta('una variante tiene un perfil inactivo o ajeno');
      efectivos.add(v.idPerfilPrecio);
    }
  }
  if (ps.length && !principal) incompleta('se requiere un perfil principal activo');
  for (const l of c.listaPrecios) validarReglasComerciales(l.reglas, l.activo);
  for (const p of ps) for (const f of efectivos) {
    const ls = c.listaPrecios.filter(l => l.activo && l.idPresentacion === p.idPresentacion && l.idPerfilPrecio === f);
    if (ls.length !== 1) incompleta(`falta una lista activa para ${p.nombre} y perfil ${f}`);
  }
};

const mutar = async <T>(idProducto: number, fn: (tx: repository.TxComercial, c: Config) => Promise<T>) => {
  try {
    return await repository.transaccion(async tx => {
      if (!await repository.bloquearProductoComercial(idProducto, tx)) throw new AppError('Producto no encontrado.', 404);
      const c = await repository.obtener(idProducto, tx);
      if (!c) throw new AppError('Producto no encontrado.', 404);
      const result = await fn(tx, c);
      const final = await repository.obtener(idProducto, tx);
      if (!final) throw new AppError('Producto no encontrado.', 404);
      validarConfiguracion(final);
      return result;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new AppError('Ya existe ese nombre, combinación comercial o cantidad mínima.', 409);
    if (e instanceof Error && e.message === 'REGLA_NO_PERTENECE_A_LISTA') throw new AppError('Una regla no pertenece a esta lista.', 400);
    throw e;
  }
};

export const obtenerConfiguracion = async (idProducto: number) => {
  const c = await repository.obtener(idProducto);
  if (!c) throw new AppError('Producto no encontrado.', 404);
  const principal = c.perfilesPrecio.find(p => p.activo && p.principal);
  return {
    producto: { idProducto: c.idProducto, nombre: c.nombre },
    presentaciones: c.presentaciones.map(({ _count, ...p }) => ({ ...p, enCarritos: _count.carritoItems })),
    perfiles: c.perfilesPrecio,
    listas: c.listaPrecios.map(l => ({ ...l, configuradaDesdeUno: l.reglas.some(r => r.activo && r.cantidadMinima === 1),
      vendible: l.activo && c.presentaciones.some(p => p.idPresentacion === l.idPresentacion && p.activo) && c.perfilesPrecio.some(p => p.idPerfilPrecio === l.idPerfilPrecio && p.activo) && l.reglas.some(r => r.activo && r.cantidadMinima === 1),
      reglas: l.reglas.map(r => ({ ...r, precioPorPresentacion: r.precioPorPresentacion.toFixed(2) })) })),
    variantes: c.variantes.map(v => {
      const atributo = v.varianteAtributo.find(a => a.valorAtributo.idAtributo === c.idAtributoPrincipal)?.valorAtributo;
      const efectivo = v.idPerfilPrecio === null ? principal : c.perfilesPrecio.find(p => p.idPerfilPrecio === v.idPerfilPrecio && p.activo);
      return { idVariante: v.idVariante, sku: v.sku, idPerfilPrecio: v.idPerfilPrecio,
        atributoPrincipal: atributo ? { nombre: atributo.atributo.nombre, valor: atributo.valor } : null,
        perfilEfectivo: efectivo ? { idPerfilPrecio: efectivo.idPerfilPrecio, nombre: efectivo.nombre } : null };
    }),
  };
};

export const guardarPresentacion = (producto: number, id: number | null, input: Partial<PresentacionInput>) => mutar(producto, async (tx, c) => {
  const actual = id === null ? null : presentacion(c, id);
  const data = { nombre: actual?.nombre ?? '', cantidadBase: actual?.cantidadBase ?? 0, principal: actual?.principal ?? false, activo: actual?.activo ?? false, orden: actual?.orden ?? 0, ...input };
  validarNombreOrden(data); data.nombre = data.nombre.trim();
  if (!Number.isInteger(data.cantidadBase) || data.cantidadBase < 1 || data.cantidadBase > 2147483647) throw new AppError('La cantidad base debe ser un entero positivo dentro del rango permitido.', 400);
  if (data.principal && !data.activo) throw new AppError('La presentación principal debe permanecer activa.', 409);
  if (actual?.principal && actual.activo && !data.principal) throw new AppError('Define otra presentación principal mediante su edición.', 409);
  if (actual && (data.cantidadBase !== actual.cantidadBase || !data.activo) && actual._count.carritoItems) throw new AppError('La presentación está en uso en carritos; no se puede cambiar su cantidad base ni desactivarla.', 409);
  if (data.principal) await repository.quitarPrincipalPresentacion(tx, producto);
  return id === null ? repository.crearPresentacion(tx, { idProducto: producto, ...data }) : repository.editarPresentacion(tx, id, data);
});
export const guardarPerfil = (producto: number, id: number | null, input: Partial<PerfilInput>) => mutar(producto, async (tx, c) => {
  const actual = id === null ? null : perfil(c, id);
  const data = { nombre: actual?.nombre ?? '', principal: actual?.principal ?? false, activo: actual?.activo ?? true, orden: actual?.orden ?? 0, ...input };
  validarNombreOrden(data); data.nombre = data.nombre.trim();
  if (data.principal && !data.activo) throw new AppError('El perfil principal no se puede desactivar.', 409);
  if (actual?.principal && actual.activo && !data.principal) throw new AppError('Define otro perfil principal mediante su edición.', 409);
  if (actual && !data.activo && c.variantes.some(v => v.idPerfilPrecio === id)) throw new AppError('El perfil está asignado a variantes.', 409);
  if (data.principal) await repository.quitarPrincipalPerfil(tx, producto);
  return id === null ? repository.crearPerfil(tx, { idProducto: producto, ...data }) : repository.editarPerfil(tx, id, data);
});
export const asignarPerfiles = (producto: number, asignaciones: AsignacionPerfil[]) => mutar(producto, async (tx, c) => {
  if (new Set(asignaciones.map(a => a.idVariante)).size !== asignaciones.length) throw new AppError('No repitas variantes.', 400);
  for (const a of asignaciones) {
    if (!c.variantes.some(v => v.idVariante === a.idVariante)) throw new AppError('La variante no pertenece al producto.', 400);
    if (a.idPerfilPrecio !== null && !perfil(c, a.idPerfilPrecio).activo) throw new AppError('El perfil no está activo.', 409);
    if (a.idPerfilPrecio === null && !c.perfilesPrecio.some(p => p.principal && p.activo)) incompleta('se requiere un perfil principal activo');
  }
  await repository.asignarPerfiles(tx, asignaciones);
});

export const guardarLista = (producto: number, id: number | null, input: ListaComercialInput) => {
  validarReglasComerciales(input.reglas, input.activo);
  return mutar(producto, async (tx, c) => {
    const actual = id === null ? null : lista(c, id);
    const idPresentacion = input.idPresentacion ?? actual?.idPresentacion ?? c.presentaciones.find(p => p.principal && p.activo)?.idPresentacion;
    const idPerfilPrecio = input.idPerfilPrecio ?? actual?.idPerfilPrecio ?? c.perfilesPrecio.find(p => p.principal && p.activo)?.idPerfilPrecio;
    if (!idPresentacion || !idPerfilPrecio) return incompleta('indica presentación y perfil');
    presentacion(c, idPresentacion); perfil(c, idPerfilPrecio);
    if (actual && (actual.idPresentacion !== idPresentacion || actual.idPerfilPrecio !== idPerfilPrecio)) throw new AppError('La combinación de una lista existente es inmutable; crea otra lista.', 409);
    if (input.activo && c.listaPrecios.some(l => l.idListaPrecio !== id && l.activo && l.idPresentacion === idPresentacion && l.idPerfilPrecio === idPerfilPrecio)) throw new AppError('Ya existe una lista activa para esa presentación y perfil.', 409);
    const principal = input.principal ?? actual?.principal ?? false;
    if (principal) await repository.quitarPrincipalLista(tx, producto);
    const l = await repository.guardarLista(tx, id, { idProducto: producto, idPresentacion, idPerfilPrecio, nombre: input.nombre, activo: input.activo, principal });
    await bloquearListasParaEscrituraReglas([l.idListaPrecio], tx);
    const reglas = await sincronizarReglas(tx, l.idListaPrecio, input.reglas);
    return { ...l, reglas: reglas.map(r => ({ ...r, precioPorPresentacion: r.precioPorPresentacion.toFixed(2) })) };
  });
};
export const eliminarLista = (producto: number, id: number) => mutar(producto, async (tx, c) => {
  lista(c, id); await repository.desactivarLista(tx, id);
});
export const guardarRegla = (producto: number, idLista: number, id: number | null, input: Partial<ReglaInput>) => mutar(producto, async (tx, c) => {
  const l = lista(c, idLista);
  const actual = id === null ? null : l.reglas.find(r => r.idReglaPrecio === id);
  if (id !== null && !actual) throw new AppError('La regla no pertenece a esta lista.', 404);
  const data = { nombre: actual?.nombre ?? '', cantidadMinima: actual?.cantidadMinima ?? 0, precioPorPresentacion: actual?.precioPorPresentacion.toFixed(2) ?? '0', activo: actual?.activo ?? true, orden: actual?.orden ?? 0, ...input };
  validarReglasComerciales([...l.reglas.filter(r => r.idReglaPrecio !== id), data], l.activo);
  await bloquearListasParaEscrituraReglas([idLista], tx);
  const valores = { ...data, precioPorPresentacion: new Prisma.Decimal(data.precioPorPresentacion), principal: false };
  const r = id === null ? await repository.crearRegla(tx, { idListaPrecio: idLista, ...valores }) : await repository.editarRegla(tx, id, valores);
  await repository.principalRegla(tx, idLista);
  return { ...r, principal: r.activo && r.cantidadMinima === Math.min(...[...l.reglas.filter(x => x.idReglaPrecio !== id && x.activo), r].filter(x => x.activo).map(x => x.cantidadMinima)), precioPorPresentacion: r.precioPorPresentacion.toFixed(2) };
});
export const eliminarRegla = (producto: number, idLista: number, id: number) => mutar(producto, async (tx, c) => {
  const l = lista(c, idLista);
  if (!l.reglas.some(r => r.idReglaPrecio === id)) throw new AppError('La regla no pertenece a esta lista.', 404);
  validarReglasComerciales(l.reglas.filter(r => r.idReglaPrecio !== id), l.activo);
  await bloquearListasParaEscrituraReglas([idLista], tx);
  await repository.eliminarRegla(tx, id); await repository.principalRegla(tx, idLista);
});
