import { z } from 'zod';

export const crearPedidoSchema = z.object({});

export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>;
