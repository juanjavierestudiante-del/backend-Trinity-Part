// Capa de acceso a datos para Inventario.

import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AppError } from '../utils/helpers.js';

export const findByVariante = (idVariante: number | string) => {
  return prisma.inventario.findUnique({ where: { idVariante: Number(idVariante) } });
};

// Contexto opcional para registrar el movimiento de stock asociado.
interface ContextoMovimiento {
  idUsuario?: number | null;
  motivo?: string | null;
}

const resolverMotivo = (ctx: ContextoMovimiento) =>
  ctx.motivo?.trim() || 'Ajuste manual desde admin';

// PUT: fija valores absolutos y registra el movimiento si cambia stockActual.
// Si la variante aún no tiene inventario, lo crea con los valores recibidos.
export const upsertConMovimiento = async (
  idVariante: number | string,
  datos: { stockActual?: number; stockMinimo?: number; stockMaximo?: number | null },
  ctx: ContextoMovimiento = {}
) => {
  const id = Number(idVariante);

  return prisma.$transaction(async (tx) => {
    const existente = await tx.inventario.findUnique({ where: { idVariante: id } });

    let inventario;
    let stockAnterior: number;

    if (!existente) {
      stockAnterior = 0;
      inventario = await tx.inventario.create({
        data: {
          idVariante: id,
          stockActual: datos.stockActual ?? 0,
          stockMinimo: datos.stockMinimo ?? 0,
          ...(datos.stockMaximo !== undefined ? { stockMaximo: datos.stockMaximo } : {}),
        },
      });
    } else {
      stockAnterior = existente.stockActual;
      inventario = await tx.inventario.update({
        where: { idVariante: id },
        data: {
          ...(datos.stockActual !== undefined ? { stockActual: datos.stockActual } : {}),
          ...(datos.stockMinimo !== undefined ? { stockMinimo: datos.stockMinimo } : {}),
          ...(datos.stockMaximo !== undefined ? { stockMaximo: datos.stockMaximo } : {}),
        },
      });
    }

    if (inventario.stockActual !== stockAnterior) {
      await tx.movimientoInventario.create({
        data: {
          idVariante: id,
          tipo: 'Ajuste',
          cantidad: inventario.stockActual - stockAnterior,
          stockAnterior,
          stockNuevo: inventario.stockActual,
          motivo: resolverMotivo(ctx),
          idUsuario: ctx.idUsuario ?? null,
        },
      });
    }

    return inventario;
  });
};

// PATCH /ajustar: incremento/decremento atómico + registro del movimiento.
// El decremento es condicional (WHERE stock_actual >= |cantidad|) para nunca dejar stock negativo.
export const ajustarConMovimiento = async (
  idVariante: number | string,
  cantidad: number,
  ctx: ContextoMovimiento = {}
) => {
  const id = Number(idVariante);

  return prisma.$transaction(async (tx) => {
    const actual = await tx.inventario.findUnique({ where: { idVariante: id } });
    if (!actual) {
      throw new AppError('Inventario no encontrado para esta variante', 404);
    }

    if (cantidad < 0) {
      const resultado = await tx.inventario.updateMany({
        where: { idVariante: id, stockActual: { gte: -cantidad } },
        data: { stockActual: { decrement: -cantidad } },
      });
      if (resultado.count === 0) {
        throw new AppError('Stock insuficiente', 400);
      }
    } else if (cantidad > 0) {
      await tx.inventario.update({
        where: { idVariante: id },
        data: { stockActual: { increment: cantidad } },
      });
    }

    const actualizado = await tx.inventario.findUniqueOrThrow({ where: { idVariante: id } });

    if (cantidad !== 0 && actualizado.stockActual !== actual.stockActual) {
      await tx.movimientoInventario.create({
        data: {
          idVariante: id,
          tipo: 'Ajuste',
          cantidad,
          stockAnterior: actualizado.stockActual - cantidad,
          stockNuevo: actualizado.stockActual,
          motivo: resolverMotivo(ctx),
          idUsuario: ctx.idUsuario ?? null,
        },
      });
    }

    return actualizado;
  });
};

