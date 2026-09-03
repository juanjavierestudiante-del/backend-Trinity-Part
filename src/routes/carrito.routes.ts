import { Router } from 'express';
import * as carritoController from '../controllers/carrito.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { agregarItemSchema, actualizarItemSchema } from '../validations/carrito.validation.js';

const router = Router();

router.get('/', carritoController.obtener);
router.get('/count', carritoController.contar);
router.post('/items', validate(agregarItemSchema), carritoController.agregarItem);
router.put('/items/:idDetalle', validate(actualizarItemSchema), carritoController.actualizarItem);
router.delete('/items/:idDetalle', carritoController.eliminarItem);

export default router;
