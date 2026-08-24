import { Router } from 'express';
import authRoutes from './auth.routes.js';
import adminRoutes from './admin/index.js';
import publicRoutes from './public/index.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/admin', authMiddleware, adminRoutes);
router.use('/', publicRoutes);

export default router;
