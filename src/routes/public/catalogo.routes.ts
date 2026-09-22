import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as productoController from '../../controllers/producto.controller.js';
import * as categoriaController from '../../controllers/categoria.controller.js';
import * as precioPublicoController from '../../controllers/precio-publico.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { previsualizarPrecioSchema } from '../../validations/precio-publico.validation.js';

const router = Router();

// Fuerza siempre el filtro de estado=Activo para no exponer borradores
// y permite cachear el listado (el catálogo cambia poco).
router.get('/productos', (req: Request, res: Response, next: NextFunction) => {
  req.query.estado = 'Activo';
  res.set('Cache-Control', 'public, max-age=300');
  next();
}, productoController.listar);

router.post('/productos/:idProducto/precio', validate(previsualizarPrecioSchema), precioPublicoController.previsualizar);
router.get('/productos/:slug', productoController.obtenerPorSlug);

router.get('/categorias', (req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'public, max-age=300');
  next();
}, categoriaController.listarRaiz);

export default router;
