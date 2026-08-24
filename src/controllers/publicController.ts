import { Request, Response } from 'express';
import { Op, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Mechanic, Feedback, Donation, ActivityLog, MechanicUpdateRequest, VerificationRequest, User, Role, Otp, CustomerProfile } from '../models';
import { handleControllerError } from '../utils/controller';
import { sendOtpEmail } from '../utils/mail';

const getAvailabilityStatus = (mechanic: any) => {
  if (!mechanic || mechanic.availability === false) return 'Closed';
  if (!Array.isArray(mechanic.operatingDays) || !mechanic.operatingHours) return 'Available';

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = days[new Date().getDay()];
  if (!mechanic.operatingDays.includes(currentDay)) return 'Closed';

  try {
    const [openStr, closeStr] = mechanic.operatingHours.split('-').map((s: string) => s.trim());
    const [openHour, openMinute] = openStr.split(':').map(Number);
    const [closeHour, closeMinute] = closeStr.split(':').map(Number);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes ? 'Available' : 'Closed';
  } catch {
    return 'Available';
  }
};

const parseFilterValues = (value: unknown) => {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const isReusablePartnerUser = async (user: any) => {
  if (!user || user.getDataValue('deletedAt')) return false;

  const roleName = (user as any).Role?.name;
  if (roleName !== 'Mechanic' && roleName !== 'Partner') return false;

  const userId = Number(user.getDataValue('id'));
  if (!userId) return false;

  const linkedMechanic = await Mechanic.findOne({ where: { createdById: userId } });
  if (linkedMechanic) return false;

  const verificationRequests = await VerificationRequest.findAll();
  const hasPendingVerification = verificationRequests.some((request: any) => {
    const submittedUserId = request.submittedData?.__userId;
    return Number(submittedUserId) === userId && String(request.status || '').toLowerCase() === 'pending';
  });

  return !hasPendingVerification;
};

export const getMechanics = async (req: Request, res: Response) => {
  try {
    const { vehicleType, serviceType, vehicle, service, search, lat, lng, radius, limit, page, sort, availability, trustedOnly } = req.query;
    
    let mechanics;
    
    if (lat && lng) {
      const parsedLat = parseFloat(lat as string);
      const parsedLng = parseFloat(lng as string);
      const parsedRadius = radius ? parseFloat(radius as string) : 50;

      const haversine = `(
        6371 * acos(
          cos(radians(${parsedLat})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${parsedLng})) +
          sin(radians(${parsedLat})) * sin(radians(latitude))
        )
      )`;

      let whereClause: any = { status: 'Approved' };
      if (!search || (typeof search === 'string' && search.trim() === '')) {
        whereClause[Op.and] = Sequelize.literal(`${haversine} <= ${parsedRadius}`);
      }

      mechanics = await Mechanic.findAll({
        where: whereClause,
        attributes: {
          include: [
            [Sequelize.literal(haversine), 'dist'],
            [Sequelize.literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "Reviews" WHERE "Reviews"."mechanicId" = "Mechanic"."id" AND "Reviews"."status" = 'Approved')`), 'reviewCount']
          ]
        },
        order: [[Sequelize.literal('dist'), 'ASC']]
      });
    } else {
      mechanics = await Mechanic.findAll({
        where: { status: 'Approved' },
        attributes: {
          include: [
            [Sequelize.literal(`(SELECT CAST(COUNT(*) AS INTEGER) FROM "Reviews" WHERE "Reviews"."mechanicId" = "Mechanic"."id" AND "Reviews"."status" = 'Approved')`), 'reviewCount']
          ]
        }
      });
    }
    
    let filtered = mechanics.map(m => m.get({ plain: true }));

    const vehicleFilters = parseFilterValues((vehicle as string) || (vehicleType as string));
    const serviceFilters = parseFilterValues((service as string) || (serviceType as string));

    if (vehicleFilters.length > 0) {
      filtered = filtered.filter((mechanic) =>
        Array.isArray(mechanic.vehicleTypes) && vehicleFilters.some((item) => mechanic.vehicleTypes.includes(item))
      );
    }
    
    if (serviceFilters.length > 0) {
      filtered = filtered.filter((mechanic) =>
        Array.isArray(mechanic.serviceTypes) && serviceFilters.some((item) => mechanic.serviceTypes.includes(item))
      );
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter((mechanic) => {
        const haystack = [
          mechanic.businessName,
          mechanic.name,
          mechanic.area,
          mechanic.city,
          mechanic.landmark,
          mechanic.address,
          ...(Array.isArray(mechanic.serviceTypes) ? mechanic.serviceTypes : []),
          ...(Array.isArray(mechanic.vehicleTypes) ? mechanic.vehicleTypes : [])
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(term);
      });
    }

    let processed = filtered.map((mechanic) => ({
      ...mechanic,
      currentStatus: getAvailabilityStatus(mechanic)
    }));

    if (availability === 'Available') {
      processed = processed.filter(m => m.currentStatus === 'Available');
    } else if (availability === 'Not Available') {
      processed = processed.filter(m => m.currentStatus !== 'Available');
    }

    if (trustedOnly === 'true') {
      processed = processed.filter((mechanic) => Boolean(mechanic.isTrustedPartner));
    }

    if (sort === 'Available') {
      processed.sort((a, b) => {
        if (a.currentStatus === 'Available' && b.currentStatus !== 'Available') return -1;
        if (a.currentStatus !== 'Available' && b.currentStatus === 'Available') return 1;
        return 0; // Distance sort is preserved from DB
      });
    }

    const parsedLimit = limit ? parseInt(limit as string, 10) : 50;
    const parsedPage = page ? parseInt(page as string, 10) : 1;
    const offset = (parsedPage - 1) * parsedLimit;
    
    const paginated = processed.slice(offset, offset + parsedLimit);

    res.setHeader('X-Total-Count', processed.length.toString());
    res.json(paginated);
  } catch (error: any) {
    handleControllerError(req, res, error, 'Failed to fetch mechanics');
  }
};

export const getRoute = async (req: Request, res: Response) => {
  try {
    const { startLat, startLng, endLat, endLng, routeOption = 'Fastest' } = req.body;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
    const response = await fetch(osrmUrl);

    if (!response.ok) {
      return res.status(502).json({ error: 'Route provider unavailable', requestId: req.requestId });
    }

    const data = await response.json() as { routes?: Array<{ distance: number; duration: number; geometry: { coordinates: number[][] } }> };
    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: 'No route found', requestId: req.requestId });
    }

    let bestRoute = data.routes[0];
    if (routeOption === 'Shortest') {
      bestRoute = data.routes.reduce((prev, curr) => prev.distance < curr.distance ? prev : curr);
    } else {
      bestRoute = data.routes.reduce((prev, curr) => prev.duration < curr.duration ? prev : curr);
    }

    res.json({
      distanceKm: Number((bestRoute.distance / 1000).toFixed(1)),
      durationMinutes: Math.round(bestRoute.duration / 60),
      routeCoords: bestRoute.geometry.coordinates.map((coord) => [coord[1], coord[0]])
    });
  } catch (error: any) {
    console.error('getRoute Error:', error);
    if (error.cause?.code === 'ECONNREFUSED' || error.name === 'TypeError') {
      return res.status(502).json({ error: 'Routing service is temporarily unavailable. Please try again later.', requestId: req.requestId });
    }
    handleControllerError(req, res, error, 'Failed to fetch route');
  }
};

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { type, description } = req.body;

    const feedback = await Feedback.create({ type, description });
    res.status(201).json({ message: 'Feedback submitted successfully', feedback });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to submit feedback');
  }
};

export const submitDonation = async (req: Request, res: Response) => {
  try {
    const { amount, paymentReference, name, email, consentGiven } = req.body;

    const donation = await Donation.create({ amount, paymentReference, name, email, consentGiven });
    res.status(201).json({ message: 'Donation recorded successfully', donation });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to record donation');
  }
};

export const submitMechanicRegistration = async (req: Request, res: Response) => {
  try {
    const { existingMechanicId, ...mechanicData } = req.body;
    const normalizedData = {
      ...mechanicData,
      name: mechanicData.businessName || mechanicData.name
    };

    if (existingMechanicId) {
      const mechanic = await Mechanic.findByPk(existingMechanicId);
      if (!mechanic) {
        return res.status(404).json({ error: 'Mechanic not found', requestId: req.requestId });
      }

      const request = await MechanicUpdateRequest.create({
        mechanicId: existingMechanicId,
        updatedData: normalizedData,
        status: 'Pending Update Approval',
        requestedById: null
      });

      await ActivityLog.create({
        userId: null,
        action: 'Public Mechanic Update Request',
        details: `Public update request submitted for mechanic ID ${existingMechanicId}.`
      });

      return res.status(201).json({
        message: 'Update request submitted for Super Admin review',
        request
      });
    }

    const request = await MechanicUpdateRequest.create({
      mechanicId: null,
      updatedData: normalizedData,
      status: 'Pending Update Approval',
      requestedById: null
    });

    await ActivityLog.create({
      userId: null,
      action: 'Public Mechanic Registration Request',
      details: `Public new mechanic request submitted for ${normalizedData.businessName || normalizedData.name}.`
    });

    return res.status(201).json({
      message: 'Mechanic request submitted for Super Admin review',
      request
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to submit mechanic request');
  }
};

export const getMechanicById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Also allow finding by ID even if it's not Approved yet if the user is the creator or it's a pending request.
    // For now, we remove status: 'Approved' because a mechanic might be 'Pending' and the user is verifying it.
    const mechanic = await Mechanic.findOne({
      where: { id },
    });

    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found', requestId: req.requestId });
    }

    const responseData = mechanic.toJSON();

    // Check for auth token to find any pending verification request
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, 'supersecret_mvp_key_change_me_in_prod') as any;
        if (decoded && decoded.userId) {
          // Find pending verification request for this user and mechanic
          // We look for a VerificationRequest where submittedData.__userId == decoded.userId
          const verification = await VerificationRequest.findOne({
            where: { mechanicId: id },
            order: [['createdAt', 'DESC']]
          });
          
          if (verification && verification.submittedData && (!verification.submittedData.__userId || verification.submittedData.__userId === decoded.userId)) {
            responseData.pendingVerification = verification;
          }
        }
      } catch (err) {
        // Ignore token errors for public route
      }
    }

    return res.json(responseData);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic by ID');
  }
};

export const submitVerification = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { submittedData, mechanicDetails, accountInfo } = req.body;

    const mechanic = await Mechanic.findByPk(id);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found', requestId: req.requestId });
    }

    let newUserId: number | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = require('jsonwebtoken').verify(token, 'supersecret_mvp_key_change_me_in_prod') as any;
        if (decoded && decoded.userId) {
          newUserId = decoded.userId;
        }
      } catch (err) {}
    }

    if (!newUserId && accountInfo && accountInfo.email && accountInfo.password) {
        const existingUser = await User.findOne({ where: { email: accountInfo.email } });
      if (existingUser) {
        newUserId = (existingUser as any).id;
      }
    }

    let verification = await VerificationRequest.findOne({
      where: { mechanicId: parseInt(id), status: 'Pending' },
      order: [['createdAt', 'DESC']]
    });

    const newSubmittedData = {
      ...(submittedData || {}),
      __mechanicDetails: mechanicDetails,
      __userId: newUserId
    };

    if (verification) {
      verification = await verification.update({
        submittedData: newSubmittedData
      });
    } else {
      verification = await VerificationRequest.create({
        mechanicId: parseInt(id),
        submittedData: newSubmittedData,
        status: 'Pending'
      });
    }

    await ActivityLog.create({
      userId: null,
      action: 'Verification Request Submitted',
      details: `Verification request submitted for mechanic ID ${id}.`
    });

    return res.status(201).json({
      message: 'Verification request submitted successfully',
      verification
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to submit verification request');
  }
};

export const checkEmail = async (req: Request, res: Response) => {
  try {
    const { email, mobile, mechanicId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (mechanicId) {
      const mechanic = await Mechanic.findByPk(mechanicId);
      if (mechanic && mechanic.emails && Array.isArray(mechanic.emails) && mechanic.emails.length > 0) {
        if (!mechanic.emails.includes(email)) {
          return res.status(400).json({ error: 'This mechanic account has already been verified. Please log in to continue.' });
        }
      }
    }

    const allMechanics = await Mechanic.findAll({ attributes: ['id', 'emails'] });
    const emailUsedByAnother = allMechanics.find(m => 
      (!mechanicId || m.id !== parseInt(mechanicId)) && 
      m.emails && Array.isArray(m.emails) && 
      m.emails.includes(email)
    );

    if (emailUsedByAnother) {
      return res.status(400).json({ error: 'This email is already associated with another mechanic profile.' });
    }
    const normalizedMobile = typeof mobile === 'string' ? mobile.replace(/\D/g, '').slice(-10) : '';

    const user = await User.findOne({ where: { email }, paranoid: false, include: [{ model: Role, attributes: ['name'] }] as any });
    const mobileProfile = normalizedMobile
      ? await CustomerProfile.findOne({
          where: { phone: normalizedMobile },
          include: [{ model: User, paranoid: false, attributes: ['id', 'deletedAt'] }] as any
        })
      : null;
    const reusablePartnerUser = await isReusablePartnerUser(user);
    const activeUser = user && !user.getDataValue('deletedAt') && !reusablePartnerUser;
    const activeMobileProfile = mobileProfile && !(mobileProfile as any).User?.deletedAt;
    const existingRole = activeUser ? ((user as any).Role?.name || null) : null;

    return res.json({
      exists: !!activeUser,
      mobileExists: !!activeMobileProfile,
      duplicateField: activeUser ? 'email' : activeMobileProfile ? 'mobile' : null,
      existingRole
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to check email');
  }
};

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { email, mechanicId } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    if (mechanicId) {
      const mechanic = await Mechanic.findByPk(mechanicId);
      if (mechanic && mechanic.emails && Array.isArray(mechanic.emails) && mechanic.emails.length > 0) {
        if (!mechanic.emails.includes(email)) {
          return res.status(400).json({ error: 'This mechanic account has already been verified. Please log in to continue.' });
        }
      }
    }

    const allMechanics = await Mechanic.findAll({ attributes: ['id', 'emails'] });
    const emailUsedByAnother = allMechanics.find(m => 
      (!mechanicId || m.id !== parseInt(mechanicId)) && 
      m.emails && Array.isArray(m.emails) && 
      m.emails.includes(email)
    );

    if (emailUsedByAnother) {
      return res.status(400).json({ error: 'This email is already associated with another mechanic profile.' });
    }

    // Generate a 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 1 hour from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    console.log('OTP Code:', code);

    // Invalidate any existing OTPs for this email
    await Otp.destroy({
      where: { email }
    });

    // Save to database
    await Otp.create({
      email,
      code,
      expiresAt
    });

    // Send email using Resend
    await sendOtpEmail(email, code);

    return res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to send OTP');
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // Find the latest unexpired OTP for this email
    const otpRecord = await Otp.findOne({
      where: {
        email,
        code,
        expiresAt: {
          [Op.gt]: new Date()
        }
      },
      order: [['createdAt', 'DESC']]
    });

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // OTP is valid, delete it so it can't be reused
    await otpRecord.destroy();

    return res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to verify OTP');
  }
};



export const setupAccount = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existingUser = await User.findOne({ where: { email }, paranoid: false });
    if (existingUser) {
      if (existingUser.deletedAt) {
        // User was soft-deleted, restore and update password
        await existingUser.restore();
        existingUser.passwordHash = await bcrypt.hash(password, 10);
        await existingUser.save();
        
        const [role] = await Role.findOrCreate({ where: { name: 'Mechanic' } });
        // @ts-ignore
        await existingUser.setRole(role);
        
        return res.status(200).json({ message: 'Account restored and created', userId: (existingUser as any).id });
      }
      return res.status(400).json({ error: 'A user account with this email already exists.' });
    }

    const [role] = await Role.findOrCreate({ where: { name: 'Mechanic' } });
    const passwordHash = await bcrypt.hash(password, 10);
    const randomUsername = email.split('@')[0] + Math.floor(Math.random() * 10000);
    
    const newUser = await User.create({
      username: randomUsername,
      email,
      passwordHash,
    });
    // @ts-ignore
    await newUser.setRole(role);

    return res.status(201).json({ message: 'Account created', userId: (newUser as any).id });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to setup account');
  }
};

export const updateVerification = async (req: Request, res: Response) => {
  try {
    const { id, verificationId } = req.params;
    const { submittedData, mechanicDetails, isFinalSubmit } = req.body;

    const verification = await VerificationRequest.findOne({
      where: {
        id: verificationId,
        mechanicId: id
      }
    });

    if (!verification) {
      return res.status(404).json({ error: 'Verification request not found', requestId: req.requestId });
    }

    const updatedData = { ...verification.submittedData };
    
    if (submittedData) {
      Object.assign(updatedData, submittedData);
    }
    
    if (mechanicDetails) {
      updatedData.__mechanicDetails = mechanicDetails;
    }

    verification.submittedData = updatedData;
    
    if (isFinalSubmit || verification.status === 'Rejected') {
      verification.status = 'Pending';
    }

    // Tell Sequelize that the JSON field has changed
    verification.changed('submittedData', true);
    await verification.save();

    if (isFinalSubmit) {
      await ActivityLog.create({
        userId: null,
        action: 'Verification Request Finalized',
        details: `Verification request finalized for mechanic ID ${id}.`
      });
    }

    return res.json({
      message: isFinalSubmit ? 'Verification request finalized successfully' : 'Verification request updated successfully',
      verification
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update verification request');
  }
};
