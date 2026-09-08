import { Router } from 'express';
import * as productoController from '../../controllers/producto.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearProductoSchema, actualizarProductoSchema } from '../../validations/producto.validation.js';
import { requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', productoController.listarTodos);
router.get('/:id', productoController.obtenerPorId);
router.post('/', requireRole('ADMIN'), validate(crearProductoSchema), productoController.crear);
router.put('/:id', requireRole('ADMIN'), validate(actualizarProductoSchema), productoController.actualizar);
router.delete('/:id', requireRole('ADMIN'), productoController.eliminar);

export default router;
