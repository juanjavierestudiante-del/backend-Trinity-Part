import { z } from 'zod';

export const agregarItemSchema = z.object({
  idVariante: z.number().int().positive(),
  idPresentacion: z.number().int().positive().optional(),
  cantidad: z.number().int().positive().max(2147483647).default(1),
});

export const actualizarItemSchema = z.object({
  cantidad: z.number().int().positive().max(2147483647),
});

export const idDetalleParamsSchema = z.object({
  idDetalle: z.coerce.number().int().positive(),
});

export type AgregarItemInput = z.infer<typeof agregarItemSchema>;
export type ActualizarItemInput = z.infer<typeof actualizarItemSchema>;
