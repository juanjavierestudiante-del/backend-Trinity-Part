import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizarTelefonoBolivia } from '../../src/utils/auth.helpers.js';

describe('modelo profesional de autenticación', () => {
  it('normaliza teléfonos bolivianos al formato E.164', () => {
    expect(normalizarTelefonoBolivia('71234567')).toBe('+59171234567');
    expect(normalizarTelefonoBolivia('59171234567')).toBe('+59171234567');
    expect(normalizarTelefonoBolivia('+59171234567')).toBe('+59171234567');
  });

  it('declara GOOGLE y una unicidad por proveedor e identidad externa', () => {
    const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');

    expect(schema).toContain('enum ProveedorAuth');
    expect(schema).toContain('GOOGLE');
    expect(schema).toContain('model AuthAccount');
    expect(schema).toContain('@@unique([provider, providerUserId])');
  });
});
