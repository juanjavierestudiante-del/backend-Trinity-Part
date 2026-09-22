import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const repository = vi.hoisted(() => ({
  findByUsuario: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  updateEstado: vi.fn(),
}));

vi.mock('../../src/repositories/pedido.repository.js', () => repository);

vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    const rol = req.header('x-test-role');
    if (!rol) {
      res.status(401).json({ error: 'Token no proporcionado' });
      return;
    }
    req.usuario = { id_usuario: 7, email: 'test@example.com', rol };
    next();
  },
  requireRole: (...roles: string[]) => (req: any, res: any, next: any) => {
    if (!roles.includes(req.usuario?.rol)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  },
}));

import app from '../../src/app.js';

const pedidoLogistico = {
  idPedido: 10,
  metodoEntrega: 'PUNTO_ENTREGA',
  idPuntoEntrega: 4,
  puntoEntregaNombre: 'Plaza Bolivia',
  puntoEntregaReferencia: 'Frente a la fuente',
  deliveryZona: null,
  deliveryDireccion: null,
  deliveryReferencia: null,
  direccionEntrega: null,
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  repository.findByUsuario.mockResolvedValue([pedidoLogistico]);
  repository.findAll.mockResolvedValue({ items: [pedidoLogistico], total: 1 });
});

describe('lectura HTTP de logística en pedidos', () => {
  it('GET /api/pedidos devuelve método, snapshots y campo legacy del pedido propio', async () => {
    const response = await request(app).get('/api/pedidos').set('x-test-role', 'CLIENTE');

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject(pedidoLogistico);
  });

  it('GET /api/admin/pedidos devuelve los campos logísticos para administración', async () => {
    const response = await request(app).get('/api/admin/pedidos').set('x-test-role', 'ADMIN');

    expect(response.status).toBe(200);
    expect(response.body.items[0]).toMatchObject(pedidoLogistico);
    expect(response.body).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
  });
});
