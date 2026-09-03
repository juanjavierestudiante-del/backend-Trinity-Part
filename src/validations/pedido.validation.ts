import { z } from 'zod';
import { EstadoPedido } from '@prisma/client';

export const crearPedidoSchema = z.object({
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
  direccionEntrega: z
    .string()
    .trim()
    .max(255, 'La dirección de entrega no puede superar 255 caracteres')
    .nullable()
    .optional(),
  notas: z
    .string()
    .trim()
    .max(1000, 'Las notas no pueden superar 1000 caracteres')
    .nullable()
    .optional(),
});

export const actualizarEstadoPedidoSchema = z.object({
  estado: z.nativeEnum(EstadoPedido),
});

export type CrearPedidoInput = z.infer<typeof crearPedidoSchema>;
export type ActualizarEstadoPedidoInput = z.infer<typeof actualizarEstadoPedidoSchema>;