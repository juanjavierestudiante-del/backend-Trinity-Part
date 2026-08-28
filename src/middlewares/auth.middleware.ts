// Verifica el token JWT enviado en el header Authorization: Bearer <token>
// Si es válido, verifica que el usuario esté activo y agrega el payload a req.usuario.

import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import type { JwtPayloadUsuario } from '../types/auth.types.js';
import * as usuarioRepository from '../repositories/usuario.repository.js';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, env.jwt.secret) as JwtPayloadUsuario;

    const usuario = await usuarioRepository.findById(payload.id_usuario);
    if (!usuario || usuario.estado !== 'Activo') {
      res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
      return;
    }

    req.usuario = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware opcional para restringir por rol (ej: solo ADMIN puede borrar productos)
export const requireRole = (...rolesPermitidos: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  };
};
