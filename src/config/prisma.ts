// Instancia única de Prisma Client.
// Reutilizar la misma instancia evita abrir demasiadas conexiones a MySQL.

import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

export default prisma;
