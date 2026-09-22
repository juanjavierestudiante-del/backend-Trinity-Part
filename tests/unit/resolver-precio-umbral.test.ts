import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ErrorPrecioCantidad, type ReglaPrecioUmbral } from '../../src/types/precio-cantidad.types.js';
import { resolverPrecioUmbral } from '../../src/utils/resolver-precio-umbral.js';

const regla = (idReglaPrecio: number, cantidadMinima: number, precio: string, activo = true): ReglaPrecioUmbral => ({ idReglaPrecio, nombre: `Desde ${cantidadMinima}`, cantidadMinima, precioPorPresentacion: new Prisma.Decimal(precio), principal: cantidadMinima === 1, activo, orden: 0 });

describe('resolverPrecioUmbral', () => {
  const reglas = [regla(1, 1, '20'), regla(2, 5, '18'), regla(3, 12, '15'), regla(4, 100, '13')];
  it.each([[1, '20', 1], [4, '20', 1], [5, '18', 5], [11, '18', 5], [12, '15', 12], [102, '13', 100], [125, '13', 100], [1000, '13', 100] as const])('elige el umbral correcto para %s presentaciones', (cantidad, precio, minimo) => {
    const resultado = resolverPrecioUmbral(cantidad, reglas);
    expect(resultado.precioPorPresentacion.toFixed(2)).toBe(`${precio}.00`);
    expect(resultado.cantidadMinimaAplicada).toBe(minimo);
    expect(resultado.subtotal.toFixed(2)).toBe(new Prisma.Decimal(cantidad).mul(precio).toFixed(2));
  });
  it('usa Decimal sin redondeo intermedio', () => expect(resolverPrecioUmbral(3, [regla(1, 1, '1.67')]).subtotal.toFixed(2)).toBe('5.01'));
  it('ignora reglas inactivas', () => expect(resolverPrecioUmbral(5, [regla(1, 1, '20'), regla(2, 5, '1', false)]).precioPorPresentacion.toString()).toBe('20'));
  it('rechaza cantidad sin umbral o inválida', () => {
    try { resolverPrecioUmbral(0, reglas); } catch (error) { expect(error).toMatchObject({ code: 'CANTIDAD_INVALIDA' }); }
    try { resolverPrecioUmbral(1, [regla(2, 5, '18')]); } catch (error) { expect(error).toMatchObject({ code: 'CANTIDAD_SIN_UMBRAL' }); }
    try { resolverPrecioUmbral(1, []); } catch (error) { expect(error).toMatchObject({ code: 'SIN_REGLAS_PRECIO' }); }
    expect(new ErrorPrecioCantidad('CANTIDAD_INVALIDA')).toBeInstanceOf(Error);
  });
});
