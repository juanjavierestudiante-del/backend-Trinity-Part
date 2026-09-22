import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), resolverPreciosAgrupados: vi.fn() }));

vi.mock('../../src/config/prisma.js', () => ({ default: { $transaction: mocks.transaction } }));
vi.mock('../../src/repositories/pedido.repository.js', () => ({}));
vi.mock('../../src/services/precio-cantidad.service.js', () => ({ resolverPreciosAgrupados: mocks.resolverPreciosAgrupados }));

const pedidoService = await import('../../src/services/pedido.service.js');
const { crearPedidoSchema } = await import('../../src/validations/pedido.validation.js');

type Escenario = {
  precio?: string;
  punto?: Record<string, unknown> | null;
  configuracion?: { deliveryHabilitado: boolean; montoMinimoDelivery: Prisma.Decimal };
};

const crearEscenario = ({ precio = '200', punto = null, configuracion }: Escenario = {}) => {
  const pedidoCreate = vi.fn(async ({ data }) => ({ idPedido: 77, ...data }));
  const tx = {
    carrito: {
      findUnique: vi.fn().mockResolvedValue({
        idCarrito: 12,
        items: [{
          idVariante: 9,
          cantidad: 1,
          variante: { sku: 'SKU-9', inventario: { stockActual: 10 } },
        }],
      }),
    },
    puntoEntrega: { findUnique: vi.fn().mockResolvedValue(punto) },
    configuracionEntrega: {
      upsert: vi.fn().mockResolvedValue(configuracion ?? {
        deliveryHabilitado: true,
        montoMinimoDelivery: new Prisma.Decimal('150'),
      }),
    },
    pedido: { create: pedidoCreate },
    inventario: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    movimientoInventario: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    carritoDetalle: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));
  mocks.resolverPreciosAgrupados.mockResolvedValue({
    lineas: [{ idVariante: 9, precioPorPresentacion: new Prisma.Decimal(precio) }],
    total: new Prisma.Decimal(precio),
  });
  return { tx, pedidoCreate };
};

const contacto = { nombreContacto: 'Ana Pérez', telefonoContacto: '71234567' };

beforeEach(() => vi.clearAllMocks());

