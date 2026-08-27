// Schemas de validación para Inventario usando Zod.

import { z } from 'zod';

export const actualizarInventarioSchema = z
  .object({
    stockActual: z.coerce.number().int().min(0).optional(),
    stockMinimo: z.coerce.number().int().min(0).optional(),
    stockMaximo: z.coerce.number().int().min(0).nullable().optional(),
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
  cantidad: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, { message: 'La cantidad debe ser distinta de 0' }),
  motivo: z.string().max(255).optional(),
});

export type ActualizarInventarioInput = z.infer<typeof actualizarInventarioSchema>;
export type AjustarInventarioInput = z.infer<typeof ajustarInventarioSchema>;
