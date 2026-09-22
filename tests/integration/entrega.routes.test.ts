import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const repository = vi.hoisted(() => ({
  listarPublicos: vi.fn(),
  listarAdmin: vi.fn(),
  buscar: vi.fn(),
  crear: vi.fn(),
  actualizar: vi.fn(),
  contarRecojosActivos: vi.fn(),
  configuracion: vi.fn(),
  actualizarConfiguracion: vi.fn(),
}));

vi.mock('../../src/repositories/entrega.repository.js', () => repository);

vi.mock('../../src/middlewares/auth.middleware.js', () => ({
  authMiddleware: (req: any, res: any, next: any) => {
    const rol = req.header('x-test-role');
    if (!rol) {
      res.status(401).json({ error: 'Token no proporcionado' });
      return;
    }
    req.usuario = { id_usuario: 1, email: 'test@example.com', rol };
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

const puntos = [
  { idPuntoEntrega: 2, nombre: 'Beta', activo: true, orden: 1, tipo: 'PUNTO_ENTREGA' },
  { idPuntoEntrega: 1, nombre: 'Alfa', activo: true, orden: 1, tipo: 'PUNTO_ENTREGA' },
  { idPuntoEntrega: 3, nombre: 'Recojo', activo: true, orden: 2, tipo: 'RECOJO_TIENDA' },
];
const configuracion = {
  id: 1,
  deliveryHabilitado: true,
  montoMinimoDelivery: { toString: () => '150' },
  mensajeDelivery: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  repository.listarPublicos.mockImplementation(async (tipo?: string) =>
    puntos.filter((punto) => !tipo || punto.tipo === tipo),
  );
  repository.listarAdmin.mockResolvedValue([...puntos, { idPuntoEntrega: 4, nombre: 'Inactivo', activo: false, orden: 3, tipo: 'PUNTO_ENTREGA' }]);
  repository.configuracion.mockResolvedValue(configuracion);
  repository.actualizarConfiguracion.mockImplementation(async (data: Record<string, unknown>) => ({ ...configuracion, ...data }));
});

describe('API pública de logística', () => {
  it('devuelve puntos activos ordenados y nunca los inactivos', async () => {
    const response = await request(app).get('/api/entrega/puntos');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(puntos);
    expect(repository.listarPublicos).toHaveBeenCalledWith(undefined);
  });

  it.each(['PUNTO_ENTREGA', 'RECOJO_TIENDA'])('filtra el tipo %s', async (tipo) => {
    const response = await request(app).get('/api/entrega/puntos').query({ tipo });

    expect(response.status).toBe(200);
    expect(response.body.every((punto: { tipo: string }) => punto.tipo === tipo)).toBe(true);
    expect(repository.listarPublicos).toHaveBeenCalledWith(tipo);
  });

  it('rechaza un tipo inválido', async () => {
    const response = await request(app).get('/api/entrega/puntos').query({ tipo: 'DELIVERY' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Tipo de punto inválido');
  });

  it('expone la configuración pública con Decimal serializado como string', async () => {
    const response = await request(app).get('/api/entrega/configuracion');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deliveryHabilitado: true, montoMinimoDelivery: '150', mensajeDelivery: null });
    expect(typeof response.body.montoMinimoDelivery).toBe('string');
  });
});

describe('API admin de logística', () => {
  it('rechaza una solicitud sin sesión y a un CLIENTE', async () => {
    const sinSesion = await request(app).get('/api/admin/puntos-entrega');
    const cliente = await request(app).get('/api/admin/puntos-entrega').set('x-test-role', 'CLIENTE');

    expect(sinSesion.status).toBe(401);
    expect(cliente.status).toBe(403);
  });

  it('permite a ADMIN listar puntos activos e inactivos', async () => {
    const response = await request(app).get('/api/admin/puntos-entrega').set('x-test-role', 'ADMIN');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(4);
    expect(response.body.some((punto: { activo: boolean }) => !punto.activo)).toBe(true);
  });

  it('impide que CLIENTE cree, edite o cambie configuración', async () => {
    const crear = await request(app).post('/api/admin/puntos-entrega').set('x-test-role', 'CLIENTE').send({ nombre: 'Nuevo', tipo: 'PUNTO_ENTREGA' });
    const editar = await request(app).patch('/api/admin/puntos-entrega/1').set('x-test-role', 'CLIENTE').send({ nombre: 'Nuevo' });
    const leerConfiguracion = await request(app).get('/api/admin/configuracion-entrega').set('x-test-role', 'CLIENTE');
    const configurar = await request(app).patch('/api/admin/configuracion-entrega').set('x-test-role', 'CLIENTE').send({ montoMinimoDelivery: 200 });

    expect([crear.status, editar.status, leerConfiguracion.status, configurar.status]).toEqual([403, 403, 403, 403]);
  });

  it('crea un punto válido y traduce un nombre duplicado a 409 sin filtrar Prisma', async () => {
    repository.crear.mockResolvedValue({ idPuntoEntrega: 8, nombre: 'Nuevo', tipo: 'PUNTO_ENTREGA', activo: true, orden: 8 });
    const creado = await request(app).post('/api/admin/puntos-entrega').set('x-test-role', 'ADMIN').send({ nombre: 'Nuevo', tipo: 'PUNTO_ENTREGA', orden: 8 });

    repository.crear.mockRejectedValue({ code: 'P2002', meta: { target: ['nombre'] } });
    const duplicado = await request(app).post('/api/admin/puntos-entrega').set('x-test-role', 'ADMIN').send({ nombre: 'Nuevo', tipo: 'PUNTO_ENTREGA' });

    expect(creado.status).toBe(201);
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error).toBe('Ya existe un punto con ese nombre');
    expect(JSON.stringify(duplicado.body)).not.toContain('P2002');
  });

  it('valida tipo y orden antes de crear', async () => {
    const tipo = await request(app).post('/api/admin/puntos-entrega').set('x-test-role', 'ADMIN').send({ nombre: 'Nuevo', tipo: 'DELIVERY' });
    const orden = await request(app).post('/api/admin/puntos-entrega').set('x-test-role', 'ADMIN').send({ nombre: 'Nuevo', tipo: 'PUNTO_ENTREGA', orden: -1 });

    expect([tipo.status, orden.status]).toEqual([400, 400]);
  });

  it('edita nombre, descripción, referencia y orden; 404 si el punto no existe', async () => {
    repository.buscar.mockResolvedValue({ idPuntoEntrega: 1, tipo: 'PUNTO_ENTREGA', activo: true });
    repository.actualizar.mockResolvedValue({ idPuntoEntrega: 1, nombre: 'Actualizado', descripcion: 'Descripción', referencia: 'Referencia', orden: 9 });
    const actualizado = await request(app).patch('/api/admin/puntos-entrega/1').set('x-test-role', 'ADMIN').send({ nombre: 'Actualizado', descripcion: 'Descripción', referencia: 'Referencia', orden: 9 });

    repository.buscar.mockResolvedValue(null);
    const inexistente = await request(app).patch('/api/admin/puntos-entrega/99').set('x-test-role', 'ADMIN').send({ nombre: 'Nada' });

    expect(actualizado.status).toBe(200);
    expect(actualizado.body.orden).toBe(9);
    expect(inexistente.status).toBe(404);
  });

  it('no permite desactivar el último RECOJO_TIENDA activo', async () => {
    repository.buscar.mockResolvedValue({ idPuntoEntrega: 3, tipo: 'RECOJO_TIENDA', activo: true });
    repository.contarRecojosActivos.mockResolvedValue(1);
    const response = await request(app).patch('/api/admin/puntos-entrega/3').set('x-test-role', 'ADMIN').send({ activo: false });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Debe existir un punto activo de recojo en tienda');
  });

  it('permite desactivar un recojo si sigue existiendo otro activo', async () => {
    repository.buscar.mockResolvedValue({ idPuntoEntrega: 3, tipo: 'RECOJO_TIENDA', activo: true });
    repository.contarRecojosActivos.mockResolvedValue(2);
    repository.actualizar.mockResolvedValue({ idPuntoEntrega: 3, activo: false });
    const response = await request(app).patch('/api/admin/puntos-entrega/3').set('x-test-role', 'ADMIN').send({ activo: false });

    expect(response.status).toBe(200);
    expect(response.body.activo).toBe(false);
  });

  it('permite a ADMIN consultar y actualizar el singleton sin crear filas adicionales', async () => {
    const actual = await request(app).get('/api/admin/configuracion-entrega').set('x-test-role', 'ADMIN');
    const actualizado = await request(app).patch('/api/admin/configuracion-entrega').set('x-test-role', 'ADMIN').send({ deliveryHabilitado: false, montoMinimoDelivery: 200, mensajeDelivery: 'A coordinar' });
    const segundaActualizacion = await request(app).patch('/api/admin/configuracion-entrega').set('x-test-role', 'ADMIN').send({ montoMinimoDelivery: 250 });

    expect(actual.status).toBe(200);
    expect(actual.body.montoMinimoDelivery).toBe('150');
    expect(actualizado.status).toBe(200);
    expect(repository.actualizarConfiguracion).toHaveBeenCalledWith({ deliveryHabilitado: false, montoMinimoDelivery: 200, mensajeDelivery: 'A coordinar' });
    expect(segundaActualizacion.status).toBe(200);
    expect(repository.actualizarConfiguracion).toHaveBeenCalledTimes(2);
  });

  it('rechaza monto negativo y conserva errores de validación controlados', async () => {
    const response = await request(app).patch('/api/admin/configuracion-entrega').set('x-test-role', 'ADMIN').send({ montoMinimoDelivery: -1 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Datos inválidos');
  });
});
