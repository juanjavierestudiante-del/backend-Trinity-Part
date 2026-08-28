import { Router } from 'express';
import * as inventarioController from '../../controllers/inventario.controller.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { requireRole } from '../../middlewares/auth.middleware.js';
import {
  actualizarInventarioSchema,
  ajustarInventarioSchema,
} from '../../validations/inventario.validation.js';

const router = Router();

router.get('/', inventarioController.listarTodo);
router.get('/alertas', inventarioController.alertasBajoStock);
router.get('/:idVariante/historial', inventarioController.historial);
router.get('/:idVariante', inventarioController.obtenerPorVariante);
router.put('/:idVariante', requireRole('ADMIN'), validate(actualizarInventarioSchema), inventarioController.actualizarStock);
router.patch('/:idVariante/ajustar', requireRole('ADMIN'), validate(ajustarInventarioSchema), inventarioController.ajustarStock);

export default router;
