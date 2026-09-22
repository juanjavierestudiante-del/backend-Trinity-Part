import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({ findAll: vi.fn(), findAllSinPaginacion: vi.fn() }));
vi.mock('../../src/repositories/producto.repository.js', () => repository);
vi.mock('../../src/repositories/categoria.repository.js', () => ({ getIdsDescendientes: vi.fn() }));

const service = await import('../../src/services/producto.service.js');

const producto = (precios: Array<{ idVariante: number; idListaPrecio: number | null; precio: string }>) => ({
  idProducto: 3,
  listaPrecios: [
    { idListaPrecio: 1, principal: true, reglas: [{ cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal('20') }] },
    { idListaPrecio: 2, principal: false, reglas: [{ cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal('25') }] },
  ],
  variantes: precios.map((item) => ({ idVariante: item.idVariante, idListaPrecio: item.idListaPrecio, estado: 'Activo' })),
  // El mock de reglas se ajusta abajo por lista para mantener el contrato Prisma mínimo.
  __precios: precios,
});

const conListas = (precios: Array<{ idVariante: number; idListaPrecio: number | null; precio: string }>) => ({
  ...producto(precios),
  listaPrecios: [
    { idListaPrecio: 1, principal: true, reglas: [{ cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal(precios.find((item) => item.idListaPrecio === null)?.precio ?? '20') }] },
    { idListaPrecio: 2, principal: false, reglas: [{ cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal(precios.find((item) => item.idListaPrecio === 2)?.precio ?? '25') }] },
  ],
});

beforeEach(() => vi.clearAllMocks());

describe('resumen público de precios', () => {
  it('muestra un único precio cuando todas las variantes usan el mismo precio inicial', async () => {
    repository.findAll.mockResolvedValue({ items: [conListas([{ idVariante: 1, idListaPrecio: null, precio: '20' }, { idVariante: 2, idListaPrecio: null, precio: '20' }])], total: 1 });
    const resultado = await service.listar({}, { page: 1, limit: 20 });
    expect(resultado.items[0]).toMatchObject({ precioDesde: '20.00', tieneVariacionPrecio: false });
  });

  it('detecta una lista alternativa y expone Desde con el menor precio inicial', async () => {
    repository.findAll.mockResolvedValue({ items: [conListas([{ idVariante: 1, idListaPrecio: null, precio: '20' }, { idVariante: 2, idListaPrecio: 2, precio: '25' }])], total: 1 });
    const resultado = await service.listar({}, { page: 1, limit: 20 });
    expect(resultado.items[0]).toMatchObject({ precioDesde: '20.00', tieneVariacionPrecio: true });
    expect(repository.findAll).toHaveBeenCalledTimes(1);
  });
});
