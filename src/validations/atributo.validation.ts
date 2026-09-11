import { z } from 'zod';

export const tipoVisualizacionAtributoSchema = z.enum(['text', 'color', 'image']);

export const crearAtributoSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  tipoVisualizacion: tipoVisualizacionAtributoSchema.optional(),
});

export const actualizarAtributoSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  tipoVisualizacion: tipoVisualizacionAtributoSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

export const crearValorAtributoSchema = z.object({
  valor: z.string().trim().min(1).max(100),
  visualValue: z.string().trim().max(255).nullable().optional(),
});

export const actualizarValorAtributoSchema = z.object({
  valor: z.string().trim().min(1).max(100).optional(),
  visualValue: z.string().trim().max(255).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

export const esColorHexadecimalValido = (valor: string) =>
  /^#(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(valor);
