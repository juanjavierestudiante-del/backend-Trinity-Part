import { z } from 'zod';
import { EstadoPedido, MetodoEntrega } from '@prisma/client';

const contactoPedidoSchema = z.object({
  nombreContacto: z
    .string()
    .trim()
    .min(1, 'El nombre de contacto es obligatorio')
    .max(150, 'El nombre de contacto no puede superar 150 caracteres'),
  telefonoContacto: z
    .string()
    .trim()
    .min(1, 'El teléfono de contacto es obligatorio')
    .max(50, 'El teléfono de contacto no puede superar 50 caracteres'),
  notas: z
    .string()
    .trim()
    .max(1000, 'Las notas no pueden superar 1000 caracteres')
    .nullable()
    .optional(),
});

const legacyPedidoSchema = contactoPedidoSchema.extend({
  direccionEntrega: z
    .string()
    .trim()
    .max(255, 'La dirección de entrega no puede superar 255 caracteres')
    .nullable()
    .optional(),
}).strict();

const puntoEntregaPedidoSchema = contactoPedidoSchema.extend({
  metodoEntrega: z.literal(MetodoEntrega.PUNTO_ENTREGA),
  idPuntoEntrega: z.number().int().positive('El punto de entrega es obligatorio'),
}).strict();

const recojoTiendaPedidoSchema = contactoPedidoSchema.extend({
  metodoEntrega: z.literal(MetodoEntrega.RECOJO_TIENDA),
  idPuntoEntrega: z.number().int().positive('El punto de recojo es obligatorio'),
}).strict();

const deliveryPedidoSchema = contactoPedidoSchema.extend({
  metodoEntrega: z.literal(MetodoEntrega.DELIVERY),
  deliveryZona: z
    .string()
    .trim()
    .min(1, 'La zona de delivery es obligatoria')
    .max(150, 'La zona de delivery no puede superar 150 caracteres'),
  deliveryDireccion: z
    .string()
    .trim()
    .min(1, 'La dirección de delivery es obligatoria')
    .max(255, 'La dirección de delivery no puede superar 255 caracteres'),
  deliveryReferencia: z
    .string()
    .trim()
    .max(255, 'La referencia de delivery no puede superar 255 caracteres')
    .nullable()
    .optional(),
}).strict();

export const crearPedidoSchema = z.union([
  legacyPedidoSchema,
  puntoEntregaPedidoSchema,
  recojoTiendaPedidoSchema,
  deliveryPedidoSchema,
]);

export const actualizarEstadoPedidoSchema = z.object({
  estado: z.nativeEnum(EstadoPedido),
});

export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>;
export type ActualizarEstadoPedidoInput = z.infer<typeof actualizarEstadoPedidoSchema>;
