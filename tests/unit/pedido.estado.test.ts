import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EstadoPedido } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findByIdEnTx: vi.fn(),
}));

vi.mock('../../src/config/prisma.js', () => ({ default: { $transaction: mocks.transaction } }));
vi.mock('../../src/repositories/pedido.repository.js', () => ({ findByIdEnTx: mocks.findByIdEnTx }));

const pedidoService = await import('../../src/services/pedido.service.js');

type ItemDetalle = { idVariante: number; cantidad: number };

const crearEscenario = ({
  estadoInicial,
  items = [{ idVariante: 5, cantidad: 2 }],
  gateCount = 1,
  persistido,
  stockAntesPorVariante = new Map([[5, 10]]),
}: {
  estadoInicial: EstadoPedido;
  items?: ItemDetalle[];
  gateCount?: number;
  persistido?: EstadoPedido;
  stockAntesPorVariante?: Map<number, number>;
}) => {
  const tx: any = {
    pedido: {
      findUnique: vi.fn().mockImplementation(({ select }: any) => {
        if (select?.items) {
          return Promise.resolve({ idPedido: 10, estado: estadoInicial, items });
        }
        return Promise.resolve({ estado: persistido ?? estadoInicial });
      }),
      updateMany: vi.fn().mockResolvedValue({ count: gateCount }),
    },
    inventario: {
      update: vi.fn().mockImplementation((args: any) => {
        const stockActual = (stockAntesPorVariante.get(args.where.idVariante) ?? 0) + args.data.stockActual.increment;
        return Promise.resolve({ stockActual });
      }),
    },
    movimientoInventario: { create: vi.fn().mockResolvedValue({ idMovimiento: 1 }) },
  };

  mocks.transaction.mockImplementation(async (callback: (t: typeof tx) => unknown) => callback(tx));
  mocks.findByIdEnTx.mockResolvedValue({ idPedido: 10, estado: 'CONFIRMADO' });
  return tx;
};

beforeEach(() => vi.clearAllMocks());

