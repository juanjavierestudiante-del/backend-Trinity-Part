// Lógica de negocio para autenticación del panel admin.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usuarioRepository from '../repositories/usuario.repository.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/helpers.js';
import { normalizarEmail, normalizarTelefonoBolivia } from '../utils/auth.helpers.js';
import type { LoginInput } from '../validations/auth.validation.js';
import type { RolUsuario, Usuario } from '@prisma/client';

export const usuarioSeguro = (usuario: Usuario) => ({
  id_usuario: usuario.id_usuario,
  nombre: usuario.nombre,
  apellido: usuario.apellido,
  email: usuario.email,
  telefono: usuario.telefono,
  avatarUrl: usuario.avatarUrl,
  rol: usuario.rol,
  estado: usuario.estado,
  emailVerificado: usuario.emailVerificado,
  telefonoVerificado: usuario.telefonoVerificado,
});

const crearToken = (usuario: Usuario) => jwt.sign(
  { id_usuario: usuario.id_usuario },
  env.jwt.secret,
  { expiresIn: env.jwt.expiresIn as any }
);

export const login = async ({ email, password }: LoginInput, rolesPermitidos?: RolUsuario[]) => {
  const usuario = await usuarioRepository.findByEmail(normalizarEmail(email));

  if (!usuario || !usuario.password) {
    throw new AppError('Credenciales inválidas', 401);
  }

  const passwordValido = await bcrypt.compare(password, usuario.password);
  if (!passwordValido) {
    throw new AppError('Credenciales inválidas', 401);
  }

  if (usuario.estado !== 'Activo') {
    throw new AppError('Credenciales inválidas', 401);
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    throw new AppError('No tienes permisos para acceder al panel administrativo', 403);
  }

  return { usuario: usuarioSeguro(usuario), token: crearToken(usuario) };
};

interface RegistrarInput {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol?: RolUsuario;
  telefono: string;
}

export const registrar = async ({ nombre, apellido, email, password, rol = 'CLIENTE', telefono }: RegistrarInput) => {
  const emailNormalizado = normalizarEmail(email);
  const telefonoNormalizado = normalizarTelefonoBolivia(telefono);
  if (await usuarioRepository.findByEmail(emailNormalizado)) {
    throw new AppError('El correo electrónico ya está registrado', 409);
  }
  if (await usuarioRepository.findByTelefono(telefonoNormalizado)) {
    throw new AppError('El teléfono ya está registrado', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const usuario = await usuarioRepository.create({
    nombre: nombre.trim(),
    apellido: apellido.trim(),
    email: emailNormalizado,
    password: passwordHash,
    rol,
    telefono: telefonoNormalizado,
  });

  return { usuario: usuarioSeguro(usuario), token: crearToken(usuario) };
};

export const obtenerUsuarioActual = async (idUsuario: number) => {
  const usuario = await usuarioRepository.findById(idUsuario);
  if (!usuario || usuario.estado !== 'Activo') {
    throw new AppError('Usuario inactivo o no encontrado', 401);
  }
  return usuarioSeguro(usuario);
};
