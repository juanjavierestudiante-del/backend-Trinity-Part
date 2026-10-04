import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextoComercialBase } from '../../src/types/resolucion-comercial.types.js';

const repository = vi.hoisted(() => ({ obtenerVarianteComercial: vi.fn(), obtenerListasComerciales: vi.fn() }));
vi.mock('../../src/repositories/resolucion-comercial.repository.js', () => repository);
const service = await import('../../src/services/resolucion-comercial.service.js');
const presentacion = { idPresentacion: 2, idProducto: 3, nombre: 'Unidad', cantidadBase: 1, principal: true, activo: true };
const perfil = { idPerfilPrecio: 4, idProducto: 3, nombre: 'Normal', principal: true, activo: true };
const variante = () => ({ idVariante: 10, idProducto: 3, estado: 'Activo', idPerfilPrecio: null, perfilPrecio: null,
  producto: { idProducto: 3, estado: 'Activo', presentaciones: [{ ...presentacion }], perfilesPrecio: [{ ...perfil }] } });
const regla = (id: number, cantidad: number, precio: string) => ({ idReglaPrecio: id, nombre: `Desde ${cantidad}`, cantidadMinima: cantidad,
  precioPorPresentacion: new Prisma.Decimal(precio), principal: cantidad === 1, activo: true, orden: id });
const lista = () => ({ idListaPrecio: 5, nombre: 'Unidad Normal', reglas: [regla(1, 1, '5'), regla(2, 12, '3')] });
const contexto = (): ContextoComercialBase => ({ idVariante: 10, idProducto: 3, presentacion, perfilPrecio: perfil, listaPrecio: lista() });

beforeEach(() => { vi.clearAllMocks(); repository.obtenerVarianteComercial.mockResolvedValue(variante()); repository.obtenerListasComerciales.mockResolvedValue([lista()]); });

