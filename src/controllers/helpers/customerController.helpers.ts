import jwt from 'jsonwebtoken';
import {
  Mechanic,
  RequestAssignment,
  RequestDispatchAttempt,
  RequestTimelineEvent,
  ServiceType,
  SpecificService,
  VehicleType,
  sequelize
} from '../../models';
import { calculateDistanceKm, estimateEtaMinutes } from './requestOperations.shared';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_mvp_key_change_me_in_prod';

let customerProfileColumnsCache: Set<string> | null = null;

export const getCustomerProfileColumns = async () => {
  if (customerProfileColumnsCache) {
    return customerProfileColumnsCache;
  }

  const tableDescription = await sequelize.getQueryInterface().describeTable('CustomerProfiles');
  customerProfileColumnsCache = new Set(Object.keys(tableDescription));
  return customerProfileColumnsCache;
};

export const createCustomerProfileDefaults = async (userId: number) => {
  const columns = await getCustomerProfileColumns();
  const defaults: Record<string, unknown> = { userId };

  if (columns.has('displayName')) defaults.displayName = null;
  if (columns.has('phone')) defaults.phone = null;
  if (columns.has('lastLoginAt')) defaults.lastLoginAt = null;
  if (columns.has('profilePicture')) defaults.profilePicture = null;
  if (columns.has('savedVehicles')) defaults.savedVehicles = [];
  if (columns.has('savedLocations')) defaults.savedLocations = [];
  if (columns.has('prioritySupportEligible')) defaults.prioritySupportEligible = false;

  return defaults;
};

export const sanitizeCustomerProfilePayload = async (payload: Record<string, unknown>) => {
  const columns = await getCustomerProfileColumns();
  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => columns.has(key) && value !== undefined)
  );
};

export const normalizeCustomerProfile = (profile: any) => {
  if (!profile) {
    return {
      displayName: null,
      phone: null,
      profilePicture: null,
      savedVehicles: [],
      savedLocations: [],
      subscriptionStatus: null,
      subscriptionTier: null,
      subscriptionEndsAt: null,
      prioritySupportEligible: false,
      lastLoginAt: null
    };
  }

  const plain = profile.toJSON ? profile.toJSON() : profile;
  return {
    ...plain,
    savedVehicles: Array.isArray(plain.savedVehicles) ? plain.savedVehicles : [],
    savedLocations: Array.isArray(plain.savedLocations) ? plain.savedLocations : [],
    prioritySupportEligible: Boolean(plain.prioritySupportEligible)
  };
};

export const buildUsername = (email: string) => {
  const base = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'customer';
  return `${base}_${Math.floor(Math.random() * 100000)}`;
};

const parseStringArray = (value: unknown) => Array.isArray(value) ? value.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [];

export const findAutoAssignableMechanic = async (args: {
  serviceTypeId?: number | null;
  specificServiceId?: number | null;
  vehicleTypeId?: number | null;
  latitude: number;
  longitude: number;
}) => {
  const [serviceType, specificService, vehicleType] = await Promise.all([
    args.serviceTypeId ? ServiceType.findByPk(args.serviceTypeId) : Promise.resolve(null),
    args.specificServiceId ? SpecificService.findByPk(args.specificServiceId) : Promise.resolve(null),
    args.vehicleTypeId ? VehicleType.findByPk(args.vehicleTypeId) : Promise.resolve(null)
  ]);

  const serviceNeedles = [
    serviceType?.getDataValue('name'),
    specificService?.getDataValue('name')
  ]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase());
  const vehicleNeedles = [vehicleType?.getDataValue('name')]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase());

  const mechanics = await Mechanic.findAll({
    where: {
      status: 'Approved',
      isOnline: true,
      availability: true
    } as any
  });

  const eligible = mechanics
    .filter((mechanic) => {
      const availabilityState = String(mechanic.getDataValue('availabilityState') || '').toUpperCase();
      if (availabilityState === 'OFFLINE') return false;

      const mechanicVehicles = parseStringArray(mechanic.getDataValue('vehicleTypes'));
      const mechanicServices = parseStringArray(mechanic.getDataValue('serviceTypes'));

      const vehicleMatch = vehicleNeedles.length === 0 || vehicleNeedles.some((item) => mechanicVehicles.includes(item));
      const serviceMatch = serviceNeedles.length === 0 || serviceNeedles.some((item) => mechanicServices.includes(item));

      return vehicleMatch && serviceMatch;
    })
    .map((mechanic) => ({
      mechanic,
      availabilityState: String(mechanic.getDataValue('availabilityState') || '').toUpperCase(),
      distanceKm: (() => {
        const mechanicLat = Number(mechanic.getDataValue('latitude'));
        const mechanicLng = Number(mechanic.getDataValue('longitude'));
        if (![mechanicLat, mechanicLng, args.latitude, args.longitude].every(Number.isFinite)) {
          return Number.MAX_SAFE_INTEGER;
        }

        return calculateDistanceKm(mechanicLat, mechanicLng, args.latitude, args.longitude);
      })()
    }))
    .sort((left, right) => {
      const leftBusy = left.availabilityState === 'ONLINE_BUSY' ? 1 : 0;
      const rightBusy = right.availabilityState === 'ONLINE_BUSY' ? 1 : 0;
      if (leftBusy !== rightBusy) {
        return leftBusy - rightBusy;
      }

      return left.distanceKm - right.distanceKm;
    });

  return eligible[0]?.mechanic || null;
};

export const assignRequestToMechanic = async (args: {
  requestRecord: any;
  mechanic: any;
  actorUserId: number;
  actorType: 'CUSTOMER' | 'SYSTEM';
  assignmentNote: string;
  dispatchMode: string;
  dispatchNote: string;
  timelineNote: string;
}) => {
  const now = new Date();
  const requestId = Number(args.requestRecord.getDataValue('id'));
  const mechanicId = Number(args.mechanic.getDataValue('id'));
  const etaMinutes = estimateEtaMinutes(args.requestRecord, args.mechanic);

  await RequestAssignment.create({
    customerRequestId: requestId,
    mechanicId,
    assignedByUserId: args.actorUserId,
    status: 'ASSIGNED',
    notes: args.assignmentNote
  });

  await RequestDispatchAttempt.create({
    customerRequestId: requestId,
    mechanicId,
    dispatchMode: args.dispatchMode,
    attemptStatus: 'DISPATCHING',
    notes: args.dispatchNote,
    metadata: { source: 'customer-request-flow' }
  });

  await args.requestRecord.update({
    mechanicId,
    status: 'ASSIGNED',
    statusUpdatedAt: now,
    dispatchStatus: 'DISPATCHING',
    lastDispatchAt: now,
    currentEtaMinutes: etaMinutes
  });

  await RequestTimelineEvent.create({
    customerRequestId: requestId,
    eventType: 'REQUEST_ASSIGNED',
    fromStatus: 'SUBMITTED',
    toStatus: 'ASSIGNED',
    actorType: args.actorType,
    actorUserId: args.actorUserId,
    notes: args.timelineNote,
    metadata: { mechanicId }
  });

  const { pushCustomerRequestSnapshot, pushMechanicSnapshots } = require('../realtimeController');
  await pushCustomerRequestSnapshot(requestId);
  await pushMechanicSnapshots(mechanicId, requestId);

  return mechanicId;
};

export const issueTokens = (userId: number, role: string) => {
  const token = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '30d' });
  return { token, refreshToken, role };
};
