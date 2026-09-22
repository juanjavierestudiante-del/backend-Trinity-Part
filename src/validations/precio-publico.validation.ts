import { z } from 'zod';

export const previsualizarPrecioSchema = z.object({
  lineas: z.array(z.object({
    idVariante: z.number().int().positive(),
    cantidad: z.number().int().positive(),
  })).min(1),
});
