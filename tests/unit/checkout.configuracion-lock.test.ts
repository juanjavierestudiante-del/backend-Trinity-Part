import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const repo = vi.hoisted(() => ({
  obtenerIdsPerfilesEfectivos: vi.fn(), bloquearPerfilesParaVenta: vi.fn(), obtenerVariantesComercialesParaCheckout: vi.fn(),
  obtenerIdsListasComerciales: vi.fn(), bloquearListasParaVenta: vi.fn(), bloquearReglasParaVenta: vi.fn(), obtenerListasComercialesParaCheckout: vi.fn(),
}));
vi.mock('../../src/repositories/resolucion-comercial.repository.js', () => repo);
const service = await import('../../src/services/resolucion-comercial.service.js');
const db = {} as Prisma.TransactionClient;
const lines = [{ idVariante: 1, idPresentacion: 2, cantidad: 5 }];
const profile = { idPerfilPrecio: 3, idProducto: 4, nombre: 'Principal', activo: true, principal: true };
const variant = () => ({ idVariante: 1, idProducto: 4, estado: 'Activo', idPerfilPrecio: null, perfilPrecio: null,
  producto: { idProducto: 4, estado: 'Activo', perfilesPrecio: [profile], presentaciones: [{ idPresentacion: 2, idProducto: 4, nombre: 'Pack x50', cantidadBase: 50, principal: true, activo: true }] } });
const list = () => ({ idListaPrecio: 5, idProducto: 4, idPresentacion: 2, idPerfilPrecio: 3, nombre: 'Lista', reglas: [
  { idReglaPrecio: 6, nombre: 'Base', cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal(32), principal: true, activo: true, orden: 0 },
  { idReglaPrecio: 7, nombre: 'Tres', cantidadMinima: 3, precioPorPresentacion: new Prisma.Decimal(30), principal: false, activo: true, orden: 1 },
] });
beforeEach(() => {
  vi.clearAllMocks(); repo.obtenerIdsPerfilesEfectivos.mockResolvedValue([{ idPerfilPrecio: 3 }]);
  repo.obtenerVariantesComercialesParaCheckout.mockResolvedValue([variant()]); repo.obtenerIdsListasComerciales.mockResolvedValue([{ idListaPrecio: 5 }]);
  repo.obtenerListasComercialesParaCheckout.mockResolvedValue([list()]);
});
describe('resolución definitiva protegida', () => {
  it('bloquea perfil -> lista -> reglas y sólo después lee precios definitivos', async () => {
    const r = await service.resolverVentasAgrupadasParaCheckout(lines, db);
    const ordered = [repo.bloquearPerfilesParaVenta, repo.obtenerVariantesComercialesParaCheckout, repo.obtenerIdsListasComerciales,
      repo.bloquearListasParaVenta, repo.bloquearReglasParaVenta, repo.obtenerListasComercialesParaCheckout];
    const calls = ordered.map(f => f.mock.invocationCallOrder[0]);
    expect(calls).toEqual([...calls].sort((a, b) => a - b));
    expect(r.total.toFixed(2)).toBe('150.00'); expect(r.lineas[0].cantidadBaseTotal).toBe(250);
  });
  it('rechaza un perfil distinto al protegido, sin leer precios', async () => {
    repo.obtenerIdsPerfilesEfectivos.mockResolvedValue([{ idPerfilPrecio: 99 }]);
    await expect(service.resolverVentasAgrupadasParaCheckout(lines, db)).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.obtenerListasComercialesParaCheckout).not.toHaveBeenCalled();
  });
  it('rechaza una lista distinta de la protegida', async () => {
    repo.obtenerIdsListasComerciales.mockResolvedValue([{ idListaPrecio: 99 }]);
    await expect(service.resolverVentasAgrupadasParaCheckout(lines, db)).rejects.toMatchObject({ statusCode: 409 });
  });
  it('sin líneas no descubre ni bloquea configuración', async () => {
    expect((await service.resolverVentasAgrupadasParaCheckout([], db)).total.toString()).toBe('0');
    expect(repo.obtenerIdsPerfilesEfectivos).not.toHaveBeenCalled();
  });
});
