// Capa de acceso a datos para Usuario (login del panel admin).

import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

export const findByEmail = (email: string) => {
  return prisma.usuario.findUnique({ where: { email } });
};

export const findById = (id: number) => {
  return prisma.usuario.findUnique({ where: { id_usuario: id } });
};

export const findByTelefono = (telefono: string) => {
  return prisma.usuario.findUnique({ where: { telefono } });
};

export const create = (data: Prisma.UsuarioCreateInput) => {
  return prisma.usuario.create({ data });
};
