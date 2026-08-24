import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User, Role } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(req.user?.userId, {
      attributes: ['id', 'name', 'email', 'roleId', 'allowedScreens'],
      include: [{ model: Role }]
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const roleName = (user as any).Role?.name || 'Unknown';
    res.json({
      ...user.dataValues,
      role: roleName
    });
  } catch (err) {
    handleControllerError(req, res, err, 'Failed to fetch profile');
  }
};

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

    await User.update(updateData, { where: { id: req.user?.userId } });
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    handleControllerError(req, res, err, 'Failed to update profile');
  }
};

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['passwordHash', 'refreshToken'] },
      include: [{ model: Role }]
    });
    const formattedUsers = users.map(u => ({
      id: u.dataValues.id,
      name: u.dataValues.name,
      email: u.dataValues.email,
      role: (u as any).Role?.name || 'Unknown',
      allowedScreens: u.dataValues.allowedScreens || [],
      createdAt: u.dataValues.createdAt
    }));
    res.json(formattedUsers);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch users');
  }
};

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already exists' });
    
    const adminRole = await Role.findOne({ where: { name: 'Admin' } });
    if (!adminRole) return res.status(500).json({ error: 'Admin role missing' });
    
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      username: email,
      email,
      passwordHash,
      roleId: adminRole.dataValues.id,
      allowedScreens: req.body.allowedScreens || []
    });
    
    res.status(201).json({ message: 'Admin created successfully', user: newUser });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to create admin');
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(parseInt(req.params.id as string, 10));
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.dataValues.email === 'ajithoffice1999@gmail.com') {
      return res.status(403).json({ error: 'Cannot modify the root Super Admin account' });
    }

    const updateData: any = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email) updateData.email = req.body.email;
    if (req.body.password) updateData.passwordHash = await bcrypt.hash(req.body.password, 10);
    if (req.body.allowedScreens) updateData.allowedScreens = req.body.allowedScreens;

    await user.update(updateData);
    res.json({ message: 'Admin updated successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update admin');
  }
};

export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findByPk(parseInt(req.params.id as string, 10));
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.dataValues.email === 'ajithoffice1999@gmail.com') {
      return res.status(403).json({ error: 'Cannot delete the root Super Admin account' });
    }

    await user.destroy();
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete admin');
  }
};
