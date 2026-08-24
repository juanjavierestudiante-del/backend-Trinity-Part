import { Router } from 'express';
import * as imagenController from '../../controllers/imagen.controller.js';
import { upload, uploadMultiple } from '../../config/multer.js';

const router = Router();

router.post(
  '/producto/:idProducto',
  upload.single('imagen'),
  imagenController.subirImagenProducto
);

// Subida múltiple de imágenes para producto (max 20)
router.post(
  '/producto/:idProducto/multiples',
  uploadMultiple.array('imagenes', 20),
  imagenController.subirMultiplesImagenesProducto
);

// Marcar imagen de producto como principal
router.patch(
  '/producto/:id/principal',
  imagenController.marcarPrincipalProducto
);

router.post(
  '/variante/:idVariante',
  upload.single('imagen'),
  imagenController.subirImagenVariante
);

// Subida múltiple de imágenes para variante (max 20)
router.post(
  '/variante/:idVariante/multiples',
  uploadMultiple.array('imagenes', 20),
  imagenController.subirMultiplesImagenesVariante
);

// Marcar imagen de variante como principal
router.patch(
  '/variante/:id/principal',
  imagenController.marcarPrincipalVariante
);

router.delete('/producto/:id', imagenController.eliminarImagenProducto);
router.delete('/variante/:id', imagenController.eliminarImagenVariante);

router.post(
  '/categoria/:idCategoria',
  upload.single('imagen'),
  imagenController.subirImagenCategoria
);
router.delete('/categoria/:id', imagenController.eliminarImagenCategoria);

export default router;
