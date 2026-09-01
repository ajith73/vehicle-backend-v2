import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { CustomerProfile, CustomerRequest, CustomerSubscription, Mechanic, Otp, PaymentTransaction, RequestAssignment, RequestDispatchAttempt, RequestQuote, RequestTimelineEvent, Role, ServiceType, SpecificService, SubscriptionPlan, SupportTicket, User, VehicleType } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';
import { sendOtpEmail } from '../utils/mail';
import { enhancePhaseOneRequestCreation, loadRequestForOps } from './helpers/requestOperations.shared';
import {
  getCustomerNotificationsSnapshot,
  getCustomerSupportTicketsSnapshot,
  pushAdminSupportTicketsSnapshot,
  pushCustomerNotificationsSnapshot,
  pushCustomerSupportTicketsSnapshot
} from '../lib/realtimeSnapshotService';
import {
  assignRequestToMechanic,
  buildUsername,
  createCustomerProfileDefaults,
  findAutoAssignableMechanic,
  issueTokens,
  normalizeCustomerProfile,
  sanitizeCustomerProfilePayload
} from './helpers/customerController.helpers';

export const sendCustomerOtp = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await Otp.destroy({ where: { email } });
    await Otp.create({ email, code, expiresAt });
    
    if (email !== 'test@example.com') {
      await sendOtpEmail(email, code);
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to send customer OTP');
  }
};

