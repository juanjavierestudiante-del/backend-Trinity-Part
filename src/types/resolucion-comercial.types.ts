import type { Prisma } from '@prisma/client';
import type { ReglaPrecioUmbral } from './precio-cantidad.types.js';

export interface IdentidadGrupoComercial {
  idProducto: number;
  presentacion: { idPresentacion: number };
  perfilPrecio: { idPerfilPrecio: number };
}

/** Contexto reutilizable: conserva las reglas cargadas para resolver cantidades sin más queries. */
export interface ContextoComercialBase extends IdentidadGrupoComercial {
  idVariante: number;
  presentacion: { idPresentacion: number; nombre: string; cantidadBase: number };
  perfilPrecio: { idPerfilPrecio: number; nombre: string };
  listaPrecio: { idListaPrecio: number; nombre: string; reglas: ReglaPrecioUmbral[] };
}

export interface ContextoVentaResuelto extends ContextoComercialBase {
  reglaPrecio: {
    idReglaPrecio: number;
    cantidadMinima: number;
    precioPorPresentacion: Prisma.Decimal;
  };
  cantidadPresentaciones: number;
  precioPorPresentacion: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  cantidadBaseTotal: number;
}
