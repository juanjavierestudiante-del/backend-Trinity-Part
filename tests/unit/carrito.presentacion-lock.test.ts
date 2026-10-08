import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('../../src/config/prisma.js', () => ({ default: { $transaction: m.transaction } }));
const repo = await import('../../src/repositories/carrito.repository.js');
beforeEach(() => vi.clearAllMocks());
it('agregar conserva carrito -> variante -> presentación -> validación e insert en la misma transacción', async () => {
  const tx = { carrito: { upsert: vi.fn() }, $queryRaw: vi.fn().mockResolvedValue([]) };
  m.transaction.mockImplementation(async cb => cb(tx));
  await repo.agregarItemAtomico(1, 2, 3, 4);
  const sql = tx.$queryRaw.mock.calls.map(([parts]) => parts.join(''));
  expect(sql[0]).toContain('FROM carrito'); expect(sql[0]).toContain('FOR UPDATE');
  expect(sql[1]).toContain('FROM producto_variante'); expect(sql[1]).toContain('FOR SHARE');
  expect(sql[2]).toContain('FROM presentacion_venta'); expect(sql[2]).toContain('FOR SHARE');
  expect(sql[3]).toContain('agregar_item_carrito');
  expect(m.transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: 15000, maxWait: 15000 });
});
