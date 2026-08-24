// Schemas de validación para producto_variante usando Zod.

import { z } from 'zod';

export const crearVarianteSchema = z.object({
  idProducto: z.number().int().positive(),
  idMarca: z.number().int().positive().optional(),
  idUnidad: z.number().int().positive().optional(),
  cantidadContenido: z.number().positive().default(1),
  sku: z.string().min(2).max(50),
  codigoBarras: z.string().max(100).optional(),
  precioVenta: z.number().positive(),
  precioOferta: z.number().positive().optional(),
  peso: z.number().positive().optional(),
  estado: z.enum(['Activo', 'Inactivo']).optional(),
});

export const actualizarVarianteSchema = crearVarianteSchema.partial();

export type CrearVarianteInput = z.infer<typeof crearVarianteSchema>;
export type ActualizarVarianteInput = z.infer<typeof actualizarVarianteSchema>;
