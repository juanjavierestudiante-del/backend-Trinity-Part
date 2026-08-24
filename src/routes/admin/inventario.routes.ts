import { Router } from 'express';
import * as inventarioController from '../../controllers/inventario.controller.js';

const router = Router();

router.get('/alertas', inventarioController.alertasBajoStock);
router.get('/:idVariante', inventarioController.obtenerPorVariante);
router.put('/:idVariante', inventarioController.actualizarStock);
router.patch('/:idVariante/ajustar', inventarioController.ajustarStock);

export default router;
