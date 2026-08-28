import { Router } from 'express';
import * as pedidoController from '../controllers/pedido.controller.js';

const router = Router();

router.post('/', pedidoController.crear);
router.get('/', pedidoController.listar);

export default router;
