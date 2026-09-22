import { z } from 'zod';
const tipo = z.enum(['PUNTO_ENTREGA', 'RECOJO_TIENDA']);
export const crearPuntoSchema = z.object({ nombre:z.string().trim().min(1).max(150), descripcion:z.string().trim().max(1000).nullable().optional(), referencia:z.string().trim().max(255).nullable().optional(), tipo, activo:z.boolean().optional(), orden:z.number().int().min(0).optional() });
export const editarPuntoSchema = crearPuntoSchema.partial();
export const configurarEntregaSchema = z.object({ deliveryHabilitado:z.boolean().optional(), montoMinimoDelivery:z.number().finite().min(0).optional(), mensajeDelivery:z.string().trim().max(255).nullable().optional() });
