import { Router } from 'express';
import * as pedidoController from '../controllers/pedido.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { crearPedidoSchema } from '../validations/pedido.validation.js';

const router = Router();

router.post('/', validate(crearPedidoSchema), pedidoController.crear);
router.get('/', pedidoController.listar);

export default router;