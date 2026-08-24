import { Router } from 'express';
import * as categoriaController from '../../controllers/categoria.controller.js';
import { upload } from '../../config/multer.js';

const router = Router();

router.get('/', categoriaController.listar);
router.get('/:id', categoriaController.obtenerPorId);
router.post('/', upload.single('imagen'), categoriaController.crear);
router.put('/:id', upload.single('imagen'), categoriaController.actualizar);
router.patch('/:id/estado', categoriaController.cambiarEstado);
router.delete('/:id', categoriaController.eliminar);

export default router;
