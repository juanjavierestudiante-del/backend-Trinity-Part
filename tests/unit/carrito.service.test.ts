import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const repository = vi.hoisted(() => ({
  obtenerVistaPorUsuario: vi.fn(),
  agregarItemAtomico: vi.fn(),
  actualizarCantidadPropia: vi.fn(),
  eliminarItemPropio: vi.fn(),
  contarItems: vi.fn(),
}));
const pricing = vi.hoisted(() => ({ resolverPreciosAgrupados: vi.fn() }));

vi.mock('../../src/repositories/carrito.repository.js', () => repository);
vi.mock('../../src/services/precio-cantidad.service.js', () => pricing);

const carritoService = await import('../../src/services/carrito.service.js');

beforeEach(() => vi.clearAllMocks());

describe('operaciones especializadas de carrito', () => {
  it('resuelve precios agrupados dinámicamente y nunca recibe precio legacy del repositorio', async () => {
    repository.obtenerVistaPorUsuario.mockResolvedValue({
      idCarrito: 3,
      totalItems: 2,
      items: [
        { idDetalle: 10, idVariante: 4, cantidad: 3, stock: 10, sku: 'ROJO', producto: { idProducto: 3, nombre: 'Globo', slug: 'globo', imagen: null } },
        { idDetalle: 11, idVariante: 5, cantidad: 2, stock: 10, sku: 'VERDE', producto: { idProducto: 3, nombre: 'Globo', slug: 'globo', imagen: null } },
      ],
    });
    pricing.resolverPreciosAgrupados.mockResolvedValue({
      grupos: [{ idProducto: 3, idListaPrecio: 1, cantidadTotal: 5, cantidadMinimaAplicada: 5, precioPorPresentacion: new Prisma.Decimal('18'), subtotalGrupo: new Prisma.Decimal('90') }],
      lineas: [
        { idVariante: 4, idListaPrecioEfectiva: 1, precioPorPresentacion: new Prisma.Decimal('18'), subtotal: new Prisma.Decimal('54') },
        { idVariante: 5, idListaPrecioEfectiva: 1, precioPorPresentacion: new Prisma.Decimal('18'), subtotal: new Prisma.Decimal('36') },
      ],
      total: new Prisma.Decimal('90'),
    });

    await expect(carritoService.obtenerCarrito(7)).resolves.toMatchObject({
      total: '90.00',
      items: [
        { idVariante: 4, idListaPrecioEfectiva: 1, precioPorPresentacion: '18.00', subtotal: '54.00' },
        { idVariante: 5, idListaPrecioEfectiva: 1, precioPorPresentacion: '18.00', subtotal: '36.00' },
      ],
    });
    expect(pricing.resolverPreciosAgrupados).toHaveBeenCalledWith([{ idVariante: 4, cantidad: 3 }, { idVariante: 5, cantidad: 2 }]);
  });

  it.each([
    ['actualizarItem', () => carritoService.actualizarItem(7, 12, 3)],
    ['eliminarItem', () => carritoService.eliminarItem(7, 12)],
  ])('%s responde 404 si el detalle no pertenece al usuario', async (nombre, ejecutar) => {
    if (nombre === 'actualizarItem') repository.actualizarCantidadPropia.mockResolvedValue({ estado: 'NO_ENCONTRADO' });
    else repository.eliminarItemPropio.mockResolvedValue({ estado: 'NO_ENCONTRADO' });

    await expect(ejecutar()).rejects.toMatchObject({ statusCode: 404 });
  });

  it('actualiza una cantidad propia mediante una única operación condicional', async () => {
    repository.actualizarCantidadPropia.mockResolvedValue({ estado: 'ACTUALIZADO', idDetalle: 12, cantidad: 4 });

    await expect(carritoService.actualizarItem(7, 12, 4)).resolves.toMatchObject({ cantidad: 4 });
    expect(repository.actualizarCantidadPropia).toHaveBeenCalledWith(7, 12, 4);
  });

  it.each([
    ['CART_VARIANT_NOT_AVAILABLE', 404],
    ['CART_MAX_QUANTITY', 400],
    ['CART_INSUFFICIENT_STOCK', 400],
  ])('mapea el error atómico %s', async (codigo, statusCode) => {
    repository.agregarItemAtomico.mockRejectedValue({ code: 'P0001', message: codigo });

    await expect(carritoService.agregarItem(7, { idVariante: 4, cantidad: 2 })).rejects.toMatchObject({ statusCode });
  });

  it('agrega mediante la función atómica', async () => {
    repository.agregarItemAtomico.mockResolvedValue([{ idDetalle: 12, idCarrito: 3, idVariante: 4, cantidad: 4 }]);

    await expect(carritoService.agregarItem(7, { idVariante: 4, cantidad: 2 })).resolves.toMatchObject({ cantidad: 4 });
    expect(repository.agregarItemAtomico).toHaveBeenCalledWith(7, 4, 2);
  });

  it('devuelve 400 si la operación condicional detecta stock insuficiente', async () => {
    repository.actualizarCantidadPropia.mockResolvedValue({ estado: 'STOCK_INSUFICIENTE' });
    await expect(carritoService.actualizarItem(7, 12, 4)).rejects.toMatchObject({ statusCode: 400 });
  });
});
