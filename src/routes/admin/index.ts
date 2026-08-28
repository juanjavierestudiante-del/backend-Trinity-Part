import { Router } from 'express';
import productoRoutes from './producto.routes.js';
import categoriaRoutes from './categoria.routes.js';
import inventarioRoutes from './inventario.routes.js';
import productoVarianteRoutes from './productoVariante.routes.js';
import imagenRoutes from './imagen.routes.js';
import { requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use('/productos', productoRoutes);
router.use('/categorias', categoriaRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/variantes', productoVarianteRoutes);
router.use('/imagenes', imagenRoutes);

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
router.post('/atributos', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { nombre } = req.body;
  const atributo = await prisma.atributo.create({
    data: { nombre },
    include: { valores: true },
  });
  res.status(201).json(atributo);
}));

// POST /api/admin/atributos/:id/valores — agrega un valor a un atributo existente
router.post('/atributos/:id/valores', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { valor } = req.body;
  const valorCreado = await prisma.valorAtributo.create({
    data: {
      idAtributo: Number(req.params.id),
      valor,
    },
  });
  res.status(201).json(valorCreado);
}));

// POST /api/admin/variantes/:id/atributos — asigna un valor de atributo a una variante
router.post('/variantes/:id/atributos', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { idValor } = req.body;
  await prisma.varianteAtributo.create({
    data: {
      idVariante: Number(req.params.id),
      idValor: Number(idValor),
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