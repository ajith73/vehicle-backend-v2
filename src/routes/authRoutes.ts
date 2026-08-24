import { Router } from 'express';
import { login, refreshToken, register, googleAuth, updatePassword } from '../controllers/authController';
import { validateBody } from '../middleware/validation';
import { loginSchema } from '../validation/schemas';
import { authenticate } from '../middleware/authMiddleware';

export const authRoutes = Router();

authRoutes.post('/login', validateBody(loginSchema), login);
authRoutes.post('/register', register);
authRoutes.post('/google', googleAuth);
authRoutes.post('/refresh', refreshToken);
authRoutes.put('/password', authenticate as any, updatePassword as any);
