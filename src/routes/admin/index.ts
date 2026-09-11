import { Router } from 'express';
import productoRoutes from './producto.routes.js';
import categoriaRoutes from './categoria.routes.js';
import inventarioRoutes from './inventario.routes.js';
import productoVarianteRoutes from './productoVariante.routes.js';
import imagenRoutes from './imagen.routes.js';
import pedidoRoutes from './pedido.routes.js';
import { requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  actualizarAtributoSchema,
  actualizarValorAtributoSchema,
  crearAtributoSchema,
  crearValorAtributoSchema,
  esColorHexadecimalValido,
} from '../../validations/atributo.validation.js';
import { AppError } from '../../utils/helpers.js';
import { validarCombinacionActivaUnica } from '../../repositories/productoVariante.repository.js';

const router = Router();

router.use('/productos', productoRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/variantes', productoVarianteRoutes);
router.use('/imagenes', imagenRoutes);
router.use('/pedidos', pedidoRoutes);

export default router;

import prisma from '../../config/prisma.js';
import { asyncHandler } from '../../utils/helpers.js';

// Dentro del router admin, agrega:
router.get('/marcas', asyncHandler(async (req, res) => {
  const marcas = await prisma.marca.findMany({ orderBy: { nombre: 'asc' } });
  res.json(marcas);
}));

router.get('/unidades', asyncHandler(async (req, res) => {
  const unidades = await prisma.unidadMedida.findMany({ orderBy: { nombre: 'asc' } });
  res.json(unidades);
}));

//mientras tanto usaremos rutas sin dividir en servicios , repositorios y controladores, para poder avanzar con el proyecto.


// Agregar estos 4 endpoints nuevos al router de admin

// GET /api/admin/atributos — lista todos los atributos con sus valores
router.get('/atributos', asyncHandler(async (req, res) => {
  const atributos = await prisma.atributo.findMany({
    include: { valores: true },
    orderBy: { nombre: 'asc' },
  });
  res.json(atributos);
}));

// POST /api/admin/atributos — crea un atributo nuevo (ej: "Material")
router.post('/atributos', requireRole('ADMIN'), validate(crearAtributoSchema), asyncHandler(async (req, res) => {
  const { nombre, tipoVisualizacion } = req.body;
  const atributo = await prisma.atributo.create({
    data: { nombre, ...(tipoVisualizacion ? { tipoVisualizacion } : {}) },
    include: { valores: true },
  });
  res.status(201).json(atributo);
}));

router.patch('/atributos/:id', requireRole('ADMIN'), validate(actualizarAtributoSchema), asyncHandler(async (req, res) => {
  const atributo = await prisma.atributo.findUnique({ where: { idAtributo: Number(req.params.id) } });
  if (!atributo) throw new AppError('Atributo no encontrado', 404);
  if (req.body.tipoVisualizacion === 'color') {
    const valores = await prisma.valorAtributo.findMany({
      where: { idAtributo: atributo.idAtributo, visualValue: { not: null } },
      select: { visualValue: true },
    });
    if (valores.some((valor) => !esColorHexadecimalValido(valor.visualValue as string))) {
      throw new AppError('No se puede usar tipo color mientras existan visualValue no hexadecimales', 400);
    }
  }

  const actualizado = await prisma.atributo.update({
    where: { idAtributo: atributo.idAtributo },
    data: req.body,
    include: { valores: true },
  });
  res.json(actualizado);
}));

// POST /api/admin/atributos/:id/valores — agrega un valor a un atributo existente
router.post('/atributos/:id/valores', requireRole('ADMIN'), validate(crearValorAtributoSchema), asyncHandler(async (req, res) => {
  const atributo = await prisma.atributo.findUnique({ where: { idAtributo: Number(req.params.id) } });
  if (!atributo) throw new AppError('Atributo no encontrado', 404);
  const { valor, visualValue } = req.body;
  if (atributo.tipoVisualizacion === 'color' && visualValue != null && !esColorHexadecimalValido(visualValue)) {
    throw new AppError('visualValue debe tener formato hexadecimal #RGB o #RRGGBB para un atributo de color', 400);
  }
  const valorCreado = await prisma.valorAtributo.create({
    data: {
      idAtributo: atributo.idAtributo,
      valor,
      ...(visualValue !== undefined ? { visualValue } : {}),
    },
  });
  res.status(201).json(valorCreado);
}));

router.patch('/atributos/:id/valores/:idValor', requireRole('ADMIN'), validate(actualizarValorAtributoSchema), asyncHandler(async (req, res) => {
  const idAtributo = Number(req.params.id);
  const valor = await prisma.valorAtributo.findUnique({ where: { idValor: Number(req.params.idValor) }, include: { atributo: true } });
  if (!valor || valor.idAtributo !== idAtributo) {
    throw new AppError('El valor de atributo no pertenece al atributo indicado', 404);
  }
  if (valor.atributo.tipoVisualizacion === 'color' && req.body.visualValue != null && !esColorHexadecimalValido(req.body.visualValue)) {
    throw new AppError('visualValue debe tener formato hexadecimal #RGB o #RRGGBB para un atributo de color', 400);
  }
  const actualizado = await prisma.valorAtributo.update({
    where: { idValor: valor.idValor },
    data: req.body,
  });
  res.json(actualizado);
}));

// POST /api/admin/variantes/:id/atributos — asigna un valor de atributo a una variante
router.post('/variantes/:id/atributos', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { idValor } = req.body;
  const variante = await prisma.productoVariante.findUnique({ where: { idVariante: Number(req.params.id) } });
  if (!variante) throw new AppError('Variante no encontrada', 404);
  const valor = await prisma.valorAtributo.findUnique({ where: { idValor: Number(idValor) } });
  if (!valor) throw new AppError('Valor de atributo no encontrado', 404);
  await validarCombinacionActivaUnica(variante.idVariante, valor.idValor);
  await prisma.varianteAtributo.create({
    data: {
      idVariante: variante.idVariante,
      idValor: valor.idValor,
    },
  });
  res.status(201).json({ ok: true });
}));

// DELETE /api/admin/variantes/:id/atributos/:idValor — quita un atributo de una variante
router.delete('/variantes/:id/atributos/:idValor', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  await prisma.varianteAtributo.delete({
    where: {
      idVariante_idValor: {
        idVariante: Number(req.params.id),
        idValor: Number(req.params.idValor),
      },
    },
  });
  res.status(204).send();
}));
