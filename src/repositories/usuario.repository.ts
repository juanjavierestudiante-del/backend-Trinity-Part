// Capa de acceso a datos para Usuario (login del panel admin).

import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

export const findByEmail = (email: string) => {
  return prisma.usuario.findUnique({ where: { email } });
};

export const findById = (id: number) => {
  return prisma.usuario.findUnique({ where: { id_usuario: id } });
};

export const findAuthById = (id: number) => {
  return prisma.usuario.findUnique({
    where: { id_usuario: id },
    select: { id_usuario: true, email: true, rol: true, estado: true },
  });
};

export const findByTelefono = (telefono: string) => {
  return prisma.usuario.findUnique({ where: { telefono } });
};

export const create = (data: Prisma.UsuarioCreateInput) => {
  return prisma.usuario.create({ data });
};

export const updateTelefono = (id_usuario: number, telefono: string) => prisma.usuario.update({ where: { id_usuario }, data: { telefono, telefonoVerificado: false } });
export const updateProfile = (id_usuario: number, data: Prisma.UsuarioUpdateInput) =>
  prisma.usuario.update({ where: { id_usuario }, data });
export const findGoogleAccount = (providerUserId: string) => prisma.authAccount.findUnique({ where: { provider_providerUserId: { provider: 'GOOGLE', providerUserId } }, include: { usuario: true } });
export const createGoogleAccount = (idUsuario: number, providerUserId: string) => prisma.authAccount.create({ data: { idUsuario, provider: 'GOOGLE', providerUserId } });
export const updateGoogleUser = (id_usuario: number, data: Prisma.UsuarioUpdateInput) => prisma.usuario.update({ where: { id_usuario }, data });
