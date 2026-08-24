import { Router } from 'express';
import { authRoutes } from './authRoutes';
import { adminRoutes } from './adminRoutes';
import { publicRoutes } from './publicRoutes';
import { customerRoutes } from './customerRoutes';
import { mechanicRoutes } from './mechanicRoutes';

export const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/admin', adminRoutes);
routes.use('/public', publicRoutes);
routes.use('/customer', customerRoutes);
routes.use('/mechanic', mechanicRoutes);
