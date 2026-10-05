import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/config/prisma.js', () => ({ default: {} }));
import { reponerInventarioSeguro } from '../../src/repositories/inventario.repository.js';
function setup(count: number) {
  const inventory = { updateMany: vi.fn().mockResolvedValue({ count }), findUnique: vi.fn().mockResolvedValue({ idInventario: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ stockActual: 200 }) };
  return { inventory, tx: { inventario: inventory } as unknown as Prisma.TransactionClient };
}
describe('reposición dentro del rango Int', () => {
  it('incrementa con límite en la misma sentencia y devuelve el stock real', async () => {
    const { tx, inventory } = setup(1);
    expect(await reponerInventarioSeguro(tx, 1, 100)).toEqual({ stockActual: 200 });
    expect(inventory.updateMany).toHaveBeenCalledWith({ where: { idVariante: 1, stockActual: { lte: 2147483547 } }, data: { stockActual: { increment: 100 } } });
  });
  it('condición rechazada devuelve error de dominio, no SQL', async () => {
    const { tx } = setup(0);
    await expect(reponerInventarioSeguro(tx, 1, 100)).rejects.toMatchObject({ statusCode: 409, message: 'La reposición excede el límite permitido de inventario.' });
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])('rechaza consumo inválido %s antes de escribir', async qty => {
    const { tx, inventory } = setup(1);
    await expect(reponerInventarioSeguro(tx, 1, qty)).rejects.toMatchObject({ statusCode: 409 });
    expect(inventory.updateMany).not.toHaveBeenCalled();
  });
  it('distingue inventario inexistente', async () => {
    const { tx, inventory } = setup(0); inventory.findUnique.mockResolvedValue(null);
    await expect(reponerInventarioSeguro(tx, 1, 100)).rejects.toMatchObject({ statusCode: 404 });
  });
});
