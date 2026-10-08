import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schemas from '../../src/validations/comercial-admin.validation.js';
const r = vi.hoisted(() => ({ transaccion: vi.fn(), bloquearProductoComercial: vi.fn(), obtener: vi.fn(),
  crearPresentacion: vi.fn(), editarPresentacion: vi.fn(), quitarPrincipalPresentacion: vi.fn(),
  crearPerfil: vi.fn(), editarPerfil: vi.fn(), quitarPrincipalPerfil: vi.fn(), asignarPerfiles: vi.fn(),
  guardarLista: vi.fn(), quitarPrincipalLista: vi.fn(), desactivarLista: vi.fn(), crearRegla: vi.fn(), editarRegla: vi.fn(), eliminarRegla: vi.fn(), principalRegla: vi.fn(),
}));
const locks = vi.hoisted(() => ({ bloquearListasParaEscrituraReglas: vi.fn() }));
vi.mock('../../src/repositories/comercial-admin.repository.js', () => r);
vi.mock('../../src/repositories/resolucion-comercial.repository.js', () => locks);
vi.mock('../../src/repositories/precio-cantidad-admin.repository.js', () => ({ sincronizarReglas: vi.fn().mockResolvedValue([]) }));
const service = await import('../../src/services/comercial-admin.service.js');
type Config = Parameters<typeof service.validarConfiguracion>[0];
const regla = () => ({ idReglaPrecio: 5, idListaPrecio: 4, nombre: 'Base', cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal('32'), principal: true, activo: true, orden: 0 });
const config = (): Config => ({ idProducto: 1, nombre: 'Cromado', idAtributoPrincipal: 8,
  presentaciones: [{ idPresentacion: 2, idProducto: 1, nombre: 'Pack x50', cantidadBase: 50, principal: true, activo: true, orden: 0, _count: { carritoItems: 0 } }],
  perfilesPrecio: [{ idPerfilPrecio: 3, idProducto: 1, nombre: 'Principal', principal: true, activo: true, orden: 0 }],
  listaPrecios: [{ idListaPrecio: 4, idProducto: 1, idPresentacion: 2, idPerfilPrecio: 3, nombre: 'Lista', activo: true, principal: true, reglas: [regla()] }],
  variantes: [{ idVariante: 6, sku: 'DORADO', estado: 'Activo', idPerfilPrecio: null, varianteAtributo: [{ valorAtributo: { idAtributo: 8, valor: 'Dorado', atributo: { nombre: 'Color' } } }] }],
} as unknown as Config);
let c: Config;
beforeEach(() => {
  vi.clearAllMocks(); c = config(); r.obtener.mockImplementation(async () => c);
  r.bloquearProductoComercial.mockResolvedValue(true); r.transaccion.mockImplementation(async cb => cb({}));
  r.crearPresentacion.mockImplementation(async (_tx, data) => data);
  r.crearPerfil.mockImplementation(async (_tx, data) => data);
  r.crearRegla.mockImplementation(async (_tx, data) => ({ ...data, idReglaPrecio: 99 }));
  r.editarRegla.mockImplementation(async (_tx, idReglaPrecio, data) => ({ ...regla(), ...data, idReglaPrecio }));
  r.guardarLista.mockImplementation(async (_tx, id, data) => ({ ...data, idListaPrecio: id ?? 99 }));
});
describe('validación comercial Admin', () => {
  it.each([0, -1, 1.5, 2147483648])('rechaza cantidad base %s', cantidadBase => {
    expect(schemas.crearPresentacionSchema.safeParse({ nombre: 'Pack', cantidadBase }).success).toBe(false);
  });
  it('recorta nombres y acepta presentación válida', () => expect(schemas.crearPresentacionSchema.parse({ nombre: ' Unidad ', cantidadBase: 1 }).nombre).toBe('Unidad'));
  it.each(['', ' ', '0', '-1', '1.001', '999999999', 'NaN'])('rechaza precio %s', precioPorPresentacion => {
    expect(schemas.crearReglaSchema.safeParse({ nombre: 'Base', cantidadMinima: 1, precioPorPresentacion }).success).toBe(false);
  });
  it.each([0, -1, 1.5])('rechaza umbral %s', cantidadMinima => {
    expect(schemas.crearReglaSchema.safeParse({ nombre: 'Base', cantidadMinima, precioPorPresentacion: '5.00' }).success).toBe(false);
  });
  it('rechaza asignaciones duplicadas', () => expect(schemas.asignarPerfilesSchema.safeParse({ asignaciones: [{ idVariante: 1, idPerfilPrecio: null }, { idVariante: 1, idPerfilPrecio: 2 }] }).success).toBe(false));
  it('permite lista borrador sin reglas', () => expect(schemas.listaComercialSchema.parse({ nombre: 'Borrador' })).toMatchObject({ activo: false, reglas: [] }));
  it('rechaza campos desconocidos y edición vacía', () => {
    expect(schemas.editarPerfilSchema.safeParse({}).success).toBe(false);
    expect(schemas.crearPresentacionSchema.safeParse({ nombre: 'X', cantidadBase: 1, stock: 9 }).success).toBe(false);
  });
});
describe('invariantes comerciales', () => {
  it('configuración completa es válida', () => expect(() => service.validarConfiguracion(c)).not.toThrow());
  it('no permite dos presentaciones principales', () => { c.presentaciones.push({ ...c.presentaciones[0], idPresentacion: 9 }); expect(() => service.validarConfiguracion(c)).toThrow('presentación principal'); });
  it('no permite dos perfiles principales', () => { c.perfilesPrecio.push({ ...c.perfilesPrecio[0], idPerfilPrecio: 9 }); expect(() => service.validarConfiguracion(c)).toThrow('perfil principal'); });
  it('rechaza lista activa sin regla 1', () => { c.listaPrecios[0].reglas[0].cantidadMinima = 3; expect(() => service.validarConfiguracion(c)).toThrow('desde 1'); });
  it('rechaza reglas duplicadas incluso inactivas por constraint físico', () => { c.listaPrecios[0].reglas.push({ ...regla(), activo: false }); expect(() => service.validarConfiguracion(c)).toThrow('cantidad mínima'); });
  it('rechaza matriz incompleta para un perfil asignado', () => { c.perfilesPrecio.push({ ...c.perfilesPrecio[0], idPerfilPrecio: 7, principal: false }); c.variantes[0].idPerfilPrecio = 7; expect(() => service.validarConfiguracion(c)).toThrow('falta una lista'); });
});
describe('operaciones comerciales protegidas', () => {
  it('crea presentación borrador después de locks', async () => {
    await service.guardarPresentacion(1, null, { nombre: 'Unidad', cantidadBase: 1 });
    expect(r.crearPresentacion).toHaveBeenCalledWith({}, expect.objectContaining({ activo: false, cantidadBase: 1 }));
    expect(r.bloquearProductoComercial.mock.invocationCallOrder[0]).toBeLessThan(r.crearPresentacion.mock.invocationCallOrder[0]);
  });
  it('cambia principal con democión antes de promover', async () => { await service.guardarPresentacion(1, 2, { principal: true }); expect(r.quitarPrincipalPresentacion.mock.invocationCallOrder[0]).toBeLessThan(r.editarPresentacion.mock.invocationCallOrder[0]); });
  it('rechaza presentación de otro producto', async () => { await expect(service.guardarPresentacion(1, 100, { nombre: 'Otro' })).rejects.toMatchObject({ statusCode: 404 }); expect(r.editarPresentacion).not.toHaveBeenCalled(); });
  it('cantidadBase se edita bajo lock', async () => { await service.guardarPresentacion(1, 2, { cantidadBase: 100 }); expect(r.bloquearProductoComercial.mock.invocationCallOrder[0]).toBeLessThan(r.editarPresentacion.mock.invocationCallOrder[0]); });
  it('impide cambiar cantidad base con carritos', async () => { c.presentaciones[0]._count.carritoItems = 1; await expect(service.guardarPresentacion(1, 2, { cantidadBase: 100 })).rejects.toThrow('en uso'); });
  it('impide desactivar presentación principal', async () => { await expect(service.guardarPresentacion(1, 2, { activo: false })).rejects.toThrow('permanecer activa'); });
  it('crea perfil y hace principal atómicamente', async () => { await service.guardarPerfil(1, null, { nombre: 'Especial', principal: true }); expect(r.quitarPrincipalPerfil.mock.invocationCallOrder[0]).toBeLessThan(r.crearPerfil.mock.invocationCallOrder[0]); });
  it('impide desactivar perfil principal', async () => { await expect(service.guardarPerfil(1, 3, { activo: false })).rejects.toThrow('no se puede desactivar'); });
  it('impide desactivar perfil asignado', async () => { c.perfilesPrecio.push({ ...c.perfilesPrecio[0], idPerfilPrecio: 7, principal: false }); c.variantes[0].idPerfilPrecio = 7; await expect(service.guardarPerfil(1, 7, { activo: false })).rejects.toThrow('asignado'); });
  it('asigna perfil válido', async () => { await service.asignarPerfiles(1, [{ idVariante: 6, idPerfilPrecio: 3 }]); expect(r.asignarPerfiles).toHaveBeenCalledWith({}, [{ idVariante: 6, idPerfilPrecio: 3 }]); });
  it('NULL hereda principal', async () => { await service.asignarPerfiles(1, [{ idVariante: 6, idPerfilPrecio: null }]); expect(r.asignarPerfiles).toHaveBeenCalledWith({}, [{ idVariante: 6, idPerfilPrecio: null }]); });
  it('rechaza perfil ajeno', async () => { await expect(service.asignarPerfiles(1, [{ idVariante: 6, idPerfilPrecio: 999 }])).rejects.toMatchObject({ statusCode: 404 }); });
  it('rechaza perfil inactivo', async () => { c.perfilesPrecio.push({ ...c.perfilesPrecio[0], idPerfilPrecio: 7, activo: false, principal: false }); await expect(service.asignarPerfiles(1, [{ idVariante: 6, idPerfilPrecio: 7 }])).rejects.toThrow('no está activo'); });
  it('valida todo el lote antes de escribir', async () => { await expect(service.asignarPerfiles(1, [{ idVariante: 6, idPerfilPrecio: 3 }, { idVariante: 999, idPerfilPrecio: null }])).rejects.toThrow('variante'); expect(r.asignarPerfiles).not.toHaveBeenCalled(); });
  it('rechaza lista activa duplicada de combinación', async () => { await expect(service.guardarLista(1, null, { nombre: 'Duplicada', idPresentacion: 2, idPerfilPrecio: 3, principal: false, activo: true, reglas: [{ ...regla(), precioPorPresentacion: '32' }] })).rejects.toThrow('Ya existe una lista'); });
  it('rechaza presentación ajena en lista', async () => { await expect(service.guardarLista(1, null, { nombre: 'X', idPresentacion: 999, idPerfilPrecio: 3, principal: false, activo: false, reglas: [] })).rejects.toThrow('presentación'); });
  it('crea regla Decimal sólo después de lock padre', async () => { const result = await service.guardarRegla(1, 4, null, { nombre: 'Tres', cantidadMinima: 3, precioPorPresentacion: '30' }); expect(result.precioPorPresentacion).toBe('30.00'); expect(locks.bloquearListasParaEscrituraReglas.mock.invocationCallOrder[0]).toBeLessThan(r.crearRegla.mock.invocationCallOrder[0]); });
  it('edita regla', async () => { expect((await service.guardarRegla(1, 4, 5, { precioPorPresentacion: '35' })).precioPorPresentacion).toBe('35.00'); });
  it('no permite desactivar ni eliminar regla 1 de lista activa', async () => { await expect(service.guardarRegla(1, 4, 5, { activo: false })).rejects.toThrow('desde 1'); await expect(service.eliminarRegla(1, 4, 5)).rejects.toThrow('desde 1'); });
  it('elimina umbral secundario bajo lock', async () => { c.listaPrecios[0].reglas.push({ ...regla(), idReglaPrecio: 7, cantidadMinima: 3, principal: false }); await service.eliminarRegla(1, 4, 7); expect(locks.bloquearListasParaEscrituraReglas.mock.invocationCallOrder[0]).toBeLessThan(r.eliminarRegla.mock.invocationCallOrder[0]); });
  it('configuración devuelve atributo, perfil heredado, Decimal y estado desde1', async () => { const dto = await service.obtenerConfiguracion(1); expect(dto.variantes[0]).toMatchObject({ atributoPrincipal: { nombre: 'Color', valor: 'Dorado' }, perfilEfectivo: { idPerfilPrecio: 3 } }); expect(dto.listas[0]).toMatchObject({ configuradaDesdeUno: true, reglas: [{ precioPorPresentacion: '32.00' }] }); });
  it('representa borrador sin regla 1 como no vendible', async () => { c.listaPrecios[0].activo = false; c.listaPrecios[0].reglas = []; expect((await service.obtenerConfiguracion(1)).listas[0]).toMatchObject({ configuradaDesdeUno: false, vendible: false }); });
});
