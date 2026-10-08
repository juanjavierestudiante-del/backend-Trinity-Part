import { Prisma } from '@prisma/client';
import { expect, it, vi } from 'vitest';
vi.mock('../../src/config/prisma.js', () => ({ default: {} }));
import { bloquearProductoComercial, asignarPerfiles, obtener } from '../../src/repositories/comercial-admin.repository.js';
it('bloquea producto, variantes, presentaciones, perfiles y listas en orden estable', async () => {
  const tx = { $queryRaw: vi.fn().mockResolvedValue([{ id_producto: 1 }]), listaPrecio: { findMany: vi.fn().mockResolvedValue([{ idListaPrecio: 8 }, { idListaPrecio: 2 }, { idListaPrecio: 8 }]) } };
  expect(await bloquearProductoComercial(1, tx as unknown as Prisma.TransactionClient)).toBe(true);
  const sql = tx.$queryRaw.mock.calls.map(([parts]) => parts.join(''));
  expect(sql.map(s => s.match(/FROM (\w+)/)?.[1])).toEqual(['producto', 'producto_variante', 'presentacion_venta', 'perfil_precio', 'lista_precio']);
  expect(sql.slice(1).every(s => s.includes('ORDER BY') && s.includes('FOR NO KEY UPDATE'))).toBe(true);
  expect(tx.$queryRaw.mock.calls[4][1].values).toEqual([2, 8]);
});
it('producto ausente no bloquea entidades ni escribe', async () => {
  const tx = { $queryRaw: vi.fn().mockResolvedValue([]) };
  expect(await bloquearProductoComercial(9, tx as unknown as Prisma.TransactionClient)).toBe(false);
  expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
});
it('asignación masiva agrupa escrituras por perfil en vez de por variante', async () => {
  const tx = { productoVariante: { updateMany: vi.fn() } };
  await asignarPerfiles(tx as unknown as Prisma.TransactionClient, [{ idVariante: 1, idPerfilPrecio: 3 }, { idVariante: 2, idPerfilPrecio: 3 }, { idVariante: 4, idPerfilPrecio: null }]);
  expect(tx.productoVariante.updateMany).toHaveBeenCalledTimes(2);
  expect(tx.productoVariante.updateMany.mock.calls[0][0]).toEqual({ where: { idVariante: { in: [1, 2] } }, data: { idPerfilPrecio: 3 } });
});
it('lectura consolidada incluye reglas ordenadas sin consultar por variante', async () => {
  const tx = { producto: { findUnique: vi.fn() } };
  await obtener(1, tx as unknown as Prisma.TransactionClient);
  expect(tx.producto.findUnique).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ select: expect.objectContaining({ listaPrecios: expect.objectContaining({ include: { reglas: { orderBy: [{ cantidadMinima: 'asc' }, { idReglaPrecio: 'asc' }] } } }) }) }));
});
