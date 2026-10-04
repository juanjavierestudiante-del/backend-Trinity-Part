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

describe('presentación opcional durante transición', () => {
 it('acepta payload legacy sin presentación', async()=>{const {agregarItemSchema}=await import('../../src/validations/carrito.validation.js');expect(agregarItemSchema.parse({idVariante:1,cantidad:3})).toEqual({idVariante:1,cantidad:3});});
 it('conserva presentación explícita válida', async()=>{const {agregarItemSchema}=await import('../../src/validations/carrito.validation.js');expect(agregarItemSchema.parse({idVariante:1,idPresentacion:2,cantidad:3}).idPresentacion).toBe(2);});
 it.each([0,-1,1.5])('rechaza presentación inválida %s',async(idPresentacion)=>{const {agregarItemSchema}=await import('../../src/validations/carrito.validation.js');expect(agregarItemSchema.safeParse({idVariante:1,idPresentacion,cantidad:1}).success).toBe(false);});
});

it('rechaza cantidad fuera del Int PostgreSQL antes de persistir',async()=>{const {agregarItemSchema,actualizarItemSchema}=await import('../../src/validations/carrito.validation.js');expect(agregarItemSchema.safeParse({idVariante:1,cantidad:2147483648}).success).toBe(false);expect(actualizarItemSchema.safeParse({cantidad:2147483648}).success).toBe(false);});
