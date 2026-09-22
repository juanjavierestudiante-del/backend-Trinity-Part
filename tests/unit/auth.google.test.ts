import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(), findGoogleAccount: vi.fn(), findByEmail: vi.fn(), findByTelefono: vi.fn(),
  create: vi.fn(), createGoogleAccount: vi.fn(), updateGoogleUser: vi.fn(), updateTelefono: vi.fn(), sign: vi.fn(() => 'token'),
}));
vi.mock('../../src/config/env.js', () => ({ env: { google: { clientId: 'client-id' }, jwt: { secret: 'secret', expiresIn: '8h' } } }));
vi.mock('../../src/repositories/usuario.repository.js', () => mocks);
vi.mock('jsonwebtoken', () => ({ default: { sign: mocks.sign } }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class { verifyIdToken = mocks.verifyIdToken; } }));
const auth = await import('../../src/services/auth.service.js');

const user = { id_usuario: 4, nombre: 'Google', apellido: null, email: 'google@example.com', telefono: null, password: null, avatarUrl: null, rol: 'CLIENTE' as const, estado: 'Activo' as const, emailVerificado: true, telefonoVerificado: false, fechaRegistro: new Date(), fechaActualizacion: new Date() };
const ticket = (payload: object) => ({ getPayload: () => payload });
beforeEach(() => { vi.clearAllMocks(); mocks.findGoogleAccount.mockResolvedValue(null); mocks.findByEmail.mockResolvedValue(null); mocks.findByTelefono.mockResolvedValue(null); mocks.create.mockResolvedValue(user); mocks.createGoogleAccount.mockResolvedValue({}); mocks.updateTelefono.mockResolvedValue({ ...user, telefono: '+59171234567' }); });

describe('Google auth', () => {
  it('crea usuario Google puro y usa sub como providerUserId', async () => { mocks.verifyIdToken.mockResolvedValue(ticket({ sub: 'stable-sub', email: 'GOOGLE@EXAMPLE.COM', email_verified: true, given_name: 'Google' })); await auth.loginGoogle('credential'); expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'google@example.com', password: null, emailVerificado: true })); expect(mocks.createGoogleAccount).toHaveBeenCalledWith(4, 'stable-sub'); });
  it('reutiliza AuthAccount existente e impide usuario inactivo', async () => { mocks.verifyIdToken.mockResolvedValue(ticket({ sub: 'stable-sub', email: 'google@example.com' })); mocks.findGoogleAccount.mockResolvedValue({ usuario: { ...user, estado: 'Activo' } }); await auth.loginGoogle('credential'); expect(mocks.create).not.toHaveBeenCalled(); mocks.findGoogleAccount.mockResolvedValue({ usuario: { ...user, estado: 'Inactivo' } }); await expect(auth.loginGoogle('credential')).rejects.toMatchObject({ statusCode: 401 }); });
  it('vincula email local solo si Google lo verificó', async () => { mocks.verifyIdToken.mockResolvedValue(ticket({ sub: 's', email: 'local@example.com', email_verified: false })); mocks.findByEmail.mockResolvedValue({ ...user, password: 'hash' }); await expect(auth.loginGoogle('credential')).rejects.toMatchObject({ statusCode: 403 }); mocks.verifyIdToken.mockResolvedValue(ticket({ sub: 's', email: 'local@example.com', email_verified: true })); mocks.updateGoogleUser.mockResolvedValue({ ...user, password: 'hash' }); await auth.loginGoogle('credential'); expect(mocks.createGoogleAccount).toHaveBeenCalled(); });
  it('rechaza credencial inválida, email ausente y subject ausente', async () => { mocks.verifyIdToken.mockRejectedValue(new Error('invalid')); await expect(auth.loginGoogle('bad')).rejects.toMatchObject({ statusCode: 401 }); mocks.verifyIdToken.mockResolvedValue(ticket({ sub: 's' })); await expect(auth.loginGoogle('bad')).rejects.toMatchObject({ statusCode: 401 }); mocks.verifyIdToken.mockResolvedValue(ticket({ email: 'x@example.com' })); await expect(auth.loginGoogle('bad')).rejects.toMatchObject({ statusCode: 401 }); });
  it('completa teléfono normalizado, conserva false y rechaza duplicado', async () => { const result = await auth.completarTelefono(4, '71234567'); expect(result.telefono).toBe('+59171234567'); expect(mocks.updateTelefono).toHaveBeenCalledWith(4, '+59171234567'); mocks.findByTelefono.mockResolvedValue({ ...user, id_usuario: 5 }); await expect(auth.completarTelefono(4, '71234567')).rejects.toMatchObject({ statusCode: 409 }); });
});
