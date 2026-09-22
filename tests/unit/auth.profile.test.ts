import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findByTelefono: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../../src/config/env.js', () => ({ env: { jwt: { secret: 'secret', expiresIn: '8h' }, google: { clientId: '' } } }));
vi.mock('../../src/repositories/usuario.repository.js', () => mocks);
vi.mock('jsonwebtoken', () => ({ default: { sign: vi.fn(() => 'token') } }));

const auth = await import('../../src/services/auth.service.js');
const { updateProfileSchema } = await import('../../src/validations/auth.validation.js');

const usuario = {
  id_usuario: 4,
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ana@example.com',
  telefono: '+59171234567',
  password: 'hash-secreto',
  avatarUrl: null,
  rol: 'CLIENTE' as const,
  estado: 'Activo' as const,
  emailVerificado: false,
  telefonoVerificado: true,
  fechaRegistro: new Date(),
  fechaActualizacion: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findById.mockResolvedValue(usuario);
  mocks.findByTelefono.mockResolvedValue(null);
  mocks.updateProfile.mockImplementation(async (_id, data) => ({ ...usuario, ...data }));
});

describe('actualización profesional de perfil', () => {
  it('actualiza nombre, apellido y teléfono normalizado sin filtrar password', async () => {
    const resultado = await auth.actualizarPerfil(4, { nombre: ' Ana María ', apellido: ' López ', telefono: '71234568' });

    expect(mocks.updateProfile).toHaveBeenCalledWith(4, expect.objectContaining({
      nombre: 'Ana María', apellido: 'López', telefono: '+59171234568', telefonoVerificado: false,
    }));
    expect(resultado).toMatchObject({ nombre: 'Ana María', apellido: 'López', telefono: '+59171234568' });
    expect(resultado).not.toHaveProperty('password');
  });

  it('rechaza teléfono duplicado, pero permite al propio usuario conservar el suyo', async () => {
    mocks.findByTelefono.mockResolvedValue({ ...usuario, id_usuario: 9 });
    await expect(auth.actualizarPerfil(4, { nombre: 'Ana', apellido: 'Pérez', telefono: '71234567' })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.updateProfile).not.toHaveBeenCalled();

    mocks.findByTelefono.mockResolvedValue(usuario);
    await auth.actualizarPerfil(4, { nombre: 'Ana', apellido: 'Pérez', telefono: '71234567' });
    expect(mocks.updateProfile).toHaveBeenCalled();
  });

  it('traduce una carrera de unicidad de Prisma a conflicto de teléfono seguro', async () => {
    mocks.updateProfile.mockRejectedValue({ code: 'P2002', meta: { target: ['telefono'] } });

    await expect(auth.actualizarPerfil(4, { nombre: 'Ana', apellido: 'Pérez', telefono: '71234568' }))
      .rejects.toMatchObject({ statusCode: 409, message: 'El teléfono ya está registrado' });
  });

  it('no cambia telefonoVerificado cuando el teléfono normalizado sigue siendo el mismo', async () => {
    await auth.actualizarPerfil(4, { nombre: 'Ana', apellido: 'Pérez', telefono: '59171234567' });

    expect(mocks.updateProfile).toHaveBeenCalledWith(4, {
      nombre: 'Ana', apellido: 'Pérez', telefono: '+59171234567',
    });
  });

  it('rechaza campos no permitidos, incluidos email, rol, estado y flags', () => {
    const resultado = updateProfileSchema.safeParse({
      nombre: 'Ana', apellido: 'Pérez', telefono: '71234567',
      email: 'otro@example.com', rol: 'ADMIN', estado: 'Inactivo', telefonoVerificado: true,
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza teléfono inválido antes de persistir', async () => {
    await expect(auth.actualizarPerfil(4, { nombre: 'Ana', apellido: null, telefono: '123' })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });
});