export interface FilaInventario {
  idProducto: number;
  producto: string;
  idVariante: number;
  sku: string;
  marca: string | null;
  unidad: string | null;
  estado: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number | null;
  tieneRegistro: boolean;
}

// Listado global: todas las variantes con su inventario (sin registro → stocks en 0).
export const findTodos = async (
  page = 1,
  limit = 20
): Promise<{ items: FilaInventario[]; total: number }> => {
  const [variantes, total] = await prisma.$transaction([
    prisma.productoVariante.findMany({
      orderBy: [{ producto: { nombre: 'asc' } }, { sku: 'asc' }],
      include: {
        producto: { select: { nombre: true } },
        marca: { select: { nombre: true } },
        unidad: { select: { abreviatura: true } },
        inventario: true,
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.productoVariante.count(),
  ]);

  const items = variantes.map((v) => ({
    idProducto: v.idProducto,
    producto: v.producto.nombre,
    idVariante: v.idVariante,
    sku: v.sku,
    marca: v.marca?.nombre ?? null,
    unidad: v.unidad?.abreviatura ?? null,
    estado: v.estado,
    stockActual: v.inventario?.stockActual ?? 0,
    stockMinimo: v.inventario?.stockMinimo ?? 0,
    stockMaximo: v.inventario?.stockMaximo ?? null,
    tieneRegistro: !!v.inventario,
  }));

  return { items, total };
};

export interface FilaBajoStock {
  idProducto: number;
  producto: string;
  idVariante: number;
  sku: string;
  marca: string | null;
  unidad: string | null;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number | null;
  tieneRegistro: boolean;
}

// Alertas: variantes por debajo (o iguales) al mínimo, incluidas las que
// no tienen registro de inventario (se tratan como stock 0).
export const findBajoStock = async (): Promise<FilaBajoStock[]> => {
  const variantes = await prisma.productoVariante.findMany({
    where: {
      OR: [
        { inventario: null },
        { inventario: { stockActual: { lte: prisma.inventario.fields.stockMinimo } } },
      ],
    },
    include: {
      producto: { select: { nombre: true } },
      marca: { select: { nombre: true } },
      unidad: { select: { abreviatura: true } },
      inventario: true,
    },
    orderBy: [{ inventario: { stockActual: 'asc' } }, { sku: 'asc' }],
  });

  return variantes.map((v) => ({
    idProducto: v.idProducto,
    producto: v.producto.nombre,
    idVariante: v.idVariante,
    sku: v.sku,
    marca: v.marca?.nombre ?? null,
    unidad: v.unidad?.abreviatura ?? null,
    stockActual: v.inventario?.stockActual ?? 0,
    stockMinimo: v.inventario?.stockMinimo ?? 0,
    stockMaximo: v.inventario?.stockMaximo ?? null,
    tieneRegistro: !!v.inventario,
  }));
};

export interface FilaMovimiento {
  idMovimiento: number;
  tipo: string;
  cantidad: number;
  stockAnterior: number;
  stockNuevo: number;
  motivo: string | null;
  usuario: string | null;
  fecha: Date;
}

// Historial de movimientos de una variante, más recientes primero.
export const findHistorialPorVariante = async (idVariante: number): Promise<FilaMovimiento[]> => {
  const movimientos = await prisma.movimientoInventario.findMany({
    where: { idVariante },
    orderBy: { fecha: 'desc' },
    include: { usuario: { select: { nombre: true } } },
  });

  return movimientos.map((m) => ({
    idMovimiento: m.idMovimiento,
    tipo: m.tipo,
    cantidad: m.cantidad,
    stockAnterior: m.stockAnterior,
    stockNuevo: m.stockNuevo,
    motivo: m.motivo,
    usuario: m.usuario?.nombre ?? null,
    fecha: m.fecha,
  }));
};
