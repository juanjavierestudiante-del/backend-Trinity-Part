// Controlador de Auth: login y registro de usuarios.

import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/helpers.js';
import { env } from '../config/env.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production' || env.jwt.cookieSameSite === 'none',
  sameSite: env.jwt.cookieSameSite,
  path: '/api',
  maxAge: env.jwt.cookieMaxAgeMs,
} as const;

const setAuthCookie = (res: Response, token: string) => {
  res.cookie('access_token', token, cookieOptions);
};

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { usuario, token } = await authService.login(req.body);
  setAuthCookie(res, token);
  res.json({ usuario });
});

export const loginAdmin = asyncHandler(async (req: Request, res: Response) => {
  const { usuario, token } = await authService.login(req.body, ['ADMIN']);
  setAuthCookie(res, token);
  res.json({ usuario });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { nombre, apellido, email, telefono, password } = req.body;
  const { usuario, token } = await authService.registrar({ nombre, apellido, email, telefono, password });
  setAuthCookie(res, token);
  res.status(201).json({ usuario });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const usuario = await authService.obtenerUsuarioActual(req.usuario!.id_usuario);
  res.json({ usuario });
});

export const logout = (req: Request, res: Response) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: env.nodeEnv === 'production' || env.jwt.cookieSameSite === 'none',
    sameSite: env.jwt.cookieSameSite,
    path: '/api',
  });
  res.status(204).send();
};