describe('contrato logístico de pedidos 5C.1', () => {
  it('mantiene el contrato legacy temporal y normaliza su teléfono', async () => {
    const { pedidoCreate } = crearEscenario();
    const pedido = await pedidoService.crear(3, { ...contacto, direccionEntrega: 'Calle anterior', notas: 'Legacy' });

    expect(pedido.telefonoContacto).toBe('+59171234567');
    expect(pedido.direccionEntrega).toBe('Calle anterior');
    expect(pedido.metodoEntrega).toBeUndefined();
    expect(pedidoCreate.mock.calls[0][0].data.metodoEntrega).toBeUndefined();
  });

  it('crea PUNTO_ENTREGA con FK y snapshot del punto', async () => {
    const punto = { idPuntoEntrega: 4, nombre: 'Plaza Bolivia', referencia: 'Frente a la plaza', tipo: 'PUNTO_ENTREGA', activo: true };
    const { pedidoCreate } = crearEscenario({ punto });
    const pedido = await pedidoService.crear(3, { ...contacto, metodoEntrega: 'PUNTO_ENTREGA', idPuntoEntrega: 4 });

    expect(pedido.metodoEntrega).toBe('PUNTO_ENTREGA');
    expect(pedido.idPuntoEntrega).toBe(4);
    expect(pedido.puntoEntregaNombre).toBe('Plaza Bolivia');
    expect(pedido.puntoEntregaReferencia).toBe('Frente a la plaza');
    expect(pedido.direccionEntrega).toBeUndefined();
    expect(pedidoCreate.mock.calls[0][0].data.deliveryDireccion).toBeUndefined();
  });

  it('conserva el snapshot aunque el punto cambie posteriormente', async () => {
    const punto = { idPuntoEntrega: 4, nombre: 'Plaza Bolivia', referencia: null, tipo: 'PUNTO_ENTREGA', activo: true };
    crearEscenario({ punto });
    const pedido = await pedidoService.crear(3, { ...contacto, metodoEntrega: 'PUNTO_ENTREGA', idPuntoEntrega: 4 });
    punto.nombre = 'Nombre actualizado';

    expect(pedido.puntoEntregaNombre).toBe('Plaza Bolivia');
  });

  it.each([
    ['inexistente', null, 404],
    ['inactivo', { idPuntoEntrega: 4, nombre: 'Plaza', referencia: null, tipo: 'PUNTO_ENTREGA', activo: false }, 409],
    ['de tipo incorrecto', { idPuntoEntrega: 4, nombre: 'Recojo', referencia: null, tipo: 'RECOJO_TIENDA', activo: true }, 400],
  ])('rechaza punto %s', async (_caso, punto, statusCode) => {
    crearEscenario({ punto });
    await expect(pedidoService.crear(3, { ...contacto, metodoEntrega: 'PUNTO_ENTREGA', idPuntoEntrega: 4 }))
      .rejects.toMatchObject({ statusCode });
  });

  it('crea RECOJO_TIENDA solo con un punto de recojo activo y guarda snapshot', async () => {
    const punto = { idPuntoEntrega: 7, nombre: 'Recojo en tienda', referencia: null, tipo: 'RECOJO_TIENDA', activo: true };
    crearEscenario({ punto });
    const pedido = await pedidoService.crear(3, { ...contacto, metodoEntrega: 'RECOJO_TIENDA', idPuntoEntrega: 7 });

    expect(pedido.metodoEntrega).toBe('RECOJO_TIENDA');
    expect(pedido.puntoEntregaNombre).toBe('Recojo en tienda');
    expect(pedido.direccionEntrega).toBeUndefined();
  });

  it('crea DELIVERY válido, guarda sus snapshots y usa direccionEntrega solo como compatibilidad', async () => {
    const { pedidoCreate } = crearEscenario({ precio: '150.00' });
    const pedido = await pedidoService.crear(3, {
      ...contacto,
      metodoEntrega: 'DELIVERY',
      deliveryZona: 'Sopocachi',
      deliveryDireccion: 'Av. 6 de Agosto 100',
      deliveryReferencia: 'Puerta azul',
    });

    expect(pedido.metodoEntrega).toBe('DELIVERY');
    expect(pedido.deliveryZona).toBe('Sopocachi');
    expect(pedido.deliveryDireccion).toBe('Av. 6 de Agosto 100');
    expect(pedido.deliveryReferencia).toBe('Puerta azul');
    expect(pedido.direccionEntrega).toBe('Av. 6 de Agosto 100');
    expect(pedidoCreate.mock.calls[0][0].data.idPuntoEntrega).toBeUndefined();
  });

  it.each([
    ['está deshabilitado', { deliveryHabilitado: false, montoMinimoDelivery: new Prisma.Decimal('150') }, '200', 409],
    ['no alcanza el mínimo', { deliveryHabilitado: true, montoMinimoDelivery: new Prisma.Decimal('150') }, '149.99', 409],
  ])('rechaza DELIVERY cuando %s', async (_caso, configuracion, precio, statusCode) => {
    crearEscenario({ precio, configuracion });
    await expect(pedidoService.crear(3, { ...contacto, metodoEntrega: 'DELIVERY', deliveryZona: 'Centro', deliveryDireccion: 'Calle 1' }))
      .rejects.toMatchObject({ statusCode });
  });

  it('compara Decimal exactamente en el mínimo y no recibe un total del cliente', async () => {
    crearEscenario({ precio: '150.00' });
    const pedido = await pedidoService.crear(3, { ...contacto, metodoEntrega: 'DELIVERY', deliveryZona: 'Centro', deliveryDireccion: 'Calle 1' } as never);

    expect(new Prisma.Decimal(pedido.total).equals(new Prisma.Decimal('150.00'))).toBe(true);
    expect(crearPedidoSchema.safeParse({
      ...contacto,
      metodoEntrega: 'DELIVERY',
      deliveryZona: 'Centro',
      deliveryDireccion: 'Calle 1',
      total: 1,
    }).success).toBe(false);
  });

  it('rechaza teléfono inválido sin modificar datos de Usuario', async () => {
    crearEscenario();
    await expect(pedidoService.crear(3, { ...contacto, telefonoContacto: '123', direccionEntrega: null }))
      .rejects.toMatchObject({ statusCode: 400, message: 'Teléfono boliviano inválido' });
  });

  it('el schema exige campos condicionales y no infiere retiro desde direccionEntrega nula', () => {
    expect(crearPedidoSchema.safeParse({ ...contacto, metodoEntrega: 'DELIVERY', deliveryZona: 'Centro' }).success).toBe(false);
    expect(crearPedidoSchema.safeParse({ ...contacto, metodoEntrega: 'PUNTO_ENTREGA', idPuntoEntrega: 1, direccionEntrega: null }).success).toBe(false);
    expect(crearPedidoSchema.safeParse({ ...contacto, direccionEntrega: null }).success).toBe(true);
  });
});
