import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
const s = vi.hoisted(() => ({ obtenerConfiguracion: vi.fn(), guardarPresentacion: vi.fn(), guardarPerfil: vi.fn(), asignarPerfiles: vi.fn(), guardarRegla: vi.fn(), eliminarRegla: vi.fn() }));
vi.mock('../../src/services/comercial-admin.service.js', () => s);
vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  authMiddleware: (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const rol = req.header('x-test-role'); if (!rol) { res.status(401).end(); return; }
    req.usuario = { id_usuario: 1, email: 'test@example.invalid', rol: rol as 'ADMIN' }; next();
  },
  requireRole: (...roles: string[]) => (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    if (!roles.includes(req.usuario?.rol ?? '')) { res.status(403).end(); return; } next();
  },
}));
import app from '../../src/app.js';
beforeEach(() => { vi.clearAllMocks(); s.obtenerConfiguracion.mockResolvedValue({ producto: { idProducto: 1 }, presentaciones: [], perfiles: [], listas: [], variantes: [] }); s.guardarPresentacion.mockResolvedValue({ idPresentacion: 2 }); s.guardarPerfil.mockResolvedValue({ idPerfilPrecio: 3 }); s.guardarRegla.mockResolvedValue({ idReglaPrecio: 4, precioPorPresentacion: '32.00' }); });
describe('API Admin comercial', () => {
  it('lectura consolidada protegida por sesión y rol', async () => {
    const url = '/api/admin/productos/1/configuracion-comercial';
    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).get(url).set('x-test-role', 'CLIENTE')).status).toBe(403);
    expect((await request(app).get(url).set('x-test-role', 'ADMIN')).body).toMatchObject({ presentaciones: [], perfiles: [], listas: [], variantes: [] });
  });
  it('crea presentación y rechaza cantidad inválida', async () => {
    const url = '/api/admin/productos/1/presentaciones';
    expect((await request(app).post(url).set('x-test-role','ADMIN').send({ nombre: 'Pack', cantidadBase: 50 })).status).toBe(201);
    expect((await request(app).post(url).set('x-test-role','ADMIN').send({ nombre: 'Pack', cantidadBase: 0 })).status).toBe(400);
  });
  it('edita perfil y presentación', async () => {
    expect((await request(app).patch('/api/admin/productos/1/perfiles-precio/3').set('x-test-role','ADMIN').send({ principal: true })).status).toBe(200);
    expect((await request(app).patch('/api/admin/productos/1/presentaciones/2').set('x-test-role','ADMIN').send({ orden: 2 })).status).toBe(200);
  });
  it('asigna individual y masivo sin permitir CLIENTE', async () => {
    const url = '/api/admin/productos/1/variantes/6/perfil';
    expect((await request(app).patch(url).set('x-test-role','CLIENTE').send({ idPerfilPrecio: 3 })).status).toBe(403);
    expect((await request(app).patch(url).set('x-test-role','ADMIN').send({ idPerfilPrecio: null })).status).toBe(204);
    expect(s.asignarPerfiles).toHaveBeenCalledWith(1, [{ idVariante: 6, idPerfilPrecio: null }]);
    expect((await request(app).patch('/api/admin/productos/1/variantes/perfiles').set('x-test-role','ADMIN').send({ asignaciones: [{ idVariante: 6, idPerfilPrecio: 3 }] })).status).toBe(204);
  });
  it('crea, edita y elimina reglas', async () => {
    const url = '/api/admin/productos/1/listas-precio/4/reglas';
    expect((await request(app).post(url).set('x-test-role','ADMIN').send({ nombre: 'Tres', cantidadMinima: 3, precioPorPresentacion: '30.00' })).status).toBe(201);
    expect((await request(app).patch(`${url}/5`).set('x-test-role','ADMIN').send({ activo: false })).status).toBe(200);
    expect((await request(app).delete(`${url}/5`).set('x-test-role','ADMIN')).status).toBe(204);
  });
});
