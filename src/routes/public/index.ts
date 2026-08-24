import { Router } from 'express';
import catalogoRoutes from './catalogo.routes.js';

const router = Router();

router.use('/', catalogoRoutes);

export default router;
