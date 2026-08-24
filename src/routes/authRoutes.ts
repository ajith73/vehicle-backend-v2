import { Router } from 'express';
import { login, refreshToken, register, googleAuth, updatePassword, forgotPassword, resetPassword } from '../controllers/authController';
import { validateBody } from '../middleware/validation';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from '../validation/schemas';
import { authenticate } from '../middleware/authMiddleware';

export const authRoutes = Router();

authRoutes.post('/login', validateBody(loginSchema), login);
authRoutes.post('/register', register);
authRoutes.post('/google', googleAuth);
authRoutes.post('/refresh', refreshToken);
authRoutes.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
authRoutes.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);
authRoutes.put('/password', authenticate as any, updatePassword as any);
