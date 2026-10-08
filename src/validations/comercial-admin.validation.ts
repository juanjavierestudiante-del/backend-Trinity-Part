import { z } from 'zod';

const id = z.number().int().min(1).max(2147483647);
const orden = z.number().int().min(0).max(2147483647);
const nombre = z.string().trim().min(1).max(100);
const precio = z.string().trim().regex(/^\d{1,8}(?:\.\d{1,2})?$/, 'Precio decimal inválido.')
  .refine(value => /[1-9]/.test(value), 'El precio debe ser mayor a cero.');
const camposPerfil = { nombre, principal: z.boolean(), activo: z.boolean(), orden };
export const crearPerfilSchema = z.object(camposPerfil).partial().extend({ nombre }).strict();
export const editarPerfilSchema = z.object(camposPerfil).partial().strict().refine(v => Object.keys(v).length > 0, 'Indica los cambios.');
export const crearPresentacionSchema = crearPerfilSchema.extend({ cantidadBase: id });
export const editarPresentacionSchema = z.object({ ...camposPerfil, cantidadBase: id }).partial().strict().refine(v => Object.keys(v).length > 0, 'Indica los cambios.');
export const asignarPerfilSchema = z.object({ idPerfilPrecio: id.nullable() }).strict();
export const asignarPerfilesSchema = z.object({ asignaciones: z.array(asignarPerfilSchema.extend({ idVariante: id })).min(1).max(500)
  .refine(v => new Set(v.map(a => a.idVariante)).size === v.length, 'No repitas variantes.') }).strict();
const camposRegla = { nombre, cantidadMinima: id, precioPorPresentacion: precio, activo: z.boolean(), principal: z.boolean(), orden };
export const crearReglaSchema = z.object(camposRegla).partial().extend({ nombre, cantidadMinima: id, precioPorPresentacion: precio }).strict();
export const editarReglaSchema = z.object(camposRegla).partial().strict().refine(v => Object.keys(v).length > 0, 'Indica los cambios.');
export const listaComercialSchema = z.object({
  nombre, idPresentacion: id.optional(), idPerfilPrecio: id.optional(),
  principal: z.boolean().optional(), activo: z.boolean().default(false),
  reglas: z.array(z.object(camposRegla).extend({ idReglaPrecio: id.optional() })).max(100).default([]),
}).strict();
export type PresentacionInput = z.infer<typeof crearPresentacionSchema>;
export type PerfilInput = z.infer<typeof crearPerfilSchema>;
export type ListaComercialInput = z.infer<typeof listaComercialSchema>;
export type ReglaInput = z.infer<typeof crearReglaSchema>;
export type AsignacionPerfil = z.infer<typeof asignarPerfilesSchema>['asignaciones'][number];