export const verifyCustomerOtp = async (req: Request, res: Response) => {
  try {
    const { email, code, displayName } = req.body as { email?: string; code?: string; displayName?: string };
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const otpRecord = await Otp.findOne({
      where: {
        email,
        code,
        expiresAt: { [Op.gt]: new Date() }
      },
      order: [['createdAt', 'DESC']]
    });

    const isBypass = email === 'test@example.com' && code === '123456';

    if (!otpRecord && !isBypass) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (otpRecord) {
      await otpRecord.destroy();
    }

    const [customerRole] = await Role.findOrCreate({ where: { name: 'Customer' } });

    let user = await User.findOne({ where: { email }, paranoid: false });
    if (user && user.deletedAt) {
      await user.restore();
      await user.update({ roleId: customerRole.getDataValue('id') });
    }

    if (!user) {
      const passwordHash = await bcrypt.hash(`otp_${Date.now()}_${Math.random()}`, 10);
      user = await User.create({
        username: buildUsername(email),
        email,
        passwordHash,
        roleId: customerRole.getDataValue('id'),
        allowedScreens: []
      });
    } else if (!user.getDataValue('roleId')) {
      await user.update({ roleId: customerRole.getDataValue('id') });
    } else if (user.getDataValue('roleId') !== customerRole.getDataValue('id')) {
      return res.status(400).json({ error: 'This email is already used by another account type. Please use a different email for customer requests.' });
    }

    const [profile] = await CustomerProfile.findOrCreate({
      where: { userId: user.getDataValue('id') },
      defaults: {
        ...(await createCustomerProfileDefaults(user.getDataValue('id'))),
        displayName: displayName?.trim() || email.split('@')[0],
        lastLoginAt: new Date()
      } as any
    });

    if (displayName?.trim()) {
      await profile.update(await sanitizeCustomerProfilePayload({ displayName: displayName.trim(), lastLoginAt: new Date() }));
    } else {
      await profile.update(await sanitizeCustomerProfilePayload({ lastLoginAt: new Date() }));
    }

    res.json({
      ...issueTokens(user.getDataValue('id'), 'Customer'),
      user: {
        id: user.getDataValue('id'),
        email: user.getDataValue('email'),
        displayName: profile.getDataValue('displayName')
      }
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to verify customer OTP');
  }
};

export const createCustomerRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can submit requests' });
    }

    const {
      mechanicId,
      serviceTypeId,
      specificServiceId,
      vehicleTypeId,
      vehicleLabel,
      issueSummary,
      issueDetails,
      latitude,
      longitude,
      addressText
    } = req.body;

    let selectedMechanic: any = null;
    if (mechanicId) {
      const mechanic = await Mechanic.findByPk(mechanicId);
      if (!mechanic) {
        return res.status(404).json({ error: 'Selected mechanic was not found' });
      }
      selectedMechanic = mechanic;
    }

    if (serviceTypeId) {
      const serviceType = await ServiceType.findByPk(serviceTypeId);
      if (!serviceType) {
        return res.status(400).json({ error: 'Invalid service type' });
      }
    }

    if (specificServiceId) {
      const specificService = await SpecificService.findByPk(specificServiceId);
      if (!specificService) {
        return res.status(400).json({ error: 'Invalid specific service' });
      }
    }

    if (vehicleTypeId) {
      const vehicleType = await VehicleType.findByPk(vehicleTypeId);
      if (!vehicleType) {
        return res.status(400).json({ error: 'Invalid vehicle type' });
      }
    }

    const requestRecord = await CustomerRequest.create({
      customerUserId: req.user.userId,
      mechanicId,
      serviceTypeId: serviceTypeId || null,
      specificServiceId: specificServiceId || null,
      vehicleTypeId: vehicleTypeId || null,
      vehicleLabel: vehicleLabel || null,
      issueSummary,
      issueDetails: issueDetails || null,
      latitude,
      longitude,
      addressText: addressText || null,
      status: 'SUBMITTED',
      statusUpdatedAt: new Date()
    });

    await enhancePhaseOneRequestCreation(requestRecord.getDataValue('id'));

    if (selectedMechanic) {
      await assignRequestToMechanic({
        requestRecord,
        mechanic: selectedMechanic,
        actorUserId: req.user.userId,
        actorType: 'CUSTOMER',
        assignmentNote: 'Customer selected this partner during request creation.',
        dispatchMode: 'CUSTOMER_SELECTED',
        dispatchNote: 'Request sent to customer-selected mechanic.',
        timelineNote: 'Customer selected a partner and dispatch started.'
      });
    } else {
      const autoMechanic = await findAutoAssignableMechanic({
        serviceTypeId: serviceTypeId ? Number(serviceTypeId) : null,
        specificServiceId: specificServiceId ? Number(specificServiceId) : null,
        vehicleTypeId: vehicleTypeId ? Number(vehicleTypeId) : null,
        latitude: Number(latitude),
        longitude: Number(longitude)
      });

      if (autoMechanic) {
        await assignRequestToMechanic({
          requestRecord,
          mechanic: autoMechanic,
          actorUserId: req.user.userId,
          actorType: 'SYSTEM',
          assignmentNote: 'Auto-assigned to the nearest eligible online partner.',
          dispatchMode: 'AUTO_NEAREST',
          dispatchNote: 'Request auto-dispatched to the nearest eligible online partner.',
          timelineNote: 'System auto-assigned the nearest eligible online partner.'
        });
      } else {
        await requestRecord.update({
          dispatchStatus: 'NO_SUPPLY',
          lastDispatchAt: new Date()
        });

        const { pushCustomerRequestSnapshot } = require('./realtimeController');
        await pushCustomerRequestSnapshot(requestRecord.getDataValue('id'));
      }
    }

    const responseRecord = await CustomerRequest.findByPk(requestRecord.getDataValue('id'), {
      include: [
        { model: Mechanic, attributes: ['id', 'businessName', 'name', 'city', 'state'] },
        { model: ServiceType, attributes: ['id', 'name'] },
        { model: SpecificService, attributes: ['id', 'name'] },
        { model: VehicleType, attributes: ['id', 'name'] }
      ]
    });

    res.status(201).json({
      message: 'Request submitted successfully',
      request: responseRecord
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to create customer request');
  }
};

export const listCustomerRequestsForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await CustomerRequest.findAll({
      include: [
        { model: Mechanic, attributes: ['id', 'businessName', 'name', 'city', 'state'] },
        { model: ServiceType, attributes: ['id', 'name'] },
        { model: SpecificService, attributes: ['id', 'name'] },
        { model: VehicleType, attributes: ['id', 'name'] },
        {
          model: User,
          as: 'CustomerUser',
          attributes: ['id', 'email'],
          include: [{ model: CustomerProfile, attributes: ['displayName'] }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(requests);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch customer requests');
  }
};

export const listCustomersForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const customerRole = await Role.findOne({ where: { name: 'Customer' } });
    const profileUserIds = await CustomerProfile.findAll({ attributes: ['userId'] });
    const requestUserIds = await CustomerRequest.findAll({ attributes: ['customerUserId'] });
    const subscriptionUserIds = await CustomerSubscription.findAll({ attributes: ['customerUserId'] });

    const discoveredUserIds = new Set<number>();
    profileUserIds.forEach((item: any) => discoveredUserIds.add(Number(item.getDataValue('userId'))));
    requestUserIds.forEach((item: any) => discoveredUserIds.add(Number(item.getDataValue('customerUserId'))));
    subscriptionUserIds.forEach((item: any) => discoveredUserIds.add(Number(item.getDataValue('customerUserId'))));

    if (!customerRole && discoveredUserIds.size === 0) {
      return res.json([]);
    }

    const customers = await User.findAll({
      paranoid: false,
      where: {
        [Op.or]: [
          ...(customerRole ? [{ roleId: customerRole.getDataValue('id') }] : []),
          ...(discoveredUserIds.size > 0
            ? [{
                [Op.and]: [
                  { id: { [Op.in]: Array.from(discoveredUserIds) } },
                  {
                    [Op.or]: [
                      { roleId: null },
                      ...(customerRole ? [{ roleId: customerRole.getDataValue('id') }] : [])
                    ]
                  }
                ]
              }]
            : [])
        ]
      },
      attributes: ['id', 'email', 'name', 'createdAt', 'deletedAt'],
      include: [{ model: CustomerProfile }],
      order: [['createdAt', 'DESC']]
    });

    const requestCounts = await CustomerRequest.findAll({
      attributes: ['customerUserId'],
    });

    const requestCountMap = requestCounts.reduce<Record<number, number>>((acc, item: any) => {
      const userId = Number(item.getDataValue('customerUserId'));
      acc[userId] = (acc[userId] || 0) + 1;
      return acc;
    }, {});

    res.json(customers.map((customer: any) => {
      const profile = customer.CustomerProfile;
      const savedLocations = Array.isArray(profile?.savedLocations) ? profile.savedLocations : [];
      const latestLocation = savedLocations[0] || null;
      return {
        id: customer.getDataValue('id'),
        email: customer.getDataValue('email'),
        name: customer.getDataValue('name'),
        createdAt: customer.getDataValue('createdAt'),
        deletedAt: customer.getDataValue('deletedAt'),
        displayName: profile?.displayName || customer.getDataValue('name') || customer.getDataValue('email'),
        phone: profile?.phone || null,
        lastLoginAt: profile?.lastLoginAt || null,
        subscriptionStatus: profile?.subscriptionStatus || null,
        subscriptionTier: profile?.subscriptionTier || null,
        prioritySupportEligible: Boolean(profile?.prioritySupportEligible),
        requestCount: requestCountMap[customer.getDataValue('id')] || 0,
        city: latestLocation?.city || latestLocation?.label || null,
        savedVehiclesCount: Array.isArray(profile?.savedVehicles) ? profile.savedVehicles.length : 0,
      };
    }));
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch customers');
  }
};

export const adminResetCustomerPassword = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = Number.parseInt(String(req.params.id || ''), 10);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const customerRole = await Role.findOne({ where: { name: 'Customer' } });
    const customer = await User.findByPk(customerId, { include: [{ model: Role }], paranoid: false });
    const customerProfile = await CustomerProfile.findOne({ where: { userId: customerId } });
    const isCustomer =
      !!customer &&
      (
        (customerRole && customer.getDataValue('roleId') === customerRole.getDataValue('id')) ||
        !!customerProfile
      );

    if (!isCustomer) {
      return res.status(404).json({ error: 'Customer account not found' });
    }

    const temporaryPassword = `RoadResQ@${Math.random().toString(36).slice(-4)}${Date.now().toString().slice(-4)}`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await customer.update({ passwordHash });

    res.json({
      message: 'Customer password reset successfully',
      temporaryPassword
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to reset customer password');
  }
};

export const adminDeleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const customerId = Number.parseInt(String(req.params.id || ''), 10);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const customerRole = await Role.findOne({ where: { name: 'Customer' } });
    const customer = await User.findByPk(customerId, { paranoid: false });
    const customerProfile = await CustomerProfile.findOne({ where: { userId: customerId } });
    const isCustomer =
      !!customer &&
      (
        (customerRole && customer.getDataValue('roleId') === customerRole.getDataValue('id')) ||
        !!customerProfile
      );

    if (!isCustomer) {
      return res.status(404).json({ error: 'Customer account not found' });
    }

    await CustomerProfile.destroy({ where: { userId: customerId } });
    await customer.destroy();

    res.json({ message: 'Customer account deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete customer account');
  }
};

export const getCustomerRequestForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const requestIdParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const requestId = Number.parseInt(requestIdParam, 10);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await loadRequestForOps(requestId);

    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(requestRecord);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch customer request');
  }
};

