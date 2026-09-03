import { Router } from 'express';
import * as pedidoController from '../../controllers/pedido.controller.js';
import { requireRole } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { actualizarEstadoPedidoSchema } from '../../validations/pedido.validation.js';

const router = Router();

router.get('/', requireRole('ADMIN'), pedidoController.listarAdmin);
router.patch('/:id/estado', requireRole('ADMIN'), validate(actualizarEstadoPedidoSchema), pedidoController.cambiarEstadoAdmin);

export default router;