// Tipo del payload que va dentro del JWT y que se asigna a req.usuario.

export interface JwtPayloadUsuario {
  id_usuario: number;
  email?: string;
  rol?: string;
}