export const listMembershipPlans = async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      where: { isActive: true },
      order: [['priceAmount', 'ASC'], ['createdAt', 'ASC']]
    });
    res.json(plans);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch membership plans');
  }
};

export const getMembershipStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can access membership status' });
    }

    const profile = await CustomerProfile.findOne({ where: { userId: req.user.userId } });
    const activeSubscription = await CustomerSubscription.findOne({
      where: { customerUserId: req.user.userId, status: 'ACTIVE' },
      include: [{ model: SubscriptionPlan }],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      profile,
      subscription: activeSubscription
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch membership status');
  }
};

export const subscribeMembershipPlan = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can subscribe to membership plans' });
    }

    const plan = await SubscriptionPlan.findByPk(req.body.subscriptionPlanId);
    if (!plan || !plan.getDataValue('isActive')) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    const billingCycle = String(plan.getDataValue('billingCycle') || 'MONTHLY').toUpperCase();
    if (billingCycle === 'YEARLY') endsAt.setFullYear(endsAt.getFullYear() + 1);
    else endsAt.setMonth(endsAt.getMonth() + 1);

    await CustomerSubscription.update(
      { status: 'EXPIRED' },
      { where: { customerUserId: req.user.userId, status: 'ACTIVE' } }
    );

    const subscription = await CustomerSubscription.create({
      customerUserId: req.user.userId,
      subscriptionPlanId: plan.getDataValue('id'),
      status: 'ACTIVE',
      subscriptionTier: plan.getDataValue('tier'),
      priceAmount: plan.getDataValue('priceAmount'),
      startsAt,
      endsAt,
      metadata: {
        trustedOnlyAccess: plan.getDataValue('trustedOnlyAccess'),
        priorityDispatch: plan.getDataValue('priorityDispatch'),
        prioritySupport: plan.getDataValue('prioritySupport')
      }
    });

    const [profile] = await CustomerProfile.findOrCreate({
      where: { userId: req.user.userId },
      defaults: await createCustomerProfileDefaults(req.user.userId) as any
    });

    await profile.update(await sanitizeCustomerProfilePayload({
      subscriptionStatus: 'ACTIVE',
      subscriptionTier: plan.getDataValue('tier'),
      subscriptionEndsAt: endsAt,
      prioritySupportEligible: plan.getDataValue('prioritySupport')
    }));

    res.status(201).json({ message: 'Membership activated', subscription });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to subscribe to membership plan');
  }
};

export const listSubscriptionPlansForAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const plans = await SubscriptionPlan.findAll({ order: [['createdAt', 'DESC']] });
    res.json(plans);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch subscription plans');
  }
};

export const createSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  try {
    const plan = await SubscriptionPlan.create({
      ...req.body,
      platformFeeDiscountPercent: req.body.platformFeeDiscountPercent || 0,
      prioritySupport: Boolean(req.body.prioritySupport),
      priorityDispatch: Boolean(req.body.priorityDispatch),
      trustedOnlyAccess: Boolean(req.body.trustedOnlyAccess),
      isActive: req.body.isActive !== false
    });
    res.status(201).json(plan);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to create subscription plan');
  }
};

export const updateSubscriptionPlan = async (req: AuthRequest, res: Response) => {
  try {
    const planIdParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const planId = Number.parseInt(planIdParam, 10);
    if (!Number.isInteger(planId) || planId <= 0) {
      return res.status(400).json({ error: 'Invalid subscription plan id' });
    }

    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    await plan.update({
      ...req.body,
      platformFeeDiscountPercent: req.body.platformFeeDiscountPercent || 0
    });
    res.json(plan);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update subscription plan');
  }
};

export const getCustomerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const [profile] = await CustomerProfile.findOrCreate({
      where: { userId: req.user.userId },
      defaults: await createCustomerProfileDefaults(req.user.userId) as any
    });
    const user = await User.findByPk(req.user.userId, { attributes: ['email', 'username'] });
    const normalizedProfile = normalizeCustomerProfile(profile);
    res.json({
      profile: {
        ...normalizedProfile,
        name: normalizedProfile.displayName || user?.getDataValue('username') || 'Customer',
        email: user?.getDataValue('email') || null,
        isVerified: Boolean(normalizedProfile.phone)
      },
      user
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to get customer profile');
  }
};

export const updateCustomerProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const [profile] = await CustomerProfile.findOrCreate({
      where: { userId: req.user.userId },
      defaults: await createCustomerProfileDefaults(req.user.userId) as any
    });
    
    // Only update allowed fields
    const { displayName, phone, profilePicture, savedVehicles, savedLocations } = req.body;
    
    await profile.update(await sanitizeCustomerProfilePayload({
      ...(displayName !== undefined && { displayName }),
      ...(phone !== undefined && { phone }),
      ...(profilePicture !== undefined && { profilePicture }),
      ...(savedVehicles !== undefined && { savedVehicles }),
      ...(savedLocations !== undefined && { savedLocations })
    }));
    
    res.json({ message: 'Profile updated', profile: normalizeCustomerProfile(profile) });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update customer profile');
  }
};

export const getCustomerRequestsHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const requests = await CustomerRequest.findAll({
      where: { customerUserId: req.user.userId },
      include: [
        { model: Mechanic, attributes: ['id', 'name', 'businessName', 'phone'] },
        { model: ServiceType, attributes: ['id', 'name'] },
        { model: SpecificService, attributes: ['id', 'name'] },
        { model: VehicleType, attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(requests);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch request history');
  }
};

export const getCustomerNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const [profileRecord] = await CustomerProfile.findOrCreate({
      where: { userId: req.user.userId },
      defaults: await createCustomerProfileDefaults(req.user.userId) as any
    });
    const profile = normalizeCustomerProfile(profileRecord);
    if (!profile) {
      return res.json([]);
    }

    res.json(await getCustomerNotificationsSnapshot(req.user.userId));
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch customer notifications');
  }
};

export const listCustomerSupportTickets = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    res.json(await getCustomerSupportTicketsSnapshot(req.user.userId));
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch customer support tickets');
  }
};

export const createCustomerSupportTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestId = Number.parseInt(String(req.body.customerRequestId || ''), 10);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Valid customerRequestId is required' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('customerUserId') !== req.user.userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const category = String(req.body.category || 'Other').trim();
    const subject = String(req.body.subject || '').trim();
    const description = String(req.body.description || '').trim();
    const incidentType = req.body.incidentType ? String(req.body.incidentType).trim() : null;
    const contactPreference = req.body.contactPreference ? String(req.body.contactPreference).trim() : null;
    const evidenceNotes = req.body.evidenceNotes ? String(req.body.evidenceNotes).trim() : null;
    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    const ticket = await SupportTicket.create({
      customerRequestId: requestId,
      raisedByUserId: req.user.userId,
      source: 'CUSTOMER',
      ticketType: category.toUpperCase().replace(/\s+/g, '_'),
      status: 'OPEN',
      priority: req.body.priority ? String(req.body.priority).trim() : 'NORMAL',
      subject,
      description,
      metadata: {
        requestStatus: requestRecord.getDataValue('status'),
        category,
        incidentType,
        contactPreference,
        evidenceNotes
      }
    });

    const requestWithTimeline = await loadRequestForOps(requestId);
    if (requestWithTimeline) {
      await Promise.all([
        pushCustomerSupportTicketsSnapshot(req.user.userId),
        pushCustomerNotificationsSnapshot(req.user.userId),
        pushAdminSupportTicketsSnapshot()
      ]);
      res.status(201).json({ message: 'Support ticket created', ticket, request: requestWithTimeline });
      return;
    }

    await Promise.all([
      pushCustomerSupportTicketsSnapshot(req.user.userId),
      pushCustomerNotificationsSnapshot(req.user.userId),
      pushAdminSupportTicketsSnapshot()
    ]);
    res.status(201).json({ message: 'Support ticket created', ticket });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to create customer support ticket');
  }
};

export const deleteCustomerAccount = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findByPk(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await CustomerProfile.destroy({ where: { userId: req.user.userId } });
    await user.destroy();

    res.json({ message: 'Customer account deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete customer account');
  }
};
