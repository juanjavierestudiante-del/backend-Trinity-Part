import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
const repository = vi.hoisted(() => ({ obtenerConfiguracion: vi.fn(), guardarLista: vi.fn(), eliminarLista: vi.fn(), asignarLista: vi.fn() }));
vi.mock('../../src/repositories/precio-cantidad-admin.repository.js', () => repository);
const service = await import('../../src/services/precio-cantidad-admin.service.js');
const regla = (extra = {}) => ({ nombre: 'Normal', cantidadMinima: 1, precioPorPresentacion: '20.00', principal: true, activo: true, orden: 0, ...extra });
describe('admin de listas de precios', () => {
  it('rechaza umbrales duplicados y listas sin umbral 1', async () => { await expect(service.guardarLista(3, null, { nombre: 'Normal', principal: true, activo: true, reglas: [regla({ cantidadMinima: 5 })] })).rejects.toMatchObject({ statusCode: 400 }); await expect(service.guardarLista(3, null, { nombre: 'Normal', principal: true, activo: true, reglas: [regla(), regla({ nombre: 'Duplicado', principal: false })] })).rejects.toMatchObject({ statusCode: 400 }); });
  it('preview devuelve umbral, precio y subtotal', () => { const result = service.previsualizar({ cantidad: 7, reglas: [regla(), regla({ nombre: 'Mayorista', cantidadMinima: 5, precioPorPresentacion: '18.00', principal: false })] }); expect(result).toMatchObject({ cantidadMinimaAplicada: 5, precioPorPresentacion: '18.00', subtotal: '126.00' }); });
  it('no usa composición de bloques', () => { const result = service.previsualizar({ cantidad: 102, reglas: [regla(), regla({ nombre: 'Caja', cantidadMinima: 100, precioPorPresentacion: '13.00', principal: false })] }); expect(result).toMatchObject({ cantidadMinimaAplicada: 100, subtotal: '1326.00' }); });
  it('serializa Decimal en configuración', async () => { repository.obtenerConfiguracion.mockResolvedValue({ idProducto: 3, nombre: 'Globos', listaPrecios: [{ idListaPrecio: 1, nombre: 'Principal', principal: true, activo: true, reglas: [{ idReglaPrecio: 1, ...regla(), precioPorPresentacion: new Prisma.Decimal('20') }] }], variantes: [{ idVariante: 4, sku: 'GLOBO-001', idListaPrecio: null, varianteAtributo: [] }] }); await expect(service.obtenerConfiguracion(3)).resolves.toMatchObject({ listasPrecio: [{ reglas: [{ precioPorPresentacion: '20.00' }] }], variantes: [{ listaEfectiva: 1 }] }); });
});
