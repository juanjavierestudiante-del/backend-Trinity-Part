import type { Prisma } from '@prisma/client';

export interface ReglaPrecioUmbral {
  idReglaPrecio: number;
  nombre: string;
  cantidadMinima: number;
  precioPorPresentacion: Prisma.Decimal;
  principal: boolean;
  activo: boolean;
  orden: number;
}

export interface ListaPrecioAplicable {
  idListaPrecio: number;
  idProducto: number;
  nombre: string;
  principal: boolean;
  activo: boolean;
  reglas: ReglaPrecioUmbral[];
}

export interface ContextoListaPrecio {
  idVariante: number;
  idProducto: number;
  idListaPrecioAsignada: number | null;
  listaAsignada: ListaPrecioAplicable | null;
  listaPrincipal: ListaPrecioAplicable | null;
}

export interface ResultadoPrecioUmbral {
  cantidad: number;
  idReglaPrecio: number;
  cantidadMinimaAplicada: number;
  precioPorPresentacion: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}

export interface ResultadoPrecioVariante extends ResultadoPrecioUmbral {
  idVariante: number;
  idProducto: number;
  idListaPrecioEfectiva: number;
}

export interface LineaPrecioSolicitada {
  idVariante: number;
  cantidad: number;
}

export interface LineaPrecioResuelta extends ResultadoPrecioUmbral {
  idVariante: number;
  idProducto: number;
  idListaPrecioEfectiva: number;
}

export interface GrupoPrecioResuelto extends ResultadoPrecioUmbral {
  idProducto: number;
  idListaPrecio: number;
  cantidadTotal: number;
  subtotalGrupo: Prisma.Decimal;
}

export interface ResultadoPreciosAgrupados {
  grupos: GrupoPrecioResuelto[];
  lineas: LineaPrecioResuelta[];
  total: Prisma.Decimal;
}

export type CodigoErrorPrecio =
  | 'VARIANTE_NO_ENCONTRADA'
  | 'SIN_LISTA_PRECIO'
  | 'SIN_REGLAS_PRECIO'
  | 'CANTIDAD_INVALIDA'
  | 'CANTIDAD_SIN_UMBRAL';

export class ErrorPrecioCantidad extends Error {
  constructor(public readonly code: CodigoErrorPrecio) {
    super(code);
    this.name = 'ErrorPrecioCantidad';
  }
}
