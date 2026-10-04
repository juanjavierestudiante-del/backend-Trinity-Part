import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const repository = vi.hoisted(() => ({
  obtenerVistaPorUsuario: vi.fn(),
  agregarItemAtomico: vi.fn(),
  actualizarCantidadPropia: vi.fn(),
  eliminarItemPropio: vi.fn(),
  contarItems: vi.fn(),
}));
const pricing = vi.hoisted(() => ({ resolverVentasAgrupadas: vi.fn(), resolverContextoComercialBase: vi.fn() }));

vi.mock('../../src/repositories/carrito.repository.js', () => repository);
vi.mock('../../src/services/resolucion-comercial.service.js', () => pricing);

const carritoService = await import('../../src/services/carrito.service.js');

beforeEach(() => { vi.clearAllMocks(); pricing.resolverContextoComercialBase.mockResolvedValue({ presentacion: { idPresentacion: 1 } }); });

describe('operaciones especializadas de carrito', () => {
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
    expect(repository.agregarItemAtomico).toHaveBeenCalledWith(7, 4, 1, 2);
  });

  it('devuelve 400 si la operación condicional detecta stock insuficiente', async () => {
    repository.actualizarCantidadPropia.mockResolvedValue({ estado: 'STOCK_INSUFICIENTE' });
    await expect(carritoService.actualizarItem(7, 12, 4)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('contrato comercial del carrito', () => {
  it('almacena la presentación explícita resuelta', async () => {
    pricing.resolverContextoComercialBase.mockResolvedValue({ presentacion: { idPresentacion: 8 } });
    repository.agregarItemAtomico.mockResolvedValue([{ idDetalle: 1, idPresentacion: 8 }]);
    await carritoService.agregarItem(7, { idVariante: 4, idPresentacion: 8, cantidad: 3 });
    expect(pricing.resolverContextoComercialBase).toHaveBeenCalledWith(4, 8);
    expect(repository.agregarItemAtomico).toHaveBeenCalledWith(7, 4, 8, 3);
  });
  it.each(['presentación ajena', 'presentación inactiva'])('no persiste %s si el resolver rechaza', async (mensaje) => {
    pricing.resolverContextoComercialBase.mockRejectedValue(new Error(mensaje));
    await expect(carritoService.agregarItem(7, { idVariante: 4, idPresentacion: 8, cantidad: 1 })).rejects.toThrow(mensaje);
    expect(repository.agregarItemAtomico).not.toHaveBeenCalled();
  });
  it('devuelve presentación, consumo base y stock comprable sin perder campos anteriores', async () => {
    repository.obtenerVistaPorUsuario.mockResolvedValue({ idCarrito: 3, totalItems: 1, items: [{ idDetalle: 10, idVariante: 4, idPresentacion: 2, cantidad: 3, stock: 200, sku: 'ROJO', producto: { idProducto: 3, nombre: 'Globo', slug: 'globo', imagen: null } }] });
    const r={ idProducto: 3, idVariante: 4, presentacion: { idPresentacion: 2, nombre: 'Pack x50', cantidadBase: 50 }, perfilPrecio: { idPerfilPrecio: 1 }, listaPrecio: { idListaPrecio: 1 }, reglaPrecio: { cantidadMinima: 1 }, cantidadPresentaciones: 3, cantidadBaseTotal: 150, precioPorPresentacion: new Prisma.Decimal('32'), subtotal: new Prisma.Decimal('96') };
    pricing.resolverVentasAgrupadas.mockResolvedValue({ lineas: [r], grupos: [{ ...r, indices: [0] }], total: new Prisma.Decimal('96') });
    const result=await carritoService.obtenerCarrito(7);
    expect(result).toMatchObject({ total: '96.00', items: [{ idDetalle: 10, sku: 'ROJO', stock: 4, stockBase: 200, cantidadBaseTotal: 150, presentacion: { nombre: 'Pack x50' }, subtotal: '96.00' }] });
    expect(pricing.resolverVentasAgrupadas).toHaveBeenCalledWith([{ idDetalle: 10, idVariante: 4, idPresentacion: 2, cantidad: 3, stock: 200, sku: 'ROJO', producto: { idProducto: 3, nombre: 'Globo', slug: 'globo', imagen: null } }]);
  });
});
