import prisma from '../config/prisma.js';
import type { Prisma, TipoPuntoEntrega } from '@prisma/client';
export const listarPublicos = (tipo?: TipoPuntoEntrega) => prisma.puntoEntrega.findMany({ where: { activo: true, ...(tipo ? { tipo } : {}) }, orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
export const listarAdmin = () => prisma.puntoEntrega.findMany({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] });
export const buscar = (idPuntoEntrega: number) => prisma.puntoEntrega.findUnique({ where: { idPuntoEntrega } });
export const crear = (data: Prisma.PuntoEntregaCreateInput) => prisma.puntoEntrega.create({ data });
export const actualizar = (idPuntoEntrega: number, data: Prisma.PuntoEntregaUpdateInput) => prisma.puntoEntrega.update({ where: { idPuntoEntrega }, data });
export const contarRecojosActivos = () => prisma.puntoEntrega.count({ where: { tipo: 'RECOJO_TIENDA', activo: true } });
export const configuracion = () => prisma.configuracionEntrega.upsert({ where: { id: 1 }, update: {}, create: { id: 1, deliveryHabilitado: true, montoMinimoDelivery: 150 } });
export const actualizarConfiguracion = (data: {
  deliveryHabilitado?: boolean;
  montoMinimoDelivery?: number;
  mensajeDelivery?: string | null;
}) => prisma.configuracionEntrega.upsert({
  where: { id: 1 },
  update: data,
  create: {
    id: 1,
    deliveryHabilitado: data.deliveryHabilitado ?? true,
    montoMinimoDelivery: data.montoMinimoDelivery ?? 150,
    ...(data.mensajeDelivery !== undefined ? { mensajeDelivery: data.mensajeDelivery } : {}),
  },
});