describe('resolverContextoComercialBase', () => {
  it('usa presentación y perfil principales si no se informan overrides', async () => {
    const resultado = await service.resolverContextoComercialBase(10);
    expect(resultado.presentacion).toEqual({ idPresentacion: 2, nombre: 'Unidad', cantidadBase: 1 });
    expect(resultado.perfilPrecio).toEqual({ idPerfilPrecio: 4, nombre: 'Normal' });
    expect(repository.obtenerVarianteComercial).toHaveBeenCalledWith(10, undefined, undefined);
  });
  it('usa una presentación explícita válida aunque no sea principal', async () => {
    const v = variante(); v.producto.presentaciones = [{ ...presentacion, idPresentacion: 8, nombre: 'Pack x50', cantidadBase: 50, principal: false }];
    repository.obtenerVarianteComercial.mockResolvedValue(v);
    expect((await service.resolverContextoComercialBase(10, 8)).presentacion.idPresentacion).toBe(8);
    expect(repository.obtenerListasComerciales).toHaveBeenCalledWith(3, 8, 4, undefined);
  });
  it('rechaza presentación de otro producto', async () => {
    const v = variante(); v.producto.presentaciones = [{ ...presentacion, idProducto: 99 }]; repository.obtenerVarianteComercial.mockResolvedValue(v);
    await expect(service.resolverContextoComercialBase(10, 2)).rejects.toThrow('otro producto');
    expect(repository.obtenerListasComerciales).not.toHaveBeenCalled();
  });
  it('rechaza presentación explícita inexistente o ajena filtrada por repository', async () => {
    const v = variante(); v.producto.presentaciones = []; repository.obtenerVarianteComercial.mockResolvedValue(v);
    await expect(service.resolverContextoComercialBase(10, 99)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rechaza presentación inactiva', async () => {
    const v = variante(); v.producto.presentaciones[0].activo = false; repository.obtenerVarianteComercial.mockResolvedValue(v);
    await expect(service.resolverContextoComercialBase(10, 2)).rejects.toThrow('no está activa');
  });
  it.each([0, 2])('exige exactamente una presentación principal activa: %i candidatas', async (n) => {
    const v = variante(); v.producto.presentaciones = Array.from({ length: n }, () => ({ ...presentacion })); repository.obtenerVarianteComercial.mockResolvedValue(v);
    await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('exactamente una presentación');
  });
  it('usa el perfil especial asignado sin exigir un principal disponible', async () => {
    repository.obtenerVarianteComercial.mockResolvedValue({ ...variante(), idPerfilPrecio: 9, perfilPrecio: { ...perfil, idPerfilPrecio: 9, nombre: 'Especial', principal: false },
      producto: { ...variante().producto, perfilesPrecio: [] } });
    expect((await service.resolverContextoComercialBase(10)).perfilPrecio).toEqual({ idPerfilPrecio: 9, nombre: 'Especial' });
    expect(repository.obtenerListasComerciales).toHaveBeenCalledWith(3, 2, 9, undefined);
  });
  it('rechaza perfil especial de otro producto sin fallback', async () => {
    repository.obtenerVarianteComercial.mockResolvedValue({ ...variante(), idPerfilPrecio: 9, perfilPrecio: { ...perfil, idPerfilPrecio: 9, idProducto: 99 } });
    await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('perfil pertenece a otro producto');
    expect(repository.obtenerListasComerciales).not.toHaveBeenCalled();
  });
  it('rechaza perfil especial inactivo sin fallback', async () => {
    repository.obtenerVarianteComercial.mockResolvedValue({ ...variante(), idPerfilPrecio: 9, perfilPrecio: { ...perfil, idPerfilPrecio: 9, activo: false } });
    await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('perfil no está activo');
  });
  it('rechaza perfil asignado inexistente sin fallback', async () => {
    repository.obtenerVarianteComercial.mockResolvedValue({ ...variante(), idPerfilPrecio: 9 });
    await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('perfil asignado no encontrado');
  });
  it.each([0, 2])('exige exactamente un perfil principal activo: %i candidatos', async (n) => {
    const v = variante(); v.producto.perfilesPrecio = Array.from({ length: n }, () => ({ ...perfil })); repository.obtenerVarianteComercial.mockResolvedValue(v);
    await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('exactamente un perfil');
  });
  it('resuelve la lista exacta producto + presentación + perfil', async () => {
    expect((await service.resolverContextoComercialBase(10)).listaPrecio.idListaPrecio).toBe(5);
    expect(repository.obtenerListasComerciales).toHaveBeenCalledExactlyOnceWith(3, 2, 4, undefined);
  });
  it.each([0, 2])('rechaza configuración con %i listas y no usa idListaPrecio legacy', async (n) => {
    repository.obtenerVarianteComercial.mockResolvedValue({ ...variante(), idListaPrecio: 999 });
    repository.obtenerListasComerciales.mockResolvedValue(Array.from({ length: n }, lista));
    await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('exactamente una lista');
  });
  it('rechaza variante inexistente', async () => { repository.obtenerVarianteComercial.mockResolvedValue(null); await expect(service.resolverContextoComercialBase(10)).rejects.toMatchObject({ statusCode: 404 }); });
  it('rechaza variante inactiva', async () => { repository.obtenerVarianteComercial.mockResolvedValue({ ...variante(), estado: 'Inactivo' }); await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('variante no está activa'); });
  it.each(['Borrador', 'Inactivo', 'Descontinuado'])('rechaza producto %s', async (estado) => {
    const v = variante(); v.producto.estado = estado; repository.obtenerVarianteComercial.mockResolvedValue(v);
    await expect(service.resolverContextoComercialBase(10)).rejects.toThrow('producto no está activo');
  });
  it('propaga el cliente transaccional a ambas lecturas', async () => {
    const db = {} as Prisma.TransactionClient; await service.resolverContextoComercialBase(10, undefined, db);
    expect(repository.obtenerVarianteComercial).toHaveBeenCalledWith(10, undefined, db);
    expect(repository.obtenerListasComerciales).toHaveBeenCalledWith(3, 2, 4, db);
  });
});

describe('resolverPrecioCantidad', () => {
  it.each([[1, '5'], [11, '5'], [12, '3'], [50, '3']])('cantidad %i aplica precio %s', (cantidad, precio) => {
    const resultado = service.resolverPrecioCantidad(contexto(), cantidad);
    expect(resultado.precioPorPresentacion.toString()).toBe(precio);
    expect(resultado.reglaPrecio.cantidadMinima).toBe(cantidad < 12 ? 1 : 12);
  });
  it('subtotal de paquetes usa presentaciones, mientras cantidadBaseTotal usa unidades físicas', () => {
    const c = contexto(); c.presentacion = { ...c.presentacion, nombre: 'Pack x50', cantidadBase: 50 }; c.listaPrecio.reglas = [regla(1, 1, '56'), regla(2, 3, '50')];
    const r = service.resolverPrecioCantidad(c, 3); expect(r.subtotal.toString()).toBe('150'); expect(r.cantidadBaseTotal).toBe(150);
  });
  it('mantiene decimales monetarios exactos y reutiliza contexto sin queries', () => {
    const c = contexto(); c.listaPrecio.reglas = [regla(1, 1, '4.42')];
    const r = service.resolverPrecioCantidad(c, 12); expect(r.subtotal.toString()).toBe('53.04'); expect(r.precioPorPresentacion).toBeInstanceOf(Prisma.Decimal);
    expect(repository.obtenerVarianteComercial).not.toHaveBeenCalled(); expect(repository.obtenerListasComerciales).not.toHaveBeenCalled();
  });
  it('ignora reglas inactivas', () => { const c = contexto(); c.listaPrecio.reglas[1].activo = false; expect(service.resolverPrecioCantidad(c, 12).precioPorPresentacion.toString()).toBe('5'); });
  it.each([0, -1, 1.5, NaN, Infinity])('rechaza cantidad inválida %s', (cantidad) => { expect(() => service.resolverPrecioCantidad(contexto(), cantidad)).toThrow('CANTIDAD_INVALIDA'); });
  it('rechaza cantidadBaseTotal fuera del rango entero seguro', () => { const c = contexto(); c.presentacion.cantidadBase = 100; expect(() => service.resolverPrecioCantidad(c, Number.MAX_SAFE_INTEGER)).toThrow('rango seguro'); });
  it('propaga error sin reglas', () => { const c = contexto(); c.listaPrecio.reglas = []; expect(() => service.resolverPrecioCantidad(c, 1)).toThrow('SIN_REGLAS_PRECIO'); });
  it('propaga error sin umbral alcanzable', () => { const c = contexto(); c.listaPrecio.reglas = [regla(1, 12, '3')]; expect(() => service.resolverPrecioCantidad(c, 1)).toThrow('CANTIDAD_SIN_UMBRAL'); });
  it('resolverVenta integra contexto y cantidad', async () => { const r = await service.resolverVenta(10, 12); expect(r.subtotal.toString()).toBe('36'); expect(r.cantidadPresentaciones).toBe(12); });
});

describe('construirClaveAgrupacionComercial', () => {
  it('Rojo 6 y Azul 6 con mismo producto/presentación/perfil comparten clave', () => {
    const rojo = contexto(), azul = { ...contexto(), idVariante: 11 };
    expect(service.construirClaveAgrupacionComercial(rojo)).toBe(service.construirClaveAgrupacionComercial(azul));
    expect(service.resolverPrecioCantidad(rojo, 6 + 6).precioPorPresentacion.toString()).toBe('3');
  });
  it('perfiles Normal y Especial tienen grupos distintos', () => {
    const especial = { ...contexto(), perfilPrecio: { idPerfilPrecio: 9, nombre: 'Especial' } };
    expect(service.construirClaveAgrupacionComercial(contexto())).not.toBe(service.construirClaveAgrupacionComercial(especial));
  });
  it('Unidad y Pack x50 tienen grupos distintos', () => {
    const paquete = { ...contexto(), presentacion: { idPresentacion: 8, nombre: 'Pack x50', cantidadBase: 50 } };
    expect(service.construirClaveAgrupacionComercial(contexto())).not.toBe(service.construirClaveAgrupacionComercial(paquete));
  });
  it('productos distintos tienen grupos distintos', () => { expect(service.construirClaveAgrupacionComercial(contexto())).not.toBe(service.construirClaveAgrupacionComercial({ ...contexto(), idProducto: 99 })); });
});
