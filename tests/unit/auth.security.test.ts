import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  findById: vi.fn(),
  findByTelefono: vi.fn(),
  create: vi.fn(),
  compare: vi.fn(),
  hash: vi.fn(),
  sign: vi.fn(() => 'signed-token'),
  verify: vi.fn(() => ({ id_usuario: 1 })),
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    nodeEnv: 'test',
    jwt: { secret: 'test-secret', expiresIn: '8h', cookieMaxAgeMs: 28_800_000, cookieSameSite: 'lax' },
  },
}));

vi.mock('../../src/repositories/usuario.repository.js', () => ({
  findByEmail: mocks.findByEmail,
  findById: mocks.findById,
  findByTelefono: mocks.findByTelefono,
  create: mocks.create,
}));

vi.mock('bcrypt', () => ({
  default: { compare: mocks.compare, hash: mocks.hash },
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: mocks.sign, verify: mocks.verify },
}));

const usuarioCliente = {
  id_usuario: 1,
  nombre: 'Cliente',
  email: 'cliente@example.com',
  password: 'hash',
  apellido: null,
  telefono: null,
  avatarUrl: null,
  rol: 'CLIENTE' as const,
  estado: 'Activo' as const,
  emailVerificado: false,
  telefonoVerificado: false,
  fechaRegistro: new Date(),
  fechaActualizacion: new Date(),
};

const usuarioAdmin = { ...usuarioCliente, id_usuario: 2, rol: 'ADMIN' as const };

const authService = await import('../../src/services/auth.service.js');
const { authMiddleware, requireRole } = await import('../../src/middlewares/auth.middleware.js');
const authController = await import('../../src/controllers/auth.controller.js');
const { createRateLimiter } = await import('../../src/middlewares/rateLimit.middleware.js');

const response = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };
  return res;
};

const ejecutarMiddleware = async (middleware: Function, req: object, res: object) => {
  await new Promise<void>((resolve) => middleware(req, res, resolve));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verify.mockReturnValue({ id_usuario: 1 });
  mocks.findByEmail.mockResolvedValue(null);
  mocks.findByTelefono.mockResolvedValue(null);
});

describe('autenticación con cookie', () => {
  it('permite login correcto de CLIENTE y devuelve usuario sin hash', async () => {
    mocks.findByEmail.mockResolvedValue(usuarioCliente);
    mocks.compare.mockResolvedValue(true);

    const resultado = await authService.login({ email: usuarioCliente.email, password: 'secreta' });

    expect(resultado.usuario).toMatchObject({ id_usuario: 1, rol: 'CLIENTE', estado: 'Activo' });
    expect(resultado.usuario).not.toHaveProperty('password');
    expect(resultado.token).toBe('signed-token');
  });

  it('rechaza contraseña incorrecta e impide login de usuario inactivo', async () => {
    mocks.findByEmail.mockResolvedValue(usuarioCliente);
    mocks.compare.mockResolvedValue(false);
    await expect(authService.login({ email: usuarioCliente.email, password: 'incorrecta' }))
      .rejects.toMatchObject({ statusCode: 401 });

    mocks.compare.mockResolvedValue(true);
    mocks.findByEmail.mockResolvedValue({ ...usuarioCliente, estado: 'Inactivo' });
    await expect(authService.login({ email: usuarioCliente.email, password: 'secreta' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('rechaza de forma segura una cuenta sin password local', async () => {
    mocks.findByEmail.mockResolvedValue({ ...usuarioCliente, password: null });
    await expect(authService.login({ email: usuarioCliente.email, password: 'secreta' }))
      .rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it('normaliza email y teléfono antes de crear una cuenta local', async () => {
    mocks.hash.mockResolvedValue('nuevo-hash');
    mocks.create.mockResolvedValue({ ...usuarioCliente, email: 'cliente@example.com', telefono: '+59171234567' });

    await authService.registrar({
      nombre: ' Cliente ',
      apellido: ' Prueba ',
      email: 'CLIENTE@EXAMPLE.COM ',
      password: 'secreta',
      telefono: '71234567',
    });

    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      nombre: 'Cliente',
      email: 'cliente@example.com',
      telefono: '+59171234567',
    }));
  });

  it('rechaza teléfono duplicado antes de crear la cuenta', async () => {
    mocks.findByTelefono.mockResolvedValue(usuarioCliente);
    await expect(authService.registrar({
      nombre: 'Otra persona', email: 'otra@example.com', password: 'secreta', telefono: '+59171234567',
      apellido: 'Prueba',
    })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rechaza login administrativo de CLIENTE', async () => {
    mocks.findByEmail.mockResolvedValue(usuarioCliente);
    mocks.compare.mockResolvedValue(true);
    await expect(authService.login({ email: usuarioCliente.email, password: 'secreta' }, ['ADMIN']))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it('login establece access_token HttpOnly y no expone token en el body', async () => {
    mocks.findByEmail.mockResolvedValue(usuarioCliente);
    mocks.compare.mockResolvedValue(true);
    const res = response();

    await authController.login({ body: { email: usuarioCliente.email, password: 'secreta' } } as never, res as never, vi.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(res.cookie).toHaveBeenCalledWith('access_token', 'signed-token', expect.objectContaining({ httpOnly: true, path: '/api' }));
    expect(res.json).toHaveBeenCalledWith({ usuario: expect.not.objectContaining({ password: expect.anything(), token: expect.anything() }) });
  });

  it('/auth/me obtiene el usuario seguro actual desde base de datos', async () => {
    mocks.findById.mockResolvedValue(usuarioCliente);
    const resultado = await authService.obtenerUsuarioActual(1);
    expect(resultado).toMatchObject({ id_usuario: 1, nombre: 'Cliente', estado: 'Activo' });
    expect(resultado).not.toHaveProperty('password');
  });

  it('/auth/me devuelve 401 sin sesión', async () => {
    const res = response();
    await authMiddleware({ headers: {} } as never, res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('logout elimina la cookie de sesión', () => {
    const res = response();
    authController.logout({} as never, res as never);
    expect(res.clearCookie).toHaveBeenCalledWith('access_token', expect.objectContaining({ httpOnly: true, path: '/api' }));
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('CLIENTE no conserva acceso admin si su rol cambia y ADMIN sí accede', async () => {
    const req = { headers: { cookie: 'access_token=signed-token' } } as Record<string, unknown>;
    const adminCheck = requireRole('ADMIN');

    mocks.findById.mockResolvedValue(usuarioAdmin);
    const resAdmin = response();
    let adminNext = false;
    await ejecutarMiddleware(authMiddleware, req, resAdmin);
    adminCheck(req as never, resAdmin as never, () => { adminNext = true; });
    expect(adminNext).toBe(true);

    mocks.findById.mockResolvedValue(usuarioCliente);
    const resCliente = response();
    let clienteNext = false;
    await ejecutarMiddleware(authMiddleware, req, resCliente);
    adminCheck(req as never, resCliente as never, () => { clienteNext = true; });
    expect(clienteNext).toBe(false);
    expect(resCliente.status).toHaveBeenCalledWith(403);
  });

  it('limita intentos de login por IP', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxAttempts: 2 });
    const req = { ip: '127.0.0.1', socket: {} };
    const next = vi.fn();
    const first = response();
    const second = response();
    const third = response();

    limiter(req as never, first as never, next);
    limiter(req as never, second as never, next);
    limiter(req as never, third as never, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(third.status).toHaveBeenCalledWith(429);
  });
});
