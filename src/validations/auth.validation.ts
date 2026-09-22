// Schema de validación para auth (login + registro).

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  apellido: z.string().trim().min(1, 'El apellido es obligatorio').max(150),
  email: z.string().email('Email inválido'),
  telefono: z.string().trim().min(1, 'El teléfono es obligatorio').max(20),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export const googleSchema = z.object({ credential: z.string().min(1) });
export const completeProfileSchema = z.object({ telefono: z.string().trim().min(1, 'El teléfono es obligatorio').max(20) });

export const updateProfileSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(150),
  apellido: z.string().trim().max(150).nullable().optional(),
  telefono: z.string().trim().min(1, 'El teléfono es obligatorio').max(20),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
