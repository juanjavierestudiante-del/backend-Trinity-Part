// Schemas de validación para Inventario usando Zod.

import { z } from 'zod';

const entero = () => z.preprocess(
  valor => typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor,
  z.number().int().min(0).max(2147483647)
);

export const actualizarInventarioSchema = z
  .object({
    stockActual: entero().optional(),
    stockMinimo: entero().optional(),
    stockMaximo: entero().nullable().optional(),
    motivo: z.string().max(255).optional(),
  })
  .refine(
    (datos) =>
      datos.stockActual !== undefined ||
      datos.stockMinimo !== undefined ||
      datos.stockMaximo !== undefined,
    { message: 'Envía al menos un campo de stock (stockActual, stockMinimo o stockMaximo)' }
  )
  .refine(
    (datos) =>
      datos.stockMaximo == null ||
      datos.stockMinimo == null ||
      datos.stockMaximo >= datos.stockMinimo,
    { message: 'stockMaximo debe ser mayor o igual que stockMinimo', path: ['stockMaximo'] }
  );

export const ajustarInventarioSchema = z.object({
  cantidad: z
    .number()
    .int()
    .min(-2147483647)
    .max(2147483647)
    .refine((n) => n !== 0, { message: 'La cantidad debe ser distinta de 0' }),
  motivo: z.string().max(255).optional(),
});

export type ActualizarInventarioInput = z.infer<typeof actualizarInventarioSchema>;
export type AjustarInventarioInput = z.infer<typeof ajustarInventarioSchema>;
