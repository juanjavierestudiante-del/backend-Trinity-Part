import { describe, expect, it } from 'vitest';
import { registerSchema } from '../../src/validations/auth.validation.js';

const registroValido = {
  nombre: 'Ana',
  apellido: 'Pérez',
  email: 'ANA@EXAMPLE.COM',
  telefono: '71234567',
  password: 'ochochars',
};

describe('validación de registro tradicional', () => {
  it('acepta los campos obligatorios', () => {
    expect(registerSchema.safeParse(registroValido).success).toBe(true);
  });

  it('requiere apellido, teléfono y una contraseña de ocho caracteres', () => {
    expect(registerSchema.safeParse({ ...registroValido, apellido: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registroValido, telefono: '' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...registroValido, password: 'corta' }).success).toBe(false);
  });
});
