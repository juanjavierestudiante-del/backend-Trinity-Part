import { Prisma } from '@prisma/client';
import { ErrorPrecioCantidad, type ReglaPrecioUmbral, type ResultadoPrecioUmbral } from '../types/precio-cantidad.types.js';

export const validarCantidadPrecio = (cantidad: number) => {
  if (!Number.isSafeInteger(cantidad) || cantidad <= 0) throw new ErrorPrecioCantidad('CANTIDAD_INVALIDA');
};

export const resolverPrecioUmbral = (cantidad: number, reglas: ReglaPrecioUmbral[]): ResultadoPrecioUmbral => {
  validarCantidadPrecio(cantidad);
  const activas = reglas.filter((regla) => regla.activo);
  if (activas.length === 0) throw new ErrorPrecioCantidad('SIN_REGLAS_PRECIO');
  const aplicable = activas
    .filter((regla) => regla.cantidadMinima <= cantidad)
    .sort((a, b) => b.cantidadMinima - a.cantidadMinima || a.orden - b.orden || a.idReglaPrecio - b.idReglaPrecio)[0];
  if (!aplicable) throw new ErrorPrecioCantidad('CANTIDAD_SIN_UMBRAL');
  return {
    cantidad,
    idReglaPrecio: aplicable.idReglaPrecio,
    cantidadMinimaAplicada: aplicable.cantidadMinima,
    precioPorPresentacion: aplicable.precioPorPresentacion,
    subtotal: new Prisma.Decimal(cantidad).mul(aplicable.precioPorPresentacion),
  };
};
