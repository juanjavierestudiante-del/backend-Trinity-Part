import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContextoListaPrecio, ListaPrecioAplicable } from '../../src/types/precio-cantidad.types.js';

const repository = vi.hoisted(() => ({ obtenerContextoListaPrecio: vi.fn(), obtenerContextosListaPrecio: vi.fn() }));
vi.mock('../../src/repositories/precio-cantidad.repository.js', () => repository);
const service = await import('../../src/services/precio-cantidad.service.js');
const lista = (id: number, precio: string): ListaPrecioAplicable => ({ idListaPrecio: id, idProducto: 3, nombre: `Lista ${id}`, principal: id === 1, activo: true, reglas: [{ idReglaPrecio: id * 10, nombre: 'Normal', cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal(precio), principal: true, activo: true, orden: 0 }] });
const contexto = (asignada: ListaPrecioAplicable | null, principal = lista(1, '20')): ContextoListaPrecio => ({ idVariante: 4, idProducto: 3, idListaPrecioAsignada: asignada?.idListaPrecio ?? null, listaAsignada: asignada, listaPrincipal: principal });

beforeEach(() => vi.clearAllMocks());
describe('resolverPrecioVariante', () => {
  it('resuelve la lista principal cuando la variante no tiene asignación', async () => { repository.obtenerContextoListaPrecio.mockResolvedValue(contexto(null)); await expect(service.resolverPrecio(4, 2)).resolves.toMatchObject({ idListaPrecioEfectiva: 1, subtotal: new Prisma.Decimal('40') }); });
  it('resuelve una lista alternativa asignada', async () => { repository.obtenerContextoListaPrecio.mockResolvedValue(contexto(lista(5, '25'))); await expect(service.resolverPrecio(4, 2)).resolves.toMatchObject({ idListaPrecioEfectiva: 5, subtotal: new Prisma.Decimal('50') }); });
  it('no combina reglas de lista principal y alternativa', () => { const resultado = service.resolverPrecioVarianteConContexto(contexto({ ...lista(5, '25'), reglas: [{ ...lista(5, '25').reglas[0], cantidadMinima: 5 }] }), 6); expect(resultado.idListaPrecioEfectiva).toBe(5); });
  it('rechaza variante inexistente', async () => { repository.obtenerContextoListaPrecio.mockResolvedValue(null); await expect(service.resolverPrecio(99, 1)).rejects.toMatchObject({ code: 'VARIANTE_NO_ENCONTRADA' }); });
});

describe('resolverPreciosAgrupadosConContextos', () => {
  it('agrupa variantes de un producto con la misma lista y aplica el umbral al grupo completo', () => {
    const normal: ListaPrecioAplicable = {
      ...lista(1, '20'),
      reglas: [
        { ...lista(1, '20').reglas[0], cantidadMinima: 1, precioPorPresentacion: new Prisma.Decimal('20') },
        { ...lista(1, '20').reglas[0], idReglaPrecio: 11, cantidadMinima: 5, precioPorPresentacion: new Prisma.Decimal('18'), principal: false, orden: 1 },
      ],
    };
    const resultado = service.resolverPreciosAgrupadosConContextos(
      [{ idVariante: 4, cantidad: 3 }, { idVariante: 5, cantidad: 2 }],
      [contexto(null, normal), { ...contexto(null, normal), idVariante: 5 }]
    );
    expect(resultado.grupos).toMatchObject([{ cantidadTotal: 5, cantidadMinimaAplicada: 5, precioPorPresentacion: new Prisma.Decimal('18') }]);
    expect(resultado.lineas.map((linea) => linea.subtotal.toString())).toEqual(['54', '36']);
    expect(resultado.total.toString()).toBe('90');
  });

  it('no mezcla listas alternativas aunque las variantes pertenezcan al mismo producto', () => {
    const resultado = service.resolverPreciosAgrupadosConContextos(
      [{ idVariante: 4, cantidad: 3 }, { idVariante: 5, cantidad: 2 }],
      [contexto(null, lista(1, '20')), { ...contexto(lista(2, '25')), idVariante: 5 }]
    );
    expect(resultado.grupos).toHaveLength(2);
    expect(resultado.lineas.map((linea) => linea.precioPorPresentacion.toString())).toEqual(['20', '25']);
  });

  it('mantiene precio Decimal exacto y no consulta durante la resolución en memoria', () => {
    const resultado = service.resolverPreciosAgrupadosConContextos(
      [{ idVariante: 4, cantidad: 3 }],
      [contexto(null, lista(1, '1.10'))]
    );
    expect(resultado.total.toString()).toBe('3.3');
    expect(repository.obtenerContextosListaPrecio).not.toHaveBeenCalled();
  });
});
