// Capa de acceso a datos para Usuario (login del panel admin).

import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';

export const findByEmail = (email: string) => {
  return prisma.usuario.findUnique({ where: { email } });
};

export const create = (data: Prisma.UsuarioCreateInput) => {
  return prisma.usuario.create({ data });
};
