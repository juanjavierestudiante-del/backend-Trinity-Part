2// Lógica de negocio para autenticación del panel admin.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usuarioRepository from '../repositories/usuario.repository.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/helpers.js';
import type { LoginInput } from '../validations/auth.validation.js';
import type { RolUsuario } from '@prisma/client';

export const login = async ({ email, password }: LoginInput) => {
  const usuario = await usuarioRepository.findByEmail(email);

  if (!usuario) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const passwordValido = await bcrypt.compare(password, usuario.password);
  if (!passwordValido) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const token = jwt.sign(
    { id_usuario: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn as any }
  );

  const { password: _omit, ...usuarioSinPassword } = usuario;

  return { usuario: usuarioSinPassword, token };
};

interface RegistrarInput {
  nombre: string;
  email: string;
  password: string;
  rol?: RolUsuario;
}

export const registrar = async ({ nombre, email, password, rol = 'ADMIN' }: RegistrarInput) => {
  const passwordHash = await bcrypt.hash(password, 10);
  return usuarioRepository.create({ nombre, email, password: passwordHash, rol });
};
