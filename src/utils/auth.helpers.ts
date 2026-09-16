import { AppError } from './helpers.js';

export const normalizarEmail = (email: string) => email.trim().toLowerCase();

export const normalizarTelefonoBolivia = (telefono: string) => {
  const limpio = telefono.trim().replace(/[\s-]/g, '');
  const numeroLocal = limpio.startsWith('+591')
    ? limpio.slice(4)
    : limpio.startsWith('591')
      ? limpio.slice(3)
      : limpio;

  if (!/^[67]\d{7}$/.test(numeroLocal)) {
    throw new AppError('Teléfono boliviano inválido', 400);
  }

  return `+591${numeroLocal}`;
};
