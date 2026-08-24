// Controlador de Auth: login del panel admin.

import type { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/helpers.js';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { usuario, token } = await authService.login(req.body);
  res.json({ usuario, token });
});

export const perfil = asyncHandler(async (req: Request, res: Response) => {
  res.json({ usuario: req.usuario });
});
