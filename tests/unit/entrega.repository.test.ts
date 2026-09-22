import { beforeEach, describe, expect, it, vi } from 'vitest';

const upsert = vi.hoisted(() => vi.fn());
const findMany = vi.hoisted(() => vi.fn());

vi.mock('../../src/config/prisma.js', () => ({
  default: {
    configuracionEntrega: { upsert },
    puntoEntrega: { findMany },
  },
}));

const repository = await import('../../src/repositories/entrega.repository.js');

beforeEach(() => vi.clearAllMocks());

describe('ConfiguracionEntrega singleton', () => {
  it('usa siempre id=1 y conserva una única operación upsert por actualización', async () => {
    await repository.actualizarConfiguracion({ montoMinimoDelivery: 200 });
    await repository.actualizarConfiguracion({ deliveryHabilitado: false });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.every(([query]) => query.where.id === 1 && query.create.id === 1)).toBe(true);
  });

  it('recupera id=1 con los valores solicitados si falta la fila global', async () => {
    await repository.actualizarConfiguracion({ deliveryHabilitado: false, montoMinimoDelivery: 225, mensajeDelivery: 'Entrega coordinada' });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 1 },
      create: {
        id: 1,
        deliveryHabilitado: false,
        montoMinimoDelivery: 225,
        mensajeDelivery: 'Entrega coordinada',
      },
    }));
  });
});

describe('consulta pública de puntos', () => {
  it('consulta únicamente activos y ordena por orden, luego nombre', async () => {
    await repository.listarPublicos();

    expect(findMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  });

  it('incluye un filtro de tipo validado por el controller', async () => {
    await repository.listarPublicos('RECOJO_TIENDA');

    expect(findMany).toHaveBeenCalledWith({
      where: { activo: true, tipo: 'RECOJO_TIENDA' },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  });
});
