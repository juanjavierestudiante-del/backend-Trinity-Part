import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const service = vi.hoisted(() => ({ actualizarPerfil: vi.fn() }));

vi.mock('../../src/services/auth.service.js', () => service);
vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    if (!req.header('x-test-user')) {
      res.status(401).json({ error: 'Token no proporcionado' });
      return;
    }
    req.usuario = { id_usuario: 4, rol: 'CLIENTE' };
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

beforeEach(() => {
  vi.clearAllMocks();
  service.actualizarPerfil.mockResolvedValue({
    id_usuario: 4, nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', telefono: '+59171234567',
    avatarUrl: null, rol: 'CLIENTE', estado: 'Activo', emailVerificado: false, telefonoVerificado: false,
  });
});

describe('PATCH /api/auth/profile', () => {
  it('requiere una sesión válida', async () => {
    const response = await request(app).patch('/api/auth/profile').send({ nombre: 'Ana', apellido: 'Pérez', telefono: '71234567' });
    expect(response.status).toBe(401);
  });

  it('usa el usuario de sesión, devuelve un contrato seguro y rechaza campos no permitidos', async () => {
    const correcto = await request(app).patch('/api/auth/profile').set('x-test-user', '1').send({ nombre: 'Ana', apellido: 'Pérez', telefono: '71234567' });
    const invalido = await request(app).patch('/api/auth/profile').set('x-test-user', '1').send({ nombre: 'Ana', apellido: 'Pérez', telefono: '71234567', email: 'otro@example.com' });

    expect(correcto.status).toBe(200);
    expect(service.actualizarPerfil).toHaveBeenCalledWith(4, { nombre: 'Ana', apellido: 'Pérez', telefono: '71234567' });
    expect(correcto.body.usuario).not.toHaveProperty('password');
    expect(invalido.status).toBe(400);
  });
});
