import { z } from 'zod';

export const agregarItemSchema = z.object({
  idVariante: z.number().int().positive(),
  cantidad: z.number().int().positive().max(100).default(1),
});

export const actualizarItemSchema = z.object({
  cantidad: z.number().int().positive().max(100),
});

export type AgregarItemInput = z.infer<typeof agregarItemSchema>;
export type ActualizarItemInput = z.infer<typeof actualizarItemSchema>;
