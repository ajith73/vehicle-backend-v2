import { Op } from 'sequelize';
import {
  CustomerProfile,
  CustomerRequest,
  DispatchOverride,
  Mechanic,
  MechanicLiveState,
  PaymentTransaction,
  RequestAssignment,
  RequestCancellation,
  RequestDispatchAttempt,
  RequestInternalNote,
  RequestProofAsset,
  RequestQuote,
  RequestQuoteLineItem,
  RequestTimelineEvent,
  RealtimeEventLog,
  ServiceType,
  SpecificService,
  SupportTicket,
  User,
  VehicleType
} from '../../models';
import { REQUEST_STATUSES } from '../../constants/requestLifecycle';
import { pushAffectedRequestSideSnapshots } from '../../lib/realtimeSnapshotService';

export const MECHANIC_RESPONSE_STATUSES = new Set([
  REQUEST_STATUSES.ACCEPTED,
  REQUEST_STATUSES.REJECTED_BY_MECHANIC,
]);

export const loadRequestForOps = (id: number) =>
  CustomerRequest.findByPk(id, {
    include: [
      { model: Mechanic, attributes: ['id', 'businessName', 'name', 'city', 'state', 'phone', 'isOnline', 'availabilityState', 'lastActiveAt'] },
      { model: ServiceType, attributes: ['id', 'name'] },
      { model: SpecificService, attributes: ['id', 'name'] },
      { model: VehicleType, attributes: ['id', 'name'] },
      {
        model: User,
        as: 'CustomerUser',
        attributes: ['id', 'email', 'createdAt'],
        include: [{ model: CustomerProfile, attributes: ['displayName', 'lastLoginAt'] }]
      },
      {
        model: RequestAssignment,
        include: [
          { model: Mechanic, attributes: ['id', 'businessName', 'name', 'city', 'state'] },
          { model: User, as: 'AssignedByUser', attributes: ['id', 'email', 'name'] }
        ]
      },
      {
        model: RequestTimelineEvent,
        include: [{ model: User, as: 'ActorUser', attributes: ['id', 'email', 'name'] }]
      },
      { model: RequestCancellation },
      {
        model: RequestProofAsset,
        include: [{ model: User, as: 'UploadedByUser', attributes: ['id', 'email', 'name'] }]
      },
      {
        model: RequestInternalNote,
        include: [{ model: User, as: 'AuthorUser', attributes: ['id', 'email', 'name'] }]
      },
      {
        model: RequestQuote,
        include: [
          { model: Mechanic, attributes: ['id', 'businessName', 'name'] },
          { model: RequestQuoteLineItem }
        ]
      },
      {
        model: PaymentTransaction
      },
      {
        model: RequestDispatchAttempt,
        include: [{ model: Mechanic, attributes: ['id', 'businessName', 'name', 'isOnline', 'availabilityState'] }]
      },
      {
        model: DispatchOverride,
        include: [
          { model: Mechanic, attributes: ['id', 'businessName', 'name'] },
          { model: User, as: 'OverriddenByUser', attributes: ['id', 'email', 'name'] }
        ]
      },
      {
        model: SupportTicket,
        include: [
          { model: User, as: 'RaisedByUser', attributes: ['id', 'email', 'name'] },
          { model: User, as: 'AssignedToUser', attributes: ['id', 'email', 'name'] }
        ]
      }
    ],
    order: [
      [RequestAssignment, 'createdAt', 'DESC'],
      [RequestTimelineEvent, 'createdAt', 'ASC'],
      [RequestProofAsset, 'createdAt', 'DESC'],
      [RequestInternalNote, 'createdAt', 'DESC'],
      [RequestQuote, 'createdAt', 'DESC'],
      [PaymentTransaction, 'createdAt', 'DESC'],
      [RequestDispatchAttempt, 'createdAt', 'DESC'],
      [DispatchOverride, 'createdAt', 'DESC'],
      [SupportTicket, 'createdAt', 'DESC']
    ]
  });

