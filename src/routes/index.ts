import { Router } from 'express';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin/index.js';
import publicRoutes from './public/index.js';
import carritoRoutes from './carrito.routes.js';
import pedidoRoutes from './pedido.routes.js';
import entregaRoutes from './entrega.routes.js';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', authMiddleware, requireRole('ADMIN'), adminRoutes);
router.use('/carrito', authMiddleware, carritoRoutes);
router.use('/pedidos', authMiddleware, pedidoRoutes);
router.use('/entrega', entregaRoutes);
router.use('/', publicRoutes);

export default router;
