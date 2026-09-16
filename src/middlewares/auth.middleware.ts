import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import type { JwtPayloadUsuario } from '../types/auth.types.js';
import * as usuarioRepository from '../repositories/usuario.repository.js';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('access_token='))
    ?.slice('access_token='.length);
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = cookieToken || bearerToken;

  if (!token) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayloadUsuario;

    const usuario = await usuarioRepository.findById(payload.id_usuario);
    if (!usuario || usuario.estado !== 'Activo') {
      res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
      return;
    }

    req.usuario = {
      id_usuario: usuario.id_usuario,
      email: usuario.email,
      rol: usuario.rol,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const requireRole = (...rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario?.rol || !rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  };
};