export const appendTimelineEvent = async (args: {
  customerRequestId: number;
  eventType: string;
  actorType: string;
  actorUserId?: number | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  await RequestTimelineEvent.create({
    customerRequestId: args.customerRequestId,
    eventType: args.eventType,
    actorType: args.actorType,
    actorUserId: args.actorUserId ?? null,
    fromStatus: args.fromStatus ?? null,
    toStatus: args.toStatus ?? null,
    notes: args.notes ?? null,
    metadata: args.metadata || {}
  });
};

export const appendRealtimeEvent = async (args: {
  customerRequestId?: number | null;
  mechanicId?: number | null;
  actorUserId?: number | null;
  channel: string;
  eventType: string;
  payload?: Record<string, unknown>;
}) => {
  await RealtimeEventLog.create({
    customerRequestId: args.customerRequestId ?? null,
    mechanicId: args.mechanicId ?? null,
    actorUserId: args.actorUserId ?? null,
    channel: args.channel,
    eventType: args.eventType,
    payload: args.payload || {}
  });

  if (args.customerRequestId) {
    const { pushCustomerRequestSnapshot } = require('../realtimeController');
    await pushCustomerRequestSnapshot(args.customerRequestId);
  }
  if (args.mechanicId) {
    const { pushMechanicSnapshots } = require('../realtimeController');
    await pushMechanicSnapshots(args.mechanicId, args.customerRequestId ?? null);
  }

  await pushAffectedRequestSideSnapshots({
    customerRequestId: args.customerRequestId ?? null,
    mechanicId: args.mechanicId ?? null
  });
};

const toRadians = (value: number) => (value * Math.PI) / 180;

export const calculateDistanceKm = (startLat: number, startLng: number, endLat: number, endLng: number) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(startLat)) * Math.cos(toRadians(endLat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

export const estimateEtaMinutes = (requestRecord: any, mechanic: any) => {
  const mechanicLat = Number(mechanic?.getDataValue?.('latitude') ?? mechanic?.latitude);
  const mechanicLng = Number(mechanic?.getDataValue?.('longitude') ?? mechanic?.longitude);
  const requestLat = Number(requestRecord?.getDataValue?.('latitude') ?? requestRecord?.latitude);
  const requestLng = Number(requestRecord?.getDataValue?.('longitude') ?? requestRecord?.longitude);

  if (![mechanicLat, mechanicLng, requestLat, requestLng].every(Number.isFinite)) {
    return null;
  }

  const distanceKm = calculateDistanceKm(mechanicLat, mechanicLng, requestLat, requestLng);
  return Math.max(5, Math.min(90, Math.round(distanceKm * 4.5)));
};

export const upsertMechanicLiveState = async (mechanicId: number, payload: Record<string, unknown>) => {
  const existingState = await MechanicLiveState.findOne({ where: { mechanicId } });
  if (existingState) {
    await existingState.update(payload);
    return existingState;
  }

  return MechanicLiveState.create({
    mechanicId,
    ...payload
  });
};

export const createDispatchAttempt = async (args: {
  customerRequestId: number;
  mechanicId?: number | null;
  dispatchMode: string;
  attemptStatus: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}) => RequestDispatchAttempt.create({
  customerRequestId: args.customerRequestId,
  mechanicId: args.mechanicId ?? null,
  dispatchMode: args.dispatchMode,
  attemptStatus: args.attemptStatus,
  notes: args.notes ?? null,
  metadata: args.metadata || {}
});

export const updateLatestDispatchAttempt = async (customerRequestId: number, mechanicId: number, values: Record<string, unknown>) => {
  const attempt = await RequestDispatchAttempt.findOne({
    where: { customerRequestId, mechanicId },
    order: [['createdAt', 'DESC']]
  });

  if (attempt) {
    await attempt.update(values);
  }

  return attempt;
};

export const transitionRequestStatus = async (requestRecord: any, args: {
  toStatus: string;
  actorType: string;
  actorUserId?: number | null;
  eventType: string;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  const fromStatus = requestRecord.getDataValue('status');
  const statusFields: Record<string, Date> = {
    statusUpdatedAt: new Date()
  };

  if (args.toStatus === REQUEST_STATUSES.ACCEPTED) statusFields.acceptedAt = new Date();
  if (args.toStatus === REQUEST_STATUSES.EN_ROUTE) statusFields.enRouteAt = new Date();
  if (args.toStatus === REQUEST_STATUSES.ARRIVED) statusFields.arrivedAt = new Date();
  if (args.toStatus === REQUEST_STATUSES.SERVICE_STARTED) statusFields.serviceStartedAt = new Date();
  if (args.toStatus === REQUEST_STATUSES.SERVICE_COMPLETED) statusFields.completedAt = new Date();

  await requestRecord.update({
    status: args.toStatus,
    ...statusFields
  });
  await appendTimelineEvent({
    customerRequestId: requestRecord.getDataValue('id'),
    eventType: args.eventType,
    actorType: args.actorType,
    actorUserId: args.actorUserId ?? null,
    fromStatus,
    toStatus: args.toStatus,
    notes: args.notes ?? null,
    metadata: args.metadata
  });
};

export const parseRequestId = (rawId: string | string[] | undefined) => {
  const normalized = Array.isArray(rawId) ? rawId[0] : rawId;
  const parsed = Number.parseInt(normalized || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseMechanicId = (value: unknown) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getMechanicForUser = async (userId: number) => Mechanic.findOne({ where: { createdById: userId } });

const sanitizeMechanicRequestPayload = (request: any) => {
  if (!request) return null;
  const json = typeof request.toJSON === 'function' ? request.toJSON() : { ...request };
  delete json.completionPin;
  delete json.completionPinGeneratedAt;
  delete json.completionPinVerifiedAt;
  return json;
};

const sanitizeCustomerRequestPayload = (request: any) => {
  if (!request) return null;
  const json = typeof request.toJSON === 'function' ? request.toJSON() : { ...request };
  if (json.status !== REQUEST_STATUSES.SERVICE_STARTED) {
    delete json.completionPin;
  }
  return json;
};

export const getMechanicJobsForMechanicId = async (mechanicId: number) =>
  (await CustomerRequest.findAll({
    where: {
      mechanicId,
      status: {
        [Op.in]: [
          REQUEST_STATUSES.ASSIGNED,
          REQUEST_STATUSES.ACCEPTED,
          REQUEST_STATUSES.EN_ROUTE,
          REQUEST_STATUSES.ARRIVED,
          REQUEST_STATUSES.SERVICE_STARTED,
          REQUEST_STATUSES.SERVICE_COMPLETED,
          REQUEST_STATUSES.CUSTOMER_NO_RESPONSE,
          REQUEST_STATUSES.MECHANIC_NO_SHOW,
          REQUEST_STATUSES.SERVICE_CANCELLED,
          REQUEST_STATUSES.REJECTED_BY_MECHANIC,
          REQUEST_STATUSES.NO_RESPONSE
        ]
      }
    } as any,
    include: [
      { model: Mechanic, attributes: ['id', 'businessName', 'name', 'isOnline', 'availabilityState', 'lastActiveAt'] },
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
  })).map(sanitizeMechanicRequestPayload);

export const getMechanicJobByIdForMechanic = async (requestId: number, mechanicId: number) => {
  const requestRecord = await loadRequestForOps(requestId);
  if (!requestRecord || requestRecord.getDataValue('mechanicId') !== mechanicId) {
    return null;
  }
  return sanitizeMechanicRequestPayload(requestRecord);
};

export const getRequestForCustomerUser = async (requestId: number, customerUserId: number) => {
  const requestRecord = await loadRequestForOps(requestId);
  if (!requestRecord || requestRecord.getDataValue('customerUserId') !== customerUserId) {
    return null;
  }

  if (
    requestRecord.getDataValue('status') === REQUEST_STATUSES.SERVICE_STARTED &&
    !requestRecord.getDataValue('completionPin')
  ) {
    await requestRecord.update({
      completionPin: String(Math.floor(1000 + Math.random() * 9000)),
      completionPinGeneratedAt: requestRecord.getDataValue('completionPinGeneratedAt') || new Date(),
      completionPinVerifiedAt: null
    });
  }

  return sanitizeCustomerRequestPayload(requestRecord);
};

export const toMoney = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
};

export const getLatestQuoteForRequest = (customerRequestId: number) =>
  RequestQuote.findOne({
    where: { customerRequestId },
    include: [{ model: RequestQuoteLineItem }, { model: Mechanic, attributes: ['id', 'businessName', 'name'] }],
    order: [['createdAt', 'DESC']]
  });

export const allowedStatusTransitions: Record<string, string[]> = {
  [REQUEST_STATUSES.ACCEPTED]: [REQUEST_STATUSES.EN_ROUTE, REQUEST_STATUSES.CUSTOMER_NO_RESPONSE, REQUEST_STATUSES.SERVICE_CANCELLED],
  [REQUEST_STATUSES.EN_ROUTE]: [REQUEST_STATUSES.ARRIVED, REQUEST_STATUSES.MECHANIC_NO_SHOW, REQUEST_STATUSES.SERVICE_CANCELLED],
  [REQUEST_STATUSES.ARRIVED]: [REQUEST_STATUSES.SERVICE_STARTED, REQUEST_STATUSES.CUSTOMER_NO_RESPONSE, REQUEST_STATUSES.SERVICE_CANCELLED],
  [REQUEST_STATUSES.SERVICE_STARTED]: [REQUEST_STATUSES.SERVICE_COMPLETED, REQUEST_STATUSES.SERVICE_CANCELLED],
};

export const mechanicLifecycleEvents: Record<string, string> = {
  [REQUEST_STATUSES.EN_ROUTE]: 'MECHANIC_EN_ROUTE',
  [REQUEST_STATUSES.ARRIVED]: 'MECHANIC_ARRIVED',
  [REQUEST_STATUSES.SERVICE_STARTED]: 'SERVICE_STARTED',
  [REQUEST_STATUSES.SERVICE_COMPLETED]: 'SERVICE_COMPLETED',
  [REQUEST_STATUSES.CUSTOMER_NO_RESPONSE]: 'CUSTOMER_NO_RESPONSE',
  [REQUEST_STATUSES.MECHANIC_NO_SHOW]: 'MECHANIC_NO_SHOW',
  [REQUEST_STATUSES.SERVICE_CANCELLED]: 'SERVICE_CANCELLED',
};

export const enhancePhaseOneRequestCreation = async (requestId: number) => {
  const requestRecord = await CustomerRequest.findByPk(requestId);
  if (!requestRecord) return;

  const { CustomerSubscription } = require('../../models');
  const customerId = requestRecord.getDataValue('customerUserId');
  const activeSubscription = await CustomerSubscription.findOne({
    where: { customerUserId: customerId, status: 'ACTIVE' }
  });

  const platformFee = activeSubscription ? 0.00 : 50.00;
  await requestRecord.update({ feeAmount: platformFee });

  const currentStatus = requestRecord.getDataValue('status');
  if (!requestRecord.getDataValue('statusUpdatedAt')) {
    await requestRecord.update({ statusUpdatedAt: new Date() });
  }

  const existingEvents = await RequestTimelineEvent.count({ where: { customerRequestId: requestId } });
  if (existingEvents === 0) {
    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: 'REQUEST_CREATED',
      actorType: 'CUSTOMER',
      actorUserId: requestRecord.getDataValue('customerUserId'),
      toStatus: currentStatus,
      notes: 'Request created by customer'
    });
  }
};
