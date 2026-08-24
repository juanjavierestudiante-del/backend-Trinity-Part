import { Router } from 'express';
import * as productoController from '../../controllers/producto.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearProductoSchema, actualizarProductoSchema } from '../../validations/producto.validation.js';

const router = Router();

router.get('/', productoController.listar);
router.get('/:id', productoController.obtenerPorId);
router.post('/', validate(crearProductoSchema), productoController.crear);
router.put('/:id', validate(actualizarProductoSchema), productoController.actualizar);
router.delete('/:id', productoController.eliminar);

export default router;
