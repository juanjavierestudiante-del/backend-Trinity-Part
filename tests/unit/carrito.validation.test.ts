import { describe, expect, it } from 'vitest';
import { idDetalleParamsSchema } from '../../src/validations/carrito.validation.js';

describe('idDetalleParamsSchema', () => {
  it.each(['abc', '1.5', 'NaN', '-1', '0'])('rechaza idDetalle inválido: %s', (idDetalle) => {
    expect(idDetalleParamsSchema.safeParse({ idDetalle }).success).toBe(false);
  });

  it('acepta un entero positivo serializado en la URL', () => {
    expect(idDetalleParamsSchema.parse({ idDetalle: '12' })).toEqual({ idDetalle: 12 });
  });
});
