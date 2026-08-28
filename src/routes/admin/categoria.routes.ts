import { Router } from 'express';
import * as categoriaController from '../../controllers/categoria.controller.js';
import { upload } from '../../config/multer.js';
import { requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', categoriaController.listar);
router.get('/:id', categoriaController.obtenerPorId);
router.post('/', requireRole('ADMIN'), upload.single('imagen'), categoriaController.crear);
router.put('/:id', requireRole('ADMIN'), upload.single('imagen'), categoriaController.actualizar);
router.patch('/:id/estado', requireRole('ADMIN'), categoriaController.cambiarEstado);
router.delete('/:id', requireRole('ADMIN'), categoriaController.eliminar);

export default router;
