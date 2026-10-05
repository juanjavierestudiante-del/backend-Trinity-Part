import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/config/prisma.js', () => ({ default: {} }));
import { bloquearPresentacionesParaVenta, bloquearPerfilesParaVenta, bloquearListasParaVenta, bloquearReglasParaVenta, bloquearListasParaEscrituraReglas } from '../../src/repositories/resolucion-comercial.repository.js';

describe('lock de presentación para checkout', () => {
  it('ordena y deduplica IDs, con SHARE antes de cualquier resolución', async () => {
    const query = vi.fn();
    await bloquearPresentacionesParaVenta([8, 2, 8, 5], { $queryRaw: query } as unknown as Prisma.TransactionClient);
    const [strings, ids] = query.mock.calls[0];
    expect(strings.join('')).toContain('ORDER BY id_presentacion ASC FOR SHARE');
    expect(ids.values).toEqual([2, 5, 8]);
  });
  it('no consulta para un conjunto vacío', async () => {
    const query = vi.fn();
    await bloquearPresentacionesParaVenta([], { $queryRaw: query } as unknown as Prisma.TransactionClient);
    expect(query).not.toHaveBeenCalled();
  });
});

describe('contrato de locking comercial', () => {
  it.each([
    [bloquearPerfilesParaVenta, 'id_perfil_precio', 'FOR SHARE'],
    [bloquearListasParaVenta, 'id_lista_precio', 'FOR SHARE'],
    [bloquearReglasParaVenta, 'id_regla_precio', 'FOR SHARE'],
    [bloquearListasParaEscrituraReglas, 'id_lista_precio', 'FOR NO KEY UPDATE'],
  ] as const)('ordena y deduplica %s', async (lock, column, mode) => {
    const query = vi.fn();
    await lock([8, 2, 8, 5], { $queryRaw: query } as unknown as Prisma.TransactionClient);
    const [strings, ids] = query.mock.calls[0];
    expect(strings.join('')).toContain(`ORDER BY ${column} ASC ${mode}`);
    expect(ids.values).toEqual([2, 5, 8]);
  });
  it.each([bloquearPerfilesParaVenta, bloquearListasParaVenta, bloquearReglasParaVenta, bloquearListasParaEscrituraReglas])('sin IDs no consulta: %s', async lock => {
    const query = vi.fn();
    await lock([], { $queryRaw: query } as unknown as Prisma.TransactionClient);
    expect(query).not.toHaveBeenCalled();
  });
});
