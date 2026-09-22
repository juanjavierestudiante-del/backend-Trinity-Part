import { Router } from 'express';
import * as carritoController from '../controllers/carrito.controller.js';
import { validate, validateParams } from '../middlewares/validate.middleware.js';
import { agregarItemSchema, actualizarItemSchema, idDetalleParamsSchema } from '../validations/carrito.validation.js';

const router = Router();

router.get('/', carritoController.obtener);
router.get('/count', carritoController.contar);
router.post('/items', validate(agregarItemSchema), carritoController.agregarItem);
router.put('/items/:idDetalle', validateParams(idDetalleParamsSchema), validate(actualizarItemSchema), carritoController.actualizarItem);
router.delete('/items/:idDetalle', validateParams(idDetalleParamsSchema), carritoController.eliminarItem);

export default router;
