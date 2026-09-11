// Schemas de validación para producto usando Zod.
// El tipo TypeScript se infiere automáticamente del schema con z.infer.

import { z } from 'zod';

export const crearProductoSchema = z.object({
  idCategoria: z.number().int().positive(),
  idAtributoPrincipal: z.number().int().positive().nullable().optional(),
  nombre: z.string().min(2).max(150),
  descripcionCorta: z.string().max(255).optional(),
  descripcion: z.string().optional(),
  destacado: z.boolean().optional(),
  metaTitulo: z.string().max(160).optional(),
  metaDescripcion: z.string().max(255).optional(),
  estado: z.enum(['Borrador', 'Activo', 'Inactivo', 'Descontinuado']).optional(),
});

export const actualizarProductoSchema = crearProductoSchema.partial();

export type CrearProductoInput = z.infer<typeof crearProductoSchema>;
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>;
