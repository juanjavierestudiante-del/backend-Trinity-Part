import { Router } from 'express';
import * as imagenController from '../../controllers/imagen.controller.js';
import { upload, uploadMultiple } from '../../config/multer.js';
import { requireRole } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post(
  '/producto/:idProducto',
  requireRole('ADMIN'),
  upload.single('imagen'),
  imagenController.subirImagenProducto
);

// Subida múltiple de imágenes para producto (max 20)
router.post(
  '/producto/:idProducto/multiples',
  requireRole('ADMIN'),
  uploadMultiple.array('imagenes', 20),
  imagenController.subirMultiplesImagenesProducto
);

// Marcar imagen de producto como principal
router.patch(
  '/producto/:id/principal',
  requireRole('ADMIN'),
  imagenController.marcarPrincipalProducto
);

router.post(
  '/variante/:idVariante',
  requireRole('ADMIN'),
  upload.single('imagen'),
  imagenController.subirImagenVariante
);

// Subida múltiple de imágenes para variante (max 20)
router.post(
  '/variante/:idVariante/multiples',
  requireRole('ADMIN'),
  uploadMultiple.array('imagenes', 20),
  imagenController.subirMultiplesImagenesVariante
);

// Marcar imagen de variante como principal
router.patch(
  '/variante/:id/principal',
  requireRole('ADMIN'),
  imagenController.marcarPrincipalVariante
);

router.delete('/producto/:id', requireRole('ADMIN'), imagenController.eliminarImagenProducto);
router.delete('/variante/:id', requireRole('ADMIN'), imagenController.eliminarImagenVariante);

router.post(
  '/categoria/:idCategoria',
  requireRole('ADMIN'),
  upload.single('imagen'),
  imagenController.subirImagenCategoria
);
router.delete('/categoria/:id', requireRole('ADMIN'), imagenController.eliminarImagenCategoria);

export default router;