describe('ciclo de vida del pedido (Fase 4)', () => {
  it('CASO A: PENDIENTE → CONFIRMADO sin tocar stock ni crear Entrada', async () => {
    const tx = crearEscenario({ estadoInicial: 'PENDIENTE' });

    const resultado = await pedidoService.cambiarEstado(10, 'CONFIRMADO');

    expect(tx.pedido.updateMany).toHaveBeenCalledWith({
      where: { idPedido: 10, estado: 'PENDIENTE' },
      data: { estado: 'CONFIRMADO' },
    });
    expect(tx.inventario.update).not.toHaveBeenCalled();
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
    expect(resultado).toEqual({ idPedido: 10, estado: 'CONFIRMADO' });
  });

  it('CASO B: PENDIENTE → CANCELADO restaura stock una vez con movimiento Entrada', async () => {
    const tx = crearEscenario({ estadoInicial: 'PENDIENTE' });

    await pedidoService.cambiarEstado(10, 'CANCELADO');

    expect(tx.inventario.update).toHaveBeenCalledWith({
      where: { idVariante: 5 },
      data: { stockActual: { increment: 2 } },
      select: { stockActual: true },
    });
    expect(tx.movimientoInventario.create).toHaveBeenCalledTimes(1);
    expect(tx.movimientoInventario.create).toHaveBeenCalledWith({
      data: {
        idVariante: 5,
        tipo: 'Entrada',
        cantidad: 2,
        stockAnterior: 10,
        stockNuevo: 12,
        motivo: 'Cancelación Pedido #10',
        idUsuario: null,
      },
    });
  });

  it('CASO C: CONFIRMADO → CANCELADO restaura stock exactamente una vez', async () => {
    const tx = crearEscenario({ estadoInicial: 'CONFIRMADO' });

    await pedidoService.cambiarEstado(10, 'CANCELADO');

    expect(tx.pedido.updateMany).toHaveBeenCalledWith({
      where: { idPedido: 10, estado: 'CONFIRMADO' },
      data: { estado: 'CANCELADO' },
    });
    expect(tx.inventario.update).toHaveBeenCalledTimes(1);
    expect(tx.movimientoInventario.create).toHaveBeenCalledTimes(1);
  });

  it('CASO D: CONFIRMADO → PENDIENTE rechazado (409), stock intacto', async () => {
    const tx = crearEscenario({ estadoInicial: 'CONFIRMADO' });

    await expect(pedidoService.cambiarEstado(10, 'PENDIENTE')).rejects.toMatchObject({
      statusCode: 409,
      message: 'No se puede cambiar un pedido CONFIRMADO a PENDIENTE.',
    });
    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    expect(tx.inventario.update).not.toHaveBeenCalled();
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('CASO E: CANCELADO → CONFIRMADO rechazado (409), sin cambios de stock', async () => {
    const tx = crearEscenario({ estadoInicial: 'CANCELADO' });

    await expect(pedidoService.cambiarEstado(10, 'CONFIRMADO')).rejects.toMatchObject({
      statusCode: 409,
      message: 'No se puede cambiar un pedido CANCELADO a CONFIRMADO.',
    });
    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    expect(tx.inventario.update).not.toHaveBeenCalled();
  });

  it('CASO F: CANCELADO → PENDIENTE rechazado (409)', async () => {
    const tx = crearEscenario({ estadoInicial: 'CANCELADO' });

    await expect(pedidoService.cambiarEstado(10, 'PENDIENTE')).rejects.toMatchObject({
      statusCode: 409,
      message: 'No se puede cambiar un pedido CANCELADO a PENDIENTE.',
    });
    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('CASO G1: CONFIRMADO → CONFIRMADO éxito idempotente sin efectos secundarios', async () => {
    const tx = crearEscenario({ estadoInicial: 'CONFIRMADO' });

    await pedidoService.cambiarEstado(10, 'CONFIRMADO');

    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    expect(tx.inventario.update).not.toHaveBeenCalled();
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('CASO G2: CANCELADO → CANCELADO idempotente sin volver a incrementar stock', async () => {
    const tx = crearEscenario({ estadoInicial: 'CANCELADO' });

    await pedidoService.cambiarEstado(10, 'CANCELADO');

    expect(tx.pedido.updateMany).not.toHaveBeenCalled();
    expect(tx.inventario.update).not.toHaveBeenCalled();
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
    expect(mocks.findByIdEnTx).toHaveBeenCalledTimes(1);
  });

  it('CASO H: doble cancelación consecutiva restaura el stock una sola vez', async () => {
    const primera = crearEscenario({ estadoInicial: 'PENDIENTE' });
    await pedidoService.cambiarEstado(10, 'CANCELADO');
    expect(primera.inventario.update).toHaveBeenCalledTimes(1);
    expect(primera.movimientoInventario.create).toHaveBeenCalledTimes(1);

    const segunda = crearEscenario({ estadoInicial: 'CANCELADO' });
    await pedidoService.cambiarEstado(10, 'CANCELADO');
    expect(segunda.inventario.update).not.toHaveBeenCalled();
    expect(segunda.movimientoInventario.create).not.toHaveBeenCalled();
    expect(segunda.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('CASO I: carrera con destino alcanzado (gate 0, persistido CANCELADO) → éxito idempotente sin devolución', async () => {
    const tx = crearEscenario({ estadoInicial: 'PENDIENTE', gateCount: 0, persistido: 'CANCELADO' });

    await expect(pedidoService.cambiarEstado(10, 'CANCELADO')).resolves.toBeTruthy();

    expect(tx.pedido.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.inventario.update).not.toHaveBeenCalled();
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('CASO J: carrera con destino diferente (gate 0, persistido CONFIRMADO) → 409 sin efectos', async () => {
    const tx = crearEscenario({ estadoInicial: 'PENDIENTE', gateCount: 0, persistido: 'CONFIRMADO' });

    await expect(pedidoService.cambiarEstado(10, 'CANCELADO')).rejects.toMatchObject({
      statusCode: 409,
      message: 'El pedido fue modificado simultáneamente por otro usuario. Estado actual: CONFIRMADO.',
    });
    expect(tx.inventario.update).not.toHaveBeenCalled();
    expect(tx.movimientoInventario.create).not.toHaveBeenCalled();
  });

  it('agrupa cantidades por idVariante repetida en un único incremento y movimiento', async () => {
    const stock = new Map([[5, 10]]);
    const tx = crearEscenario({
      estadoInicial: 'PENDIENTE',
      items: [
        { idVariante: 5, cantidad: 2 },
        { idVariante: 5, cantidad: 3 },
      ],
      stockAntesPorVariante: stock,
    });

    await pedidoService.cambiarEstado(10, 'CANCELADO');

    expect(tx.inventario.update).toHaveBeenCalledTimes(1);
    expect(tx.inventario.update).toHaveBeenCalledWith({
      where: { idVariante: 5 },
      data: { stockActual: { increment: 5 } },
      select: { stockActual: true },
    });
    expect(tx.movimientoInventario.create).toHaveBeenCalledTimes(1);
    expect(tx.movimientoInventario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cantidad: 5, stockAnterior: 10, stockNuevo: 15 }),
    });
  });
});