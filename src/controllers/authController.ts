import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, Role, Mechanic, CustomerProfile, CustomerRequest, CustomerSubscription } from '../models';
import { logger } from '../lib/logger';
import { handleControllerError } from '../utils/controller';
import { sendPasswordResetEmail } from '../utils/mail';

const JWT_SECRET = 'supersecret_mvp_key_change_me_in_prod';

const getRefreshTokenExpiry = (role?: string) => {
  if (role === 'Customer') return '30d';
  return '7d';
};

const roleMatchesPortal = (role: string, portal?: string) => {
  if (!portal) return true;
  if (portal === 'CUSTOMER') return role === 'Customer';
  if (portal === 'PARTNER') return role === 'Mechanic' || role === 'Partner';
  if (portal === 'ADMIN') return role === 'Admin' || role === 'Super Admin';
  return true;
};

const portalErrorMessage = (portal?: string) => {
  if (portal === 'CUSTOMER') return 'Only customer accounts can login from the customer screen';
  if (portal === 'PARTNER') return 'Only partner accounts can login from the partner screen';
  if (portal === 'ADMIN') return 'Only admin accounts can login from the admin screen';
  return 'This account is not allowed on this login screen';
};

const resolveUserRole = async (user: any) => {
  const roleName = (user as any).Role?.name;
  if (roleName) return roleName;

  const userId = user?.dataValues?.id;
  if (!userId) return 'Unknown';

  const [customerProfile, customerRequest, customerSubscription] = await Promise.all([
    CustomerProfile.findOne({ where: { userId } }),
    CustomerRequest.findOne({ where: { customerUserId: userId } }),
    CustomerSubscription.findOne({ where: { customerUserId: userId } })
  ]);

  if (customerProfile || customerRequest || customerSubscription) {
    const customerRole = await Role.findOne({ where: { name: 'Customer' } });
    if (customerRole && user.getDataValue('roleId') !== customerRole.getDataValue('id')) {
      await user.update({ roleId: customerRole.getDataValue('id') });
    }
    (user as any).Role = customerRole;
    return 'Customer';
  }

  return 'Unknown';
};

const isReusablePartnerUser = async (user: any) => {
  if (!user || user.getDataValue('deletedAt')) return false;

  const roleName = (user as any).Role?.name;
  if (roleName !== 'Mechanic' && roleName !== 'Partner') return false;

  const userId = Number(user.getDataValue('id'));
  if (!userId) return false;

  const linkedMechanic = await Mechanic.findOne({ where: { createdById: userId } });
  return !linkedMechanic;
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, portal } = req.body;
    const user = await User.findOne({ 
      where: { email },
      include: [{ model: Role }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.dataValues.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userRole = await resolveUserRole(user);
    if (!roleMatchesPortal(userRole, portal)) {
      return res.status(403).json({ error: portalErrorMessage(portal) });
    }
    logger.info('login_successful', { requestId: req.requestId, email, role: userRole });
    
    let mechanicId = null;
    if (userRole === 'Mechanic') {
      const mechanic = await Mechanic.findOne({ where: { createdById: user.dataValues.id } });
      if (mechanic) {
        mechanicId = mechanic.dataValues.id;
      } else {
        // Check if the user has a pending verification request instead
        const { VerificationRequest } = require('../models');
        const reqs = await VerificationRequest.findAll();
        const vr = reqs.find((r: any) => r.submittedData && r.submittedData.__userId === user.dataValues.id);
        if (vr) {
          mechanicId = vr.dataValues.mechanicId;
        }
      }
    }
    
    const token = jwt.sign(
      { userId: user.dataValues.id, role: userRole },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.dataValues.id, role: userRole },
      JWT_SECRET,
      { expiresIn: getRefreshTokenExpiry(userRole) }
    );

    res.json({ token, refreshToken, role: userRole, email, mechanicId });
  } catch (error: any) {
    handleControllerError(req, res, error, 'Login failed');
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required' });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      
      const token = jwt.sign(
        { userId: decoded.userId, role: decoded.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const newRefreshToken = jwt.sign(
        { userId: decoded.userId, role: decoded.role },
        JWT_SECRET,
        { expiresIn: getRefreshTokenExpiry(decoded.role) }
      );

      res.json({ token, refreshToken: newRefreshToken, role: decoded.role });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
  } catch (error: any) {
    handleControllerError(req, res, error, 'Failed to refresh token');
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, mobile, role = 'Customer' } = req.body;
    
    const normalizedMobile = typeof mobile === 'string' ? mobile.replace(/\D/g, '').slice(-10) : null;

    const existingUser = await User.findOne({ where: { email }, paranoid: false, include: [{ model: Role }] });
    const isReRegisteringDeletedUser = Boolean(existingUser?.deletedAt);
    const isReusingPartnerUser = await isReusablePartnerUser(existingUser);

    if (existingUser && !isReRegisteringDeletedUser && !isReusingPartnerUser) {
      return res.status(400).json({ error: 'A user account with this email already exists.' });
    }

    if (role === 'Customer' && normalizedMobile) {
      const existingMobileProfile = await CustomerProfile.findOne({
        where: { phone: normalizedMobile },
        include: [{ model: User, paranoid: false, attributes: ['id', 'deletedAt'] }] as any
      });
      const activeMobileOwner = existingMobileProfile && !(existingMobileProfile as any).User?.deletedAt;
      const belongsToSameDeletedUser = existingMobileProfile && existingUser && existingMobileProfile.getDataValue('userId') === existingUser.getDataValue('id');

      if (activeMobileOwner && !belongsToSameDeletedUser) {
        return res.status(400).json({ error: 'A user account with this mobile number already exists.' });
      }
    }

    const [userRole] = await Role.findOrCreate({ where: { name: role } });
    const passwordHash = await bcrypt.hash(password, 10);
    const randomUsername = email.split('@')[0] + Math.floor(Math.random() * 10000);

    let newUser = existingUser;
    if (existingUser && (isReRegisteringDeletedUser || isReusingPartnerUser)) {
      if (isReRegisteringDeletedUser) {
        await existingUser.restore();
      }
      await existingUser.update({
        username: existingUser.getDataValue('username') || randomUsername,
        passwordHash,
        refreshToken: null,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        allowedScreens: existingUser.getDataValue('allowedScreens') || []
      });
    } else {
      newUser = await User.create({
        username: randomUsername,
        email,
        passwordHash
      });
    }

    // @ts-ignore
    await newUser.setRole(userRole);

    if (role === 'Customer') {
      await CustomerProfile.findOrCreate({
        where: { userId: (newUser as any).id },
        defaults: {
          userId: (newUser as any).id,
          displayName: randomUsername,
          phone: normalizedMobile,
          savedVehicles: [],
          savedLocations: [],
          prioritySupportEligible: false
        } as any
      });
      const customerProfile = await CustomerProfile.findOne({ where: { userId: (newUser as any).id } });
      if (customerProfile) {
        await customerProfile.update({
          ...(normalizedMobile ? { phone: normalizedMobile } : {})
        });
      }
    }

    const token = jwt.sign(
      { userId: (newUser as any).id, role: userRole.getDataValue('name') },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: (newUser as any).id, role: userRole.getDataValue('name') },
      JWT_SECRET,
      { expiresIn: getRefreshTokenExpiry(userRole.getDataValue('name')) }
    );

    res.status(201).json({ token, refreshToken, role: userRole.getDataValue('name'), email });
  } catch (error: any) {
    handleControllerError(req, res, error, 'Registration failed');
  }
};

export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { email, action, role = 'Customer', portal } = req.body;
    
    let user = await User.findOne({ 
      where: { email },
      include: [{ model: Role }],
      paranoid: false
    });

    if (!user) {
      if (action === 'login') {
        return res.status(404).json({ error: 'Account not found. Please register first.' });
      }
      
      // Register them
      const [userRole] = await Role.findOrCreate({ where: { name: role } });
      const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(-10), 10); // Random password for google users
      const randomUsername = email.split('@')[0] + Math.floor(Math.random() * 10000);
      
      user = await User.create({
        username: randomUsername,
        email,
        passwordHash,
      });
      // @ts-ignore
      await user.setRole(userRole);
      
      // We need to re-fetch to get the included Role, or manually set it for the token
      (user as any).Role = userRole;
    } else if (user.deletedAt) {
      if (action === 'login') {
        return res.status(404).json({ error: 'Account not found. Please register again.' });
      }

      const [userRole] = await Role.findOrCreate({ where: { name: role } });
      await user.restore();
      // @ts-ignore
      await user.setRole(userRole);
      (user as any).Role = userRole;
    }

    const userRole = await resolveUserRole(user);
    if (!roleMatchesPortal(userRole, portal)) {
      return res.status(403).json({ error: portalErrorMessage(portal) });
    }
    logger.info('google_auth_successful', { requestId: req.requestId, email, role: userRole });
    
    let mechanicId = null;
    if (userRole === 'Mechanic') {
      const mechanic = await Mechanic.findOne({ where: { createdById: user.dataValues.id } });
      if (mechanic) {
        mechanicId = mechanic.dataValues.id;
      }
    }

    const token = jwt.sign(
      { userId: user.dataValues.id, role: userRole },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.dataValues.id, role: userRole },
      JWT_SECRET,
      { expiresIn: getRefreshTokenExpiry(userRole) }
    );

    res.json({ token, refreshToken, role: userRole, email, mechanicId });
  } catch (error: any) {
    handleControllerError(req, res, error, 'Google Auth failed');
  }
};

export const updatePassword = async (req: any, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.getDataValue('passwordHash'));
      if (!isMatch) {
        return res.status(400).json({ error: 'Incorrect current password' });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await user.update({ passwordHash });

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    handleControllerError(req, res, error, 'Failed to update password');
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email, portal } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({
      where: { email: normalizedEmail },
      include: [{ model: Role }],
      paranoid: false
    });

    if (!user || user.getDataValue('deletedAt')) {
      return res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
    }

    const userRole = await resolveUserRole(user);
    if (portal && !roleMatchesPortal(userRole, portal)) {
      return res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await user.update({
      resetPasswordToken: hashedToken,
      resetPasswordExpiresAt: expiresAt
    });

    const appUrl = process.env.FRONTEND_APP_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
    const loginPath = portal === 'PARTNER' ? '/partner/login' : portal === 'ADMIN' ? '/admin/login' : '/customer/login';
    const resetUrl = `${appUrl.replace(/\/$/, '')}${loginPath}?action=reset&email=${encodeURIComponent(normalizedEmail)}&token=${encodeURIComponent(rawToken)}`;
    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    logger.info('password_reset_requested', { requestId: req.requestId, email: normalizedEmail, role: userRole, portal });
    return res.json({ message: 'If an account exists for this email, a reset link has been sent.' });
  } catch (error: any) {
    handleControllerError(req, res, error, 'Failed to request password reset');
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword, portal } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: { email: normalizedEmail },
      include: [{ model: Role }],
      paranoid: false
    });

    if (!user || user.getDataValue('deletedAt')) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const userRole = await resolveUserRole(user);
    if (portal && !roleMatchesPortal(userRole, portal)) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const storedToken = (user as any).resetPasswordToken;
    const storedExpiry = (user as any).resetPasswordExpiresAt;
    if (!storedToken || storedToken !== hashedToken || !storedExpiry || new Date(storedExpiry).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await user.update({
      passwordHash,
      refreshToken: null,
      resetPasswordToken: null,
      resetPasswordExpiresAt: null
    });

    logger.info('password_reset_completed', { requestId: req.requestId, email: normalizedEmail, role: userRole, portal });
    return res.json({ message: 'Password reset successfully' });
  } catch (error: any) {
    handleControllerError(req, res, error, 'Failed to reset password');
  }
};
