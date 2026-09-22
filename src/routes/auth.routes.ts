import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { completeProfileSchema, googleSchema, loginSchema, registerSchema, updateProfileSchema } from '../validations/auth.validation.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { loginRateLimiter } from '../middlewares/rateLimit.middleware.js';

const router = Router();

router.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
router.post('/admin/login', loginRateLimiter, validate(loginSchema), authController.loginAdmin);
router.post('/register', validate(registerSchema), authController.register);
router.post('/google', loginRateLimiter, validate(googleSchema), authController.google);
router.patch('/complete-profile', authMiddleware, validate(completeProfileSchema), authController.completeProfile);
router.patch('/profile', authMiddleware, validate(updateProfileSchema), authController.updateProfile);
router.get('/me', authMiddleware, authController.me);
router.get('/perfil', authMiddleware, authController.me);
router.post('/logout', authController.logout);

export default router;
