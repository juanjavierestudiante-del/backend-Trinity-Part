// Extiende el tipo Request de Express para que TypeScript reconozca
// req.usuario después de pasar por el authMiddleware.

import type { JwtPayloadUsuario } from './auth.types.js';

declare module 'express-serve-static-core' {
  interface Request {
    usuario?: JwtPayloadUsuario;
  }
}
