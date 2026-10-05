// Inventario y movimientos: todas las cantidades y umbrales son unidades físicas base.

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

const MAX_STOCK = 2147483647;

const bloquearInventario = async (tx: Prisma.TransactionClient, id: number) => {
  const variantes = await tx.$queryRaw<Array<{ id_variante: number }>>`SELECT id_variante FROM producto_variante WHERE id_variante=${id} FOR NO KEY UPDATE`;
  if (!variantes.length) throw new AppError('Variante no encontrada', 404);
  await tx.$queryRaw`SELECT id_inventario FROM inventario WHERE id_variante=${id} FOR UPDATE`;
};

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
    await bloquearInventario(tx, id);
    const existente = await tx.inventario.findUnique({ where: { idVariante: id } });

    const minimo = datos.stockMinimo ?? existente?.stockMinimo ?? 0;
    const maximo = datos.stockMaximo !== undefined ? datos.stockMaximo : existente?.stockMaximo;
    if (maximo != null && maximo < minimo) throw new AppError('El máximo físico debe ser mayor o igual al mínimo', 400);

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
          tipo: inventario.stockActual > stockAnterior ? 'Entrada' : 'Salida',
          cantidad: Math.abs(inventario.stockActual - stockAnterior),
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
    await bloquearInventario(tx, id);
    const actual = await tx.inventario.findUnique({ where: { idVariante: id } });
    if (!actual) {
      throw new AppError('Inventario no encontrado para esta variante', 404);
    }

    if (cantidad > 0 && actual.stockActual > MAX_STOCK - cantidad) {
      throw new AppError('El stock físico excede el máximo permitido', 400);
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
          tipo: cantidad > 0 ? 'Entrada' : 'Salida',
          cantidad: Math.abs(cantidad),
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

const includeAdmin = {
  producto: { select: {
    idProducto: true, nombre: true, idAtributoPrincipal: true,
    atributoPrincipal: { select: { nombre: true } },
    presentaciones: { where: { activo: true }, orderBy: [{ orden: 'asc' }, { idPresentacion: 'asc' }],
      select: { idPresentacion: true, nombre: true, cantidadBase: true, principal: true } },
  } },
  varianteAtributo: { include: { valorAtributo: { select: { idAtributo: true, valor: true } } } },
  marca: { select: { nombre: true } },
  unidad: { select: { abreviatura: true } },
  inventario: true,
} satisfies Prisma.ProductoVarianteInclude;

type VarianteAdmin = Prisma.ProductoVarianteGetPayload<{ include: typeof includeAdmin }>;

const mapearFila = (v: VarianteAdmin) => {
  const valor = v.varianteAtributo.find(a => a.valorAtributo.idAtributo === v.producto.idAtributoPrincipal)?.valorAtributo.valor;
  const inventario = {
    stockActual: v.inventario?.stockActual ?? 0,
    stockMinimo: v.inventario?.stockMinimo ?? 0,
    stockMaximo: v.inventario?.stockMaximo ?? null,
  };
  return {
    idProducto: v.idProducto, producto: v.producto.nombre,
    productoInfo: { idProducto: v.idProducto, nombre: v.producto.nombre },
    idVariante: v.idVariante, sku: v.sku, marca: v.marca?.nombre ?? null,
    unidad: v.unidad?.abreviatura ?? null, estado: v.estado,
    atributoPrincipal: v.producto.atributoPrincipal ? { nombre: v.producto.atributoPrincipal.nombre, valor: valor ?? null } : null,
    inventario, ...inventario, tieneRegistro: !!v.inventario,
    presentaciones: v.producto.presentaciones,
  };
};

export const findTodos = async (page = 1, limit = 20) => {
  const [variantes, total] = await prisma.$transaction([
    prisma.productoVariante.findMany({
      orderBy: [{ producto: { nombre: 'asc' } }, { sku: 'asc' }],
      include: includeAdmin, skip: (page - 1) * limit, take: limit,
    }),
    prisma.productoVariante.count(),
  ]);
  return { items: variantes.map(mapearFila), total };
};

export const findBajoStock = async () => {
  const variantes = await prisma.productoVariante.findMany({
    where: { OR: [{ inventario: null }, { inventario: { stockActual: { lte: prisma.inventario.fields.stockMinimo } } }] },
    include: includeAdmin,
    orderBy: [{ inventario: { stockActual: 'asc' } }, { sku: 'asc' }],
  });
  return variantes.map(mapearFila);
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
