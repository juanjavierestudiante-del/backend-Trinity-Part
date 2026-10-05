import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ transaction: vi.fn(), findMany: vi.fn(), count: vi.fn(), fields: { stockMinimo: 'stock_minimo' } }));
vi.mock('../../src/config/prisma.js', () => ({ default: {
  $transaction: m.transaction, productoVariante: { findMany: m.findMany, count: m.count }, inventario: { fields: m.fields },
} }));
const repo = await import('../../src/repositories/inventario.repository.js');
const service = await import('../../src/services/inventario.service.js');
const { actualizarInventarioSchema, ajustarInventarioSchema } = await import('../../src/validations/inventario.validation.js');
const variante = (stock = 2000) => ({
  idProducto: 1, idVariante: 2, sku: 'CROMADO-DORADO', estado: 'Activo', marca: null, unidad: { abreviatura: 'LEGACY' },
  producto: { idProducto: 1, nombre: 'Cromado', idAtributoPrincipal: 3, atributoPrincipal: { nombre: 'Color' },
    presentaciones: [{ idPresentacion: 1, nombre: 'Unidad', cantidadBase: 1, principal: false }, { idPresentacion: 2, nombre: 'Pack x50', cantidadBase: 50, principal: true }] },
  varianteAtributo: [{ valorAtributo: { idAtributo: 3, valor: 'Dorado' } }],
  inventario: { stockActual: stock, stockMinimo: 100, stockMaximo: null },
});
const transaccion = (stock = 100) => {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id_variante: 2 }]),
    inventario: { findUnique: vi.fn().mockResolvedValue({ stockActual: stock, stockMinimo: 0, stockMaximo: null }),
      create: vi.fn(), update: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn() },
    movimientoInventario: { create: vi.fn() },
  };
  m.transaction.mockImplementation(async cb => cb(tx));
  return tx;
};
beforeEach(() => { vi.clearAllMocks(); m.findMany.mockResolvedValue([variante()]); m.count.mockResolvedValue(1); });
describe('inventario admin en unidades físicas', () => {
  it('lista producto, atributo principal, SKU y presentaciones en lote', async () => {
    m.transaction.mockImplementation(async queries => Promise.all(queries));
    const r = await service.listar(2, 20);
    expect(r.items[0]).toMatchObject({ sku: 'CROMADO-DORADO', productoInfo: { idProducto: 1, nombre: 'Cromado' }, atributoPrincipal: { nombre: 'Color', valor: 'Dorado' } });
    expect(m.findMany).toHaveBeenCalledTimes(1);
    expect(m.findMany.mock.calls[0][0]).toMatchObject({ skip: 20, take: 20, include: { producto: { select: { presentaciones: { where: { activo: true } } } } } });
    expect(r.items[0].presentaciones.map(p => p.disponible)).toEqual([2000, 40]);
  });
  it('49 unidades no permiten vender un pack de 50', async () => {
    m.findMany.mockResolvedValue([variante(49)]);
    const r = await service.listarAlertas();
    expect(r[0].presentaciones.map(p => p.disponible)).toEqual([49, 0]);
  });
  it('sin inventario expone cero disponible para todas las presentaciones', async () => {
    m.findMany.mockResolvedValue([{ ...variante(), inventario: null }]);
    expect((await service.listarAlertas())[0]).toMatchObject({ tieneRegistro: false, stockActual: 0, presentaciones: [{ disponible: 0 }, { disponible: 0 }] });
  });
  it('agregar 500 incrementa 500 y registra Entrada 500', async () => {
    const tx = transaccion(); tx.inventario.findUniqueOrThrow.mockResolvedValue({ stockActual: 600 });
    await service.ajustarStock(2, 500, { idUsuario: 1 });
    expect(tx.inventario.update).toHaveBeenCalledWith({ where: { idVariante: 2 }, data: { stockActual: { increment: 500 } } });
    expect(tx.movimientoInventario.create.mock.calls[0][0].data).toMatchObject({ tipo: 'Entrada', cantidad: 500, stockAnterior: 100, stockNuevo: 600, idUsuario: 1 });
  });
  it('quitar 120 usa decremento condicional y registra Salida 120', async () => {
    const tx = transaccion(250); tx.inventario.findUniqueOrThrow.mockResolvedValue({ stockActual: 130 });
    await service.ajustarStock(2, -120);
    expect(tx.inventario.updateMany.mock.calls[0][0]).toMatchObject({ where: { stockActual: { gte: 120 } }, data: { stockActual: { decrement: 120 } } });
    expect(tx.movimientoInventario.create.mock.calls[0][0].data).toMatchObject({ tipo: 'Salida', cantidad: 120, stockAnterior: 250, stockNuevo: 130 });
  });
  it('stock insuficiente no registra movimiento', async () => {
    const tx = transaccion(); tx.inventario.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.ajustarStock(2, -120)).rejects.toThrow('Stock insuficiente');
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });
  it('rechaza incremento que desborda el Int PostgreSQL', async () => {
    const tx = transaccion(2147483647);
    await expect(service.ajustarStock(2, 1)).rejects.toThrow('máximo permitido');
    expect(tx.inventario.update).not.toHaveBeenCalled();
  });
  it('variante inexistente devuelve error amigable', async () => {
    const tx = transaccion(); tx.$queryRaw.mockResolvedValue([]);
    await expect(service.ajustarStock(2, 1)).rejects.toThrow('Variante no encontrada');
  });
  it('inventario inexistente devuelve error amigable', async () => {
    const tx = transaccion(); tx.inventario.findUnique.mockResolvedValue(null);
    await expect(service.ajustarStock(2, 1)).rejects.toThrow('Inventario no encontrado');
  });
  it.each([[100, 250, 'Entrada', 150], [250, 80, 'Salida', 170]])('ajuste absoluto %i → %i registra %s %i', async (anterior, nuevo, tipo, cantidad) => {
    const tx = transaccion(anterior); tx.inventario.update.mockResolvedValue({ stockActual: nuevo });
    await repo.upsertConMovimiento(2, { stockActual: nuevo });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(tx.inventario.findUnique.mock.invocationCallOrder[0]);
    expect(tx.movimientoInventario.create.mock.calls[0][0].data).toMatchObject({ tipo, cantidad, stockAnterior: anterior, stockNuevo: nuevo });
  });
  it('cambiar solo límites no registra movimiento y permite limpiar máximo', async () => {
    const tx = transaccion(); tx.inventario.update.mockResolvedValue({ stockActual: 100 });
    await repo.upsertConMovimiento(2, { stockMinimo: 5, stockMaximo: null });
    expect(tx.inventario.update.mock.calls[0][0].data).toEqual({ stockMinimo: 5, stockMaximo: null });
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });
  it('valida límites contra valores existentes aunque request sea parcial', async () => {
    const tx = transaccion(); tx.inventario.findUnique.mockResolvedValue({ stockActual: 100, stockMinimo: 10, stockMaximo: 20 });
    await expect(repo.upsertConMovimiento(2, { stockMinimo: 30 })).rejects.toThrow('máximo físico');
    expect(tx.inventario.update).not.toHaveBeenCalled();
  });
  it.each([0, 1.5, NaN, 2147483648, -2147483648])('rechaza delta inválido %s', cantidad => {
    expect(ajustarInventarioSchema.safeParse({ cantidad }).success).toBe(false);
  });
  it.each([-1, 1.5, NaN, 2147483648, '', null, true])('rechaza stock absoluto inválido %s', stockActual => {
    expect(actualizarInventarioSchema.safeParse({ stockActual }).success).toBe(false);
  });
  it('acepta stock cero y máximo nullable', () => {
    expect(actualizarInventarioSchema.parse({ stockActual: 0, stockMaximo: null })).toMatchObject({ stockActual: 0, stockMaximo: null });
  });
});
