import { z } from 'zod';

export const previsualizarPrecioSchema = z.object({
  lineas: z.array(z.object({
    idPresentacion: z.number().int().positive().optional(),
    idVariante: z.number().int().positive(),
    cantidad: z.number().int().positive(),
  })).min(1),
});
