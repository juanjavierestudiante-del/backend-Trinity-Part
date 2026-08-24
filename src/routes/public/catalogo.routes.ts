import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as productoController from '../../controllers/producto.controller.js';
import * as categoriaController from '../../controllers/categoria.controller.js';

const router = Router();

// Fuerza siempre el filtro de estado=Activo para no exponer borradores
router.get('/productos', (req: Request, res: Response, next: NextFunction) => {
  req.query.estado = 'Activo';
  next();
}, productoController.listar);

router.get('/productos/:slug', productoController.obtenerPorSlug);

router.get('/categorias', categoriaController.listarRaiz);

export default router;
