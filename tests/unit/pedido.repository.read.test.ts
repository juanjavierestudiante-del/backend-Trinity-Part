import { beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = vi.hoisted(() => ({
  pedido: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  carrito: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../src/config/prisma.js', () => ({ default: prisma }));

const repository = await import('../../src/repositories/pedido.repository.js');

const pedidoLogistico = {
  idPedido: 10,
  metodoEntrega: 'DELIVERY',
  idPuntoEntrega: null,
  puntoEntregaNombre: null,
  puntoEntregaReferencia: null,
  deliveryZona: 'Sopocachi',
  deliveryDireccion: 'Av. 6 de Agosto 100',
  deliveryReferencia: 'Puerta azul',
  direccionEntrega: 'Av. 6 de Agosto 100',
};

beforeEach(() => vi.clearAllMocks());

describe('lectura logística de pedidos', () => {
  it('GET propio conserva metodoEntrega y snapshots devueltos por Prisma', async () => {
    prisma.pedido.findMany.mockResolvedValue([pedidoLogistico]);

    await expect(repository.findByUsuario(4)).resolves.toEqual([pedidoLogistico]);
    expect(prisma.pedido.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { idUsuario: 4 } }));
  });

  it('listado admin conserva los campos logísticos y la dirección legacy', async () => {
    prisma.pedido.findMany.mockReturnValue(undefined);
    prisma.pedido.count.mockReturnValue(undefined);
    prisma.$transaction.mockResolvedValue([[pedidoLogistico], 1]);

    await expect(repository.findAll()).resolves.toEqual({ items: [pedidoLogistico], total: 1 });
  });

  it('detalle y actualización mantienen un pedido histórico sin método', async () => {
    const historico = { ...pedidoLogistico, metodoEntrega: null, deliveryZona: null, deliveryDireccion: null, direccionEntrega: null };
    prisma.pedido.findUnique.mockResolvedValue(historico);
    prisma.pedido.update.mockResolvedValue(historico);

    await expect(repository.findById(10)).resolves.toEqual(historico);
    await expect(repository.updateEstado(10, 'CONFIRMADO')).resolves.toEqual(historico);
  });
});
