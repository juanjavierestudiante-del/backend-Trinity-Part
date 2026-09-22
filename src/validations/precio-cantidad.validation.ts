import { z } from 'zod';

const precioDecimal = z.string().trim().regex(/^\d+(?:\.\d{1,2})?$/, 'El precio debe ser un decimal válido con hasta dos decimales.');

export const reglaPrecioCantidadSchema = z.object({
  idReglaPrecio: z.number().int().positive().optional(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio.').max(100),
  cantidadMinima: z.number().int('La cantidad debe ser un número entero.').positive('La cantidad debe ser mayor a 0.'),
  precioPorPresentacion: precioDecimal,
  principal: z.boolean(),
  activo: z.boolean(),
  orden: z.number().int('El orden debe ser un número entero.'),
});

export const listaPrecioSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  principal: z.boolean(),
  activo: z.boolean(),
  reglas: z.array(reglaPrecioCantidadSchema).min(1, 'Agrega al menos un umbral.'),
});

export const asignarListaPrecioSchema = z.object({
  idListaPrecio: z.number().int().positive().nullable(),
  idsVariante: z.array(z.number().int().positive()).min(1),
});

export const previsualizarPrecioCantidadSchema = z.object({
  cantidad: z.number().int('La cantidad debe ser un número entero.').positive('La cantidad debe ser mayor a 0.'),
  reglas: z.array(reglaPrecioCantidadSchema).min(1),
});

export type ReglaPrecioCantidadInput = z.infer<typeof reglaPrecioCantidadSchema>;
export type ListaPrecioInput = z.infer<typeof listaPrecioSchema>;
export type AsignarListaPrecioInput = z.infer<typeof asignarListaPrecioSchema>;
export type PrevisualizarPrecioCantidadInput = z.infer<typeof previsualizarPrecioCantidadSchema>;
