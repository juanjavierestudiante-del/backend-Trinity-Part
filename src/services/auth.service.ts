// Lógica de negocio para autenticación del panel admin.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as usuarioRepository from '../repositories/usuario.repository.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/helpers.js';
import { normalizarEmail, normalizarTelefonoBolivia } from '../utils/auth.helpers.js';
import type { LoginInput, UpdateProfileInput } from '../validations/auth.validation.js';
import type { RolUsuario, Usuario } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';

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

const googleClient = new OAuth2Client();
export const loginGoogle = async (credential: string) => {
  if (!env.google.clientId) throw new AppError('Google Login no está configurado', 503);
  let payload;
  try { payload = (await googleClient.verifyIdToken({ idToken: credential, audience: env.google.clientId })).getPayload(); } catch { throw new AppError('No se pudo iniciar sesión con Google', 401); }
  if (!payload?.sub || !payload.email) throw new AppError('No se pudo iniciar sesión con Google', 401);
  const account = await usuarioRepository.findGoogleAccount(payload.sub);
  let usuario: Usuario;
  if (account) usuario = account.usuario;
  else {
    const email = normalizarEmail(payload.email);
    const existing = await usuarioRepository.findByEmail(email);
    if (existing) {
      if (!payload.email_verified) throw new AppError('Google no confirmó este correo electrónico', 403);
      await usuarioRepository.createGoogleAccount(existing.id_usuario, payload.sub);
      usuario = await usuarioRepository.updateGoogleUser(existing.id_usuario, { emailVerificado: true });
    } else {
      usuario = await usuarioRepository.create({ nombre: payload.given_name || payload.name || 'Usuario', apellido: payload.family_name || null, email, password: null, avatarUrl: payload.picture || null, rol: 'CLIENTE', emailVerificado: payload.email_verified === true, telefonoVerificado: false });
      await usuarioRepository.createGoogleAccount(usuario.id_usuario, payload.sub);
    }
  }
  if (usuario.estado !== 'Activo') throw new AppError('Credenciales inválidas', 401);
  return { usuario: usuarioSeguro(usuario), token: crearToken(usuario) };
};

export const completarTelefono = async (idUsuario: number, telefono: string) => {
  const telefonoNormalizado = normalizarTelefonoBolivia(telefono);
  const existente = await usuarioRepository.findByTelefono(telefonoNormalizado);
  if (existente && existente.id_usuario !== idUsuario) throw new AppError('El teléfono ya está registrado', 409);
  return usuarioSeguro(await usuarioRepository.updateTelefono(idUsuario, telefonoNormalizado));
};

export const actualizarPerfil = async (idUsuario: number, input: UpdateProfileInput) => {
  const usuarioActual = await usuarioRepository.findById(idUsuario);
  if (!usuarioActual || usuarioActual.estado !== 'Activo') {
    throw new AppError('Usuario inactivo o no encontrado', 401);
  }

  const telefonoNormalizado = normalizarTelefonoBolivia(input.telefono);
  const existente = await usuarioRepository.findByTelefono(telefonoNormalizado);
  if (existente && existente.id_usuario !== idUsuario) {
    throw new AppError('El teléfono ya está registrado', 409);
  }

  const telefonoCambio = telefonoNormalizado !== usuarioActual.telefono;
  let usuario: Usuario;
  try {
    usuario = await usuarioRepository.updateProfile(idUsuario, {
      nombre: input.nombre.trim(),
      apellido: input.apellido?.trim() || null,
      telefono: telefonoNormalizado,
      ...(telefonoCambio ? { telefonoVerificado: false } : {}),
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError('El teléfono ya está registrado', 409);
    }
    throw error;
  }

  return usuarioSeguro(usuario);
};
