import { Response } from 'express';
import { Op } from 'sequelize';
import { ActivityLog, CustomerProfile, CustomerRequest, DispatchOverride, Mechanic, MechanicLiveState, PaymentTransaction, PayoutSettlement, RealtimeEventLog, RequestAssignment, RequestCancellation, RequestDispatchAttempt, RequestInternalNote, RequestProofAsset, RequestQuote, RequestQuoteLineItem, RequestTimelineEvent, ServiceType, SpecificService, SupportTicket, User, VehicleType, sequelize } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';
import { PAYMENT_STATUSES, QUOTE_STATUSES, REQUEST_STATUSES } from '../constants/requestLifecycle';

const MECHANIC_RESPONSE_STATUSES = new Set([
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

const appendTimelineEvent = async (args: {
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

const appendRealtimeEvent = async (args: {
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
    const { pushCustomerRequestSnapshot } = require('./realtimeController');
    await pushCustomerRequestSnapshot(args.customerRequestId);
  }
  if (args.mechanicId) {
    const { pushMechanicSnapshots } = require('./realtimeController');
    await pushMechanicSnapshots(args.mechanicId, args.customerRequestId ?? null);
  }
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (startLat: number, startLng: number, endLat: number, endLng: number) => {
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

const estimateEtaMinutes = (requestRecord: any, mechanic: any) => {
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

const upsertMechanicLiveState = async (mechanicId: number, payload: Record<string, unknown>) => {
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

const createDispatchAttempt = async (args: {
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

const updateLatestDispatchAttempt = async (customerRequestId: number, mechanicId: number, values: Record<string, unknown>) => {
  const attempt = await RequestDispatchAttempt.findOne({
    where: { customerRequestId, mechanicId },
    order: [['createdAt', 'DESC']]
  });

  if (attempt) {
    await attempt.update(values);
  }

  return attempt;
};

const transitionRequestStatus = async (requestRecord: any, args: {
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

const parseRequestId = (rawId: string | string[] | undefined) => {
  const normalized = Array.isArray(rawId) ? rawId[0] : rawId;
  const parsed = Number.parseInt(normalized || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseMechanicId = (value: unknown) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const getMechanicForUser = async (userId: number) => Mechanic.findOne({ where: { createdById: userId } });

export const getMechanicJobsForMechanicId = async (mechanicId: number) =>
  CustomerRequest.findAll({
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
  });

export const getMechanicJobByIdForMechanic = async (requestId: number, mechanicId: number) => {
  const requestRecord = await loadRequestForOps(requestId);
  if (!requestRecord || requestRecord.getDataValue('mechanicId') !== mechanicId) {
    return null;
  }
  return requestRecord;
};

export const getRequestForCustomerUser = async (requestId: number, customerUserId: number) => {
  const requestRecord = await loadRequestForOps(requestId);
  if (!requestRecord || requestRecord.getDataValue('customerUserId') !== customerUserId) {
    return null;
  }
  return requestRecord;
};

const toMoney = (value: unknown) => {
  const parsed = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Number(parsed.toFixed(2));
};

const getLatestQuoteForRequest = (customerRequestId: number) =>
  RequestQuote.findOne({
    where: { customerRequestId },
    include: [{ model: RequestQuoteLineItem }, { model: Mechanic, attributes: ['id', 'businessName', 'name'] }],
    order: [['createdAt', 'DESC']]
  });

const allowedStatusTransitions: Record<string, string[]> = {
  [REQUEST_STATUSES.ACCEPTED]: [REQUEST_STATUSES.EN_ROUTE, REQUEST_STATUSES.CUSTOMER_NO_RESPONSE, REQUEST_STATUSES.SERVICE_CANCELLED],
  [REQUEST_STATUSES.EN_ROUTE]: [REQUEST_STATUSES.ARRIVED, REQUEST_STATUSES.MECHANIC_NO_SHOW, REQUEST_STATUSES.SERVICE_CANCELLED],
  [REQUEST_STATUSES.ARRIVED]: [REQUEST_STATUSES.SERVICE_STARTED, REQUEST_STATUSES.CUSTOMER_NO_RESPONSE, REQUEST_STATUSES.SERVICE_CANCELLED],
  [REQUEST_STATUSES.SERVICE_STARTED]: [REQUEST_STATUSES.SERVICE_COMPLETED, REQUEST_STATUSES.SERVICE_CANCELLED],
};

const mechanicLifecycleEvents: Record<string, string> = {
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

  // Phase 1 & 2 Pricing & Fee Waiver Logic
  const customerId = requestRecord.getDataValue('customerUserId');
  const activeSubscription = await require('../models').CustomerSubscription.findOne({
    where: { customerUserId: customerId, status: 'ACTIVE' }
  });
  
  const platformFee = activeSubscription ? 0.00 : 50.00;
  // Use update instead of setting field directly to ensure it saves
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
      notes: 'Customer submitted a new help request.'
    });
  }
};

export const assignRequestByAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const mechanicId = parseMechanicId(req.body.mechanicId);
    if (!mechanicId) {
      return res.status(400).json({ error: 'Valid mechanicId is required' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const mechanic = await Mechanic.findByPk(mechanicId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    const existingAssignment = await RequestAssignment.findOne({
      where: {
        customerRequestId: requestId,
        mechanicId,
        status: REQUEST_STATUSES.ASSIGNED
      }
    });

    if (!existingAssignment) {
      await RequestAssignment.create({
        customerRequestId: requestId,
        mechanicId,
        assignedByUserId: req.user?.userId || null,
        status: REQUEST_STATUSES.ASSIGNED,
        notes: req.body.notes || null
      });
    }

    await createDispatchAttempt({
      customerRequestId: requestId,
      mechanicId,
      dispatchMode: 'MANUAL',
      attemptStatus: 'DISPATCHING',
      notes: req.body.notes || 'Manual dispatch assignment created by admin.',
      metadata: { actorRole: req.user?.role || 'ADMIN' }
    });

    const etaMinutes = estimateEtaMinutes(requestRecord, mechanic);
    await requestRecord.update({
      mechanicId,
      adminNotes: req.body.notes || requestRecord.getDataValue('adminNotes') || null,
      dispatchStatus: 'DISPATCHING',
      lastDispatchAt: new Date(),
      currentEtaMinutes: etaMinutes
    });

    const targetStatus = requestRecord.getDataValue('status') === REQUEST_STATUSES.SUBMITTED
      ? REQUEST_STATUSES.ASSIGNED
      : REQUEST_STATUSES.ASSIGNED;

    await transitionRequestStatus(requestRecord, {
      toStatus: targetStatus,
      actorType: 'ADMIN',
      actorUserId: req.user?.userId,
      eventType: 'REQUEST_ASSIGNED',
      notes: req.body.notes || `Assigned to mechanic #${mechanicId}`,
      metadata: { mechanicId }
    });

    await appendRealtimeEvent({
      customerRequestId: requestId,
      mechanicId,
      actorUserId: req.user?.userId,
      channel: 'ADMIN_OPS',
      eventType: 'REQUEST_ASSIGNED',
      payload: { mechanicId, dispatchStatus: 'DISPATCHING', etaMinutes }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Request assigned successfully', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to assign request');
  }
};

export const reassignRequestByAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const mechanicId = parseMechanicId(req.body.mechanicId);
    if (!mechanicId) {
      return res.status(400).json({ error: 'Valid mechanicId is required' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const previousMechanicId = requestRecord.getDataValue('mechanicId');
    const mechanic = await Mechanic.findByPk(mechanicId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic not found' });
    }

    await RequestAssignment.create({
      customerRequestId: requestId,
      mechanicId,
      assignedByUserId: req.user?.userId || null,
      status: REQUEST_STATUSES.ASSIGNED,
      notes: req.body.notes || null
    });

    await createDispatchAttempt({
      customerRequestId: requestId,
      mechanicId,
      dispatchMode: 'MANUAL_REASSIGN',
      attemptStatus: 'AUTO_REASSIGNING',
      notes: req.body.notes || 'Admin manually reassigned dispatch.',
      metadata: { previousMechanicId }
    });

    const etaMinutes = estimateEtaMinutes(requestRecord, mechanic);
    await requestRecord.update({
      mechanicId,
      adminNotes: req.body.notes || requestRecord.getDataValue('adminNotes') || null,
      dispatchStatus: 'AUTO_REASSIGNING',
      lastDispatchAt: new Date(),
      currentEtaMinutes: etaMinutes
    });

    await transitionRequestStatus(requestRecord, {
      toStatus: REQUEST_STATUSES.ASSIGNED,
      actorType: 'ADMIN',
      actorUserId: req.user?.userId,
      eventType: 'REQUEST_REASSIGNED',
      notes: req.body.notes || `Reassigned from mechanic #${previousMechanicId || 'none'} to mechanic #${mechanicId}`,
      metadata: { previousMechanicId, mechanicId }
    });

    await appendRealtimeEvent({
      customerRequestId: requestId,
      mechanicId,
      actorUserId: req.user?.userId,
      channel: 'ADMIN_OPS',
      eventType: 'REQUEST_REASSIGNED',
      payload: { previousMechanicId, mechanicId, etaMinutes }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Request reassigned successfully', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to reassign request');
  }
};

export const cancelRequestByAdmin = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const reason = String(req.body.reason || '').trim();
    const details = String(req.body.details || '').trim();
    if (!reason) {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const existingCancellation = await RequestCancellation.findOne({ where: { customerRequestId: requestId } });
    if (existingCancellation) {
      await existingCancellation.update({
        cancelledByType: 'ADMIN',
        cancelledByUserId: req.user?.userId || null,
        reason,
        details: details || null
      });
    } else {
      await RequestCancellation.create({
        customerRequestId: requestId,
        cancelledByType: 'ADMIN',
        cancelledByUserId: req.user?.userId || null,
        reason,
        details: details || null
      });
    }

    await transitionRequestStatus(requestRecord, {
      toStatus: REQUEST_STATUSES.CANCELLED_BY_ADMIN,
      actorType: 'ADMIN',
      actorUserId: req.user?.userId,
      eventType: 'REQUEST_CANCELLED',
      notes: reason,
      metadata: { details }
    });

    await appendRealtimeEvent({
      customerRequestId: requestId,
      mechanicId: requestRecord.getDataValue('mechanicId'),
      actorUserId: req.user?.userId,
      channel: 'ADMIN_OPS',
      eventType: 'REQUEST_CANCELLED',
      payload: { reason, details }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Request cancelled successfully', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to cancel request');
  }
};

export const listMechanicJobs = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can access jobs' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const requests = await getMechanicJobsForMechanicId(mechanic.getDataValue('id'));

    res.json(requests);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic jobs');
  }
};

export const getMechanicJob = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can access jobs' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const requestRecord = await getMechanicJobByIdForMechanic(requestId, mechanic.getDataValue('id'));
    if (!requestRecord) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(requestRecord);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic job');
  }
};

export const listMechanicNotifications = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can access notifications' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const mechanicId = mechanic.getDataValue('id');
    const [requests, tickets, settlements] = await Promise.all([
      CustomerRequest.findAll({
        where: { mechanicId } as any,
        attributes: ['id', 'status', 'issueSummary', 'updatedAt', 'createdAt', 'dispatchStatus'],
        order: [['updatedAt', 'DESC']],
        limit: 12
      }),
      SupportTicket.findAll({
        where: {
          [Op.or]: [
            { raisedByUserId: req.user.userId },
            { source: 'PARTNER' }
          ]
        } as any,
        include: [{ model: CustomerRequest, attributes: ['id', 'mechanicId'] }],
        order: [['updatedAt', 'DESC']],
        limit: 12
      }),
      PayoutSettlement.findAll({
        where: { mechanicId } as any,
        attributes: ['id', 'status', 'totalAmount', 'processedAt', 'createdAt', 'notes'],
        order: [['createdAt', 'DESC']],
        limit: 8
      })
    ]);

    const requestNotifications = requests.map((request: any) => ({
      id: `request-${request.getDataValue('id')}-${request.getDataValue('updatedAt')}`,
      type: ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'SERVICE_STARTED'].includes(String(request.getDataValue('status'))) ? 'ALERT' : 'SYSTEM',
      title: `Request ${String(request.getDataValue('status')).replace(/_/g, ' ')}`,
      message: `REQ-${request.getDataValue('id')} • ${request.getDataValue('issueSummary') || 'Roadside request'} is now ${String(request.getDataValue('status')).replace(/_/g, ' ').toLowerCase()}.`,
      time: request.getDataValue('updatedAt') || request.getDataValue('createdAt'),
      read: false,
      source: 'request'
    }));

    const supportNotifications = tickets
      .filter((ticket: any) => {
        const request = ticket.getDataValue('CustomerRequest');
        return !request || Number(request.mechanicId) === mechanicId || Number(ticket.getDataValue('raisedByUserId')) === req.user?.userId;
      })
      .map((ticket: any) => ({
        id: `support-${ticket.getDataValue('id')}-${ticket.getDataValue('updatedAt')}`,
        type: ticket.getDataValue('status') === 'RESOLVED' ? 'SUCCESS' : (ticket.getDataValue('priority') === 'CRITICAL' ? 'WARNING' : 'SYSTEM'),
        title: ticket.getDataValue('status') === 'RESOLVED' ? 'Support ticket resolved' : `Support ${ticket.getDataValue('status').toLowerCase()}`,
        message: `${ticket.getDataValue('subject')} • ${ticket.getDataValue('priority')} priority`,
        time: ticket.getDataValue('updatedAt') || ticket.getDataValue('createdAt'),
        read: false,
        source: 'support'
      }));

    const settlementNotifications = settlements.map((settlement: any) => ({
      id: `settlement-${settlement.getDataValue('id')}-${settlement.getDataValue('createdAt')}`,
      type: settlement.getDataValue('status') === 'PROCESSED' ? 'SUCCESS' : 'SYSTEM',
      title: settlement.getDataValue('status') === 'PROCESSED' ? 'Settlement processed' : 'Settlement update',
      message: `Settlement #${settlement.getDataValue('id')} • INR ${Number(settlement.getDataValue('totalAmount') || 0).toFixed(2)} • ${settlement.getDataValue('status')}`,
      time: settlement.getDataValue('processedAt') || settlement.getDataValue('createdAt'),
      read: false,
      source: 'settlement'
    }));

    const notifications = [...requestNotifications, ...supportNotifications, ...settlementNotifications]
      .sort((left, right) => new Date(String(right.time)).getTime() - new Date(String(left.time)).getTime())
      .slice(0, 30);

    res.json(notifications);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic notifications');
  }
};

export const listMechanicSupportTickets = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can access support tickets' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const tickets = await SupportTicket.findAll({
      where: {
        [Op.or]: [
          { raisedByUserId: req.user.userId },
          { source: 'PARTNER' }
        ]
      } as any,
      include: [
        {
          model: CustomerRequest,
          attributes: ['id', 'mechanicId', 'status', 'issueSummary', 'addressText']
        },
        { model: User, as: 'RaisedByUser', attributes: ['id', 'email', 'name'] },
        { model: User, as: 'AssignedToUser', attributes: ['id', 'email', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const filtered = tickets.filter((ticket: any) => {
      const request = ticket.getDataValue('CustomerRequest');
      return !request || Number(request.mechanicId) === mechanic.getDataValue('id') || Number(ticket.getDataValue('raisedByUserId')) === req.user?.userId;
    });

    res.json(filtered);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic support tickets');
  }
};

export const createMechanicSupportTicket = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can create support tickets' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const requestId = Number.parseInt(String(req.body.customerRequestId || ''), 10);
    if (!Number.isInteger(requestId) || requestId <= 0) {
      return res.status(400).json({ error: 'Valid customerRequestId is required' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || Number(requestRecord.getDataValue('mechanicId')) !== mechanic.getDataValue('id')) {
      return res.status(404).json({ error: 'Related request not found for this partner' });
    }

    const ticket = await SupportTicket.create({
      customerRequestId: requestId,
      raisedByUserId: req.user.userId,
      source: 'PARTNER',
      ticketType: String(req.body.category || 'PARTNER_SUPPORT').trim(),
      status: 'OPEN',
      priority: req.body.priority ? String(req.body.priority).trim() : 'NORMAL',
      subject: String(req.body.subject || '').trim(),
      description: String(req.body.description || '').trim(),
      metadata: {
        incidentType: req.body.incidentType ? String(req.body.incidentType).trim() : 'Partner issue',
        contactPreference: req.body.contactPreference ? String(req.body.contactPreference).trim() : 'Call',
        evidenceNotes: req.body.evidenceNotes ? String(req.body.evidenceNotes).trim() : null,
        mechanicId: mechanic.getDataValue('id'),
        partnerName: mechanic.getDataValue('businessName') || mechanic.getDataValue('name') || null,
      }
    });

    await ActivityLog.create({
      action: 'PARTNER_SUPPORT_TICKET_CREATED',
      details: JSON.stringify({
        supportTicketId: ticket.getDataValue('id'),
        mechanicId: mechanic.getDataValue('id'),
        requestId,
        priority: ticket.getDataValue('priority')
      })
    });

    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: 'PARTNER_SUPPORT_CREATED',
      actorType: 'MECHANIC',
      actorUserId: req.user.userId,
      notes: ticket.getDataValue('subject'),
      metadata: { supportTicketId: ticket.getDataValue('id') }
    });

    const populated = await SupportTicket.findByPk(ticket.getDataValue('id'), {
      include: [
        {
          model: CustomerRequest,
          attributes: ['id', 'mechanicId', 'status', 'issueSummary', 'addressText']
        },
        { model: User, as: 'RaisedByUser', attributes: ['id', 'email', 'name'] },
        { model: User, as: 'AssignedToUser', attributes: ['id', 'email', 'name'] }
      ]
    });

    res.status(201).json({ message: 'Support ticket created', ticket: populated });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to create mechanic support ticket');
  }
};

const handleMechanicJobDecision = async (req: AuthRequest, res: Response, decision: 'accept' | 'reject') => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can update jobs' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('mechanicId') !== mechanic.getDataValue('id')) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const currentStatus = requestRecord.getDataValue('status');
    if (![REQUEST_STATUSES.ASSIGNED, REQUEST_STATUSES.ACCEPTED].includes(currentStatus)) {
      return res.status(400).json({ error: `Job cannot be ${decision}ed from status ${currentStatus}` });
    }

    const latestAssignment = await RequestAssignment.findOne({
      where: { customerRequestId: requestId, mechanicId: mechanic.getDataValue('id') },
      order: [['createdAt', 'DESC']]
    });

    if (latestAssignment) {
      await latestAssignment.update({
        status: decision === 'accept' ? REQUEST_STATUSES.ACCEPTED : REQUEST_STATUSES.REJECTED_BY_MECHANIC,
        respondedAt: new Date(),
        notes: req.body.reason || req.body.notes || latestAssignment.getDataValue('notes') || null
      });
    }

    if (decision === 'reject') {
      const reason = String(req.body.reason || '').trim();
      if (!reason) {
        return res.status(400).json({ error: 'Rejection reason is required' });
      }
    }

    const toStatus = decision === 'accept' ? REQUEST_STATUSES.ACCEPTED : REQUEST_STATUSES.REJECTED_BY_MECHANIC;
    const etaMinutes = decision === 'accept' ? estimateEtaMinutes(requestRecord, mechanic) : null;

    await updateLatestDispatchAttempt(requestId, mechanic.getDataValue('id'), {
      attemptStatus: decision === 'accept' ? 'PARTNER_ACCEPTED' : 'PARTNER_DECLINED',
      responseAt: new Date(),
      notes: decision === 'reject' ? String(req.body.reason || '').trim() : 'Mechanic accepted the request.'
    });

    await requestRecord.update({
      dispatchStatus: decision === 'accept' ? 'PARTNER_ACCEPTED' : 'PARTNER_DECLINED',
      currentEtaMinutes: etaMinutes,
      lastDispatchAt: new Date()
    });

    await transitionRequestStatus(requestRecord, {
      toStatus,
      actorType: 'MECHANIC',
      actorUserId: req.user.userId,
      eventType: decision === 'accept' ? 'REQUEST_ACCEPTED' : 'REQUEST_REJECTED',
      notes: decision === 'accept' ? 'Mechanic accepted the assignment.' : String(req.body.reason || '').trim(),
      metadata: decision === 'reject' ? { reason: String(req.body.reason || '').trim() } : {}
    });

    if (decision === 'accept') {
      await upsertMechanicLiveState(mechanic.getDataValue('id'), {
        isOnline: true,
        availabilityState: 'ONLINE_BUSY',
        activeRequestId: requestId,
        metadata: { lastDecision: 'accept' }
      });
      await mechanic.update({
        isOnline: true,
        availabilityState: 'ONLINE_BUSY',
        lastActiveAt: new Date()
      });
    }

    await appendRealtimeEvent({
      customerRequestId: requestId,
      mechanicId: mechanic.getDataValue('id'),
      actorUserId: req.user.userId,
      channel: 'MECHANIC_DISPATCH',
      eventType: decision === 'accept' ? 'PARTNER_ACCEPTED' : 'PARTNER_DECLINED',
      payload: { etaMinutes, reason: req.body.reason || null }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: decision === 'accept' ? 'Job accepted' : 'Job rejected', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, `Failed to ${decision} mechanic job`);
  }
};

export const acceptMechanicJob = async (req: AuthRequest, res: Response) => handleMechanicJobDecision(req, res, 'accept');
export const rejectMechanicJob = async (req: AuthRequest, res: Response) => handleMechanicJobDecision(req, res, 'reject');

export const getCustomerRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can access request status' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await getRequestForCustomerUser(requestId, req.user.userId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(requestRecord);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch customer request status');
  }
};

export const cancelCustomerRequest = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can cancel requests' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const reason = String(req.body.reason || '').trim();
    const details = String(req.body.details || '').trim();
    if (!reason) {
      return res.status(400).json({ error: 'Cancellation reason is required' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('customerUserId') !== req.user.userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const currentStatus = requestRecord.getDataValue('status');
    if (MECHANIC_RESPONSE_STATUSES.has(currentStatus)) {
      return res.status(400).json({ error: 'This request can no longer be cancelled by the customer in the current phase.' });
    }

    const existingCancellation = await RequestCancellation.findOne({ where: { customerRequestId: requestId } });
    if (existingCancellation) {
      await existingCancellation.update({
        cancelledByType: 'CUSTOMER',
        cancelledByUserId: req.user.userId,
        reason,
        details: details || null
      });
    } else {
      await RequestCancellation.create({
        customerRequestId: requestId,
        cancelledByType: 'CUSTOMER',
        cancelledByUserId: req.user.userId,
        reason,
        details: details || null
      });
    }

    await transitionRequestStatus(requestRecord, {
      toStatus: REQUEST_STATUSES.CANCELLED_BY_CUSTOMER,
      actorType: 'CUSTOMER',
      actorUserId: req.user.userId,
      eventType: 'REQUEST_CANCELLED',
      notes: reason,
      metadata: { details }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Request cancelled successfully', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to cancel customer request');
  }
};

export const updateMechanicJobLifecycle = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can update jobs' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('mechanicId') !== mechanic.getDataValue('id')) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const nextStatus = String(req.body.status || '').trim();
    const currentStatus = requestRecord.getDataValue('status');
    const allowedTargets = allowedStatusTransitions[currentStatus] || [];

    if (!allowedTargets.includes(nextStatus)) {
      return res.status(400).json({ error: `Invalid transition from ${currentStatus} to ${nextStatus}` });
    }

    await transitionRequestStatus(requestRecord, {
      toStatus: nextStatus,
      actorType: 'MECHANIC',
      actorUserId: req.user.userId,
      eventType: mechanicLifecycleEvents[nextStatus] || 'STATUS_UPDATED',
      notes: req.body.notes || null,
      metadata: {}
    });

    const nextLiveState = nextStatus === REQUEST_STATUSES.EN_ROUTE
      ? 'EN_ROUTE'
      : nextStatus === REQUEST_STATUSES.ARRIVED
        ? 'ON_SITE'
        : nextStatus === REQUEST_STATUSES.SERVICE_STARTED
          ? 'ONLINE_BUSY'
          : nextStatus === REQUEST_STATUSES.SERVICE_COMPLETED
            ? 'ONLINE_IDLE'
            : nextStatus === REQUEST_STATUSES.SERVICE_CANCELLED
              ? 'TEMP_UNAVAILABLE'
              : mechanic.getDataValue('availabilityState') || 'ONLINE_BUSY';

    const nextEta = nextStatus === REQUEST_STATUSES.EN_ROUTE
      ? estimateEtaMinutes(requestRecord, mechanic)
      : nextStatus === REQUEST_STATUSES.ARRIVED
        ? 0
        : requestRecord.getDataValue('currentEtaMinutes');

    await requestRecord.update({
      currentEtaMinutes: nextEta,
      lastLocationUpdateAt: new Date()
    });

    await upsertMechanicLiveState(mechanic.getDataValue('id'), {
      isOnline: true,
      availabilityState: nextLiveState,
      activeRequestId: nextStatus === REQUEST_STATUSES.SERVICE_COMPLETED ? null : requestId,
      metadata: { lifecycleStatus: nextStatus }
    });

    await mechanic.update({
      isOnline: true,
      availabilityState: nextLiveState,
      lastActiveAt: new Date()
    });

    if (req.body.proofAssetUrl) {
      await RequestProofAsset.create({
        customerRequestId: requestId,
        uploadedByType: 'MECHANIC',
        uploadedByUserId: req.user.userId,
        assetType: nextStatus === REQUEST_STATUSES.SERVICE_COMPLETED ? 'COMPLETION_PROOF' : 'SERVICE_PROOF',
        assetUrl: req.body.proofAssetUrl,
        caption: req.body.proofCaption || req.body.notes || null
      });
    }

    await appendRealtimeEvent({
      customerRequestId: requestId,
      mechanicId: mechanic.getDataValue('id'),
      actorUserId: req.user.userId,
      channel: 'CUSTOMER_TRACKING',
      eventType: nextStatus,
      payload: { notes: req.body.notes || null, currentEtaMinutes: nextEta }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Job status updated successfully', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update mechanic job lifecycle');
  }
};

export const addAdminRequestInternalNote = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const note = String(req.body.note || '').trim();
    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }

    await RequestInternalNote.create({
      customerRequestId: requestId,
      authorUserId: req.user?.userId || null,
      note
    });

    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: 'ADMIN_NOTE_ADDED',
      actorType: 'ADMIN',
      actorUserId: req.user?.userId || null,
      notes: note
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Internal note added', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to add internal note');
  }
};

export const goMechanicOnline = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can update live state' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const availabilityState = String(req.body.availabilityState || 'ONLINE_IDLE');
    const now = new Date();
    await mechanic.update({
      isOnline: true,
      availabilityState,
      lastActiveAt: now
    });

    const liveState = await upsertMechanicLiveState(mechanic.getDataValue('id'), {
      isOnline: true,
      availabilityState,
      latitude: req.body.latitude ?? mechanic.getDataValue('latitude'),
      longitude: req.body.longitude ?? mechanic.getDataValue('longitude'),
      heading: req.body.heading ?? null,
      accuracyMeters: req.body.accuracyMeters ?? null,
      lastLocationUpdateAt: req.body.latitude != null && req.body.longitude != null ? now : null,
      staleAfterAt: new Date(now.getTime() + 5 * 60 * 1000)
    });

    await appendRealtimeEvent({
      mechanicId: mechanic.getDataValue('id'),
      actorUserId: req.user.userId,
      channel: 'MECHANIC_DISPATCH',
      eventType: 'PARTNER_ONLINE',
      payload: { availabilityState }
    });

    res.json({ message: 'Partner is now online', mechanic, liveState });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to set mechanic online');
  }
};

export const goMechanicOffline = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can update live state' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const now = new Date();
    await mechanic.update({
      isOnline: false,
      availabilityState: 'OFFLINE',
      lastActiveAt: now
    });

    const liveState = await upsertMechanicLiveState(mechanic.getDataValue('id'), {
      isOnline: false,
      availabilityState: 'OFFLINE',
      activeRequestId: null,
      staleAfterAt: now,
      metadata: { notes: req.body.notes || null }
    });

    await appendRealtimeEvent({
      mechanicId: mechanic.getDataValue('id'),
      actorUserId: req.user.userId,
      channel: 'MECHANIC_DISPATCH',
      eventType: 'PARTNER_OFFLINE',
      payload: { notes: req.body.notes || null }
    });

    res.json({ message: 'Partner is now offline', mechanic, liveState });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to set mechanic offline');
  }
};

export const updateMechanicLiveLocation = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can update live location' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const now = new Date();
    const availabilityState = req.body.availabilityState || mechanic.getDataValue('availabilityState') || 'ONLINE_IDLE';
    await mechanic.update({
      isOnline: true,
      availabilityState,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      lastActiveAt: now
    });

    const liveState = await upsertMechanicLiveState(mechanic.getDataValue('id'), {
      isOnline: true,
      availabilityState,
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      accuracyMeters: req.body.accuracyMeters ?? null,
      heading: req.body.heading ?? null,
      lastLocationUpdateAt: now,
      staleAfterAt: new Date(now.getTime() + 5 * 60 * 1000)
    });

    const activeRequestId = Number(liveState.getDataValue('activeRequestId') || 0);
    if (activeRequestId > 0) {
      const activeRequest = await CustomerRequest.findByPk(activeRequestId);
      if (activeRequest) {
        await activeRequest.update({
          currentEtaMinutes: estimateEtaMinutes(activeRequest, mechanic),
          lastLocationUpdateAt: now
        });
      }
    }

    await appendRealtimeEvent({
      mechanicId: mechanic.getDataValue('id'),
      customerRequestId: activeRequestId > 0 ? activeRequestId : null,
      actorUserId: req.user.userId,
      channel: 'CUSTOMER_TRACKING',
      eventType: 'PARTNER_LOCATION_UPDATED',
      payload: {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        availabilityState
      }
    });

    res.json({ message: 'Live location updated', mechanic, liveState });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update mechanic live location');
  }
};

export const listAdminLiveRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await CustomerRequest.findAll({
      where: {
        status: {
          [Op.in]: [
            REQUEST_STATUSES.SUBMITTED,
            REQUEST_STATUSES.UNDER_REVIEW,
            REQUEST_STATUSES.ASSIGNED,
            REQUEST_STATUSES.ACCEPTED,
            REQUEST_STATUSES.EN_ROUTE,
            REQUEST_STATUSES.ARRIVED,
            REQUEST_STATUSES.SERVICE_STARTED,
            REQUEST_STATUSES.NO_RESPONSE,
            REQUEST_STATUSES.REJECTED_BY_MECHANIC
          ]
        }
      } as any,
      include: [
        {
          model: Mechanic,
          attributes: ['id', 'businessName', 'name', 'city', 'state', 'isOnline', 'availabilityState', 'lastActiveAt']
        },
        { model: ServiceType, attributes: ['id', 'name'] },
        { model: RequestDispatchAttempt, include: [{ model: Mechanic, attributes: ['id', 'businessName', 'name'] }] },
        { model: SupportTicket },
        {
          model: User,
          as: 'CustomerUser',
          attributes: ['id', 'email'],
          include: [{ model: CustomerProfile, attributes: ['displayName'] }]
        }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.json(requests);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch live requests');
  }
};

export const listAdminLiveMechanics = async (req: AuthRequest, res: Response) => {
  try {
    const mechanics = await Mechanic.findAll({
      where: {
        status: 'Approved'
      },
      include: [{ model: MechanicLiveState }],
      order: [['updatedAt', 'DESC']]
    });

    res.json(mechanics);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch live mechanics');
  }
};

export const overrideRequestDispatch = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const overrideType = String(req.body.overrideType || (req.body.mechanicId ? 'MANUAL_REASSIGN' : 'LOCK_DISPATCH'));
    const reason = String(req.body.reason || '').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const mechanicId = parseMechanicId(req.body.mechanicId);
    let mechanic: any = null;

    if (req.body.mechanicId != null && !mechanicId) {
      return res.status(400).json({ error: 'Valid mechanicId is required when overriding to a mechanic' });
    }

    if (mechanicId) {
      mechanic = await Mechanic.findByPk(mechanicId);
      if (!mechanic) {
        return res.status(404).json({ error: 'Mechanic not found' });
      }

      await RequestAssignment.create({
        customerRequestId: requestId,
        mechanicId,
        assignedByUserId: req.user?.userId || null,
        status: REQUEST_STATUSES.ASSIGNED,
        notes: notes || reason
      });

      await createDispatchAttempt({
        customerRequestId: requestId,
        mechanicId,
        dispatchMode: 'ADMIN_OVERRIDE',
        attemptStatus: 'DISPATCH_LOCKED',
        notes: notes || reason,
        metadata: { overrideType }
      });
    }

    await DispatchOverride.create({
      customerRequestId: requestId,
      mechanicId: mechanicId ?? null,
      overriddenByUserId: req.user?.userId || null,
      overrideType,
      reason,
      notes,
      metadata: {
        previousMechanicId: requestRecord.getDataValue('mechanicId'),
        dispatchStatusBefore: requestRecord.getDataValue('dispatchStatus')
      }
    });

    await requestRecord.update({
      mechanicId: mechanicId ?? requestRecord.getDataValue('mechanicId'),
      dispatchStatus: mechanicId ? 'DISPATCH_LOCKED' : (overrideType === 'FORCE_NO_SUPPLY' ? 'NO_SUPPLY' : 'DISPATCH_LOCKED'),
      lastDispatchAt: new Date(),
      currentEtaMinutes: mechanic ? estimateEtaMinutes(requestRecord, mechanic) : requestRecord.getDataValue('currentEtaMinutes'),
      adminNotes: [requestRecord.getDataValue('adminNotes'), notes || reason].filter(Boolean).join('\n')
    });

    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: 'DISPATCH_OVERRIDE',
      actorType: 'ADMIN',
      actorUserId: req.user?.userId || null,
      notes: reason,
      metadata: { overrideType, mechanicId: mechanicId ?? null }
    });

    await appendRealtimeEvent({
      customerRequestId: requestId,
      mechanicId: mechanicId ?? null,
      actorUserId: req.user?.userId || null,
      channel: 'ADMIN_OPS',
      eventType: 'DISPATCH_OVERRIDE',
      payload: { overrideType, reason, mechanicId: mechanicId ?? null }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Dispatch override applied', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to override dispatch');
  }
};

export const escalateSupportTicket = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const ticket = await SupportTicket.create({
      customerRequestId: requestId,
      raisedByUserId: req.user?.userId || null,
      assignedToUserId: req.body.assignedToUserId ?? null,
      source: 'ADMIN',
      ticketType: 'LIVE_SUPPORT',
      status: 'OPEN',
      priority: req.body.priority || 'NORMAL',
      subject: String(req.body.subject || '').trim(),
      description: req.body.description ? String(req.body.description).trim() : null,
      metadata: {
        requestStatus: requestRecord.getDataValue('status'),
        dispatchStatus: requestRecord.getDataValue('dispatchStatus')
      }
    });

    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: 'SUPPORT_ESCALATED',
      actorType: 'ADMIN',
      actorUserId: req.user?.userId || null,
      notes: ticket.getDataValue('subject'),
      metadata: { supportTicketId: ticket.getDataValue('id'), priority: ticket.getDataValue('priority') }
    });

    await appendRealtimeEvent({
      customerRequestId: requestId,
      mechanicId: requestRecord.getDataValue('mechanicId'),
      actorUserId: req.user?.userId || null,
      channel: 'ADMIN_OPS',
      eventType: 'SUPPORT_ESCALATED',
      payload: { supportTicketId: ticket.getDataValue('id'), priority: ticket.getDataValue('priority') }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: 'Support ticket escalated', ticket, request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to escalate support ticket');
  }
};

export const createOrUpdateMechanicQuote = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can create quotes' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('mechanicId') !== mechanic.getDataValue('id')) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const currentStatus = requestRecord.getDataValue('status');
    if (![REQUEST_STATUSES.ACCEPTED, REQUEST_STATUSES.EN_ROUTE, REQUEST_STATUSES.ARRIVED, REQUEST_STATUSES.SERVICE_STARTED].includes(currentStatus)) {
      return res.status(400).json({ error: `Quotes are not available in status ${currentStatus}` });
    }

    const lineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];
    const normalizedItems = lineItems.map((item: any) => {
      const quantity = toMoney(item.quantity || 1);
      const unitAmount = toMoney(item.unitAmount);
      const totalAmount = toMoney(quantity * unitAmount);
      return {
        label: String(item.label || '').trim(),
        category: String(item.category || 'LABOR').trim(),
        quantity,
        unitAmount,
        totalAmount,
        description: item.description ? String(item.description).trim() : null
      };
    });

    const subtotalAmount = toMoney(normalizedItems.reduce((sum: number, item: {
      label: string;
      category: string;
      quantity: number;
      unitAmount: number;
      totalAmount: number;
      description: string | null;
    }) => sum + item.totalAmount, 0));
    const taxAmount = toMoney(req.body.taxAmount);
    const feeAmount = toMoney(req.body.feeAmount);
    const totalAmount = toMoney(subtotalAmount + taxAmount + feeAmount);
    const pricingMode = String(req.body.pricingMode || 'QUOTE_REQUIRED').trim();
    const notes = req.body.notes ? String(req.body.notes).trim() : null;

    const existingQuote = await RequestQuote.findOne({
      where: { customerRequestId: requestId },
      order: [['createdAt', 'DESC']]
    });

    if (existingQuote && existingQuote.getDataValue('status') === QUOTE_STATUSES.APPROVED) {
      return res.status(400).json({ error: 'Approved quotes cannot be edited in the current phase.' });
    }

    const savedQuote = await sequelize.transaction(async (transaction) => {
      const quote = existingQuote
        ? await existingQuote.update({
            mechanicId: mechanic.getDataValue('id'),
            status: QUOTE_STATUSES.SUBMITTED,
            pricingMode,
            currencyCode: 'INR',
            subtotalAmount,
            taxAmount,
            feeAmount,
            totalAmount,
            notes,
            submittedAt: new Date(),
            rejectedAt: null,
            approvedAt: null,
            customerDecisionNotes: null,
          }, { transaction })
        : await RequestQuote.create({
            customerRequestId: requestId,
            mechanicId: mechanic.getDataValue('id'),
            status: QUOTE_STATUSES.SUBMITTED,
            pricingMode,
            currencyCode: 'INR',
            subtotalAmount,
            taxAmount,
            feeAmount,
            totalAmount,
            notes,
            submittedAt: new Date(),
          }, { transaction });

      await RequestQuoteLineItem.destroy({ where: { requestQuoteId: quote.getDataValue('id') }, transaction });
      for (const item of normalizedItems) {
        await RequestQuoteLineItem.create({
          requestQuoteId: quote.getDataValue('id'),
          ...item
        }, { transaction });
      }

      await requestRecord.update({
        pricingMode,
        quoteStatus: QUOTE_STATUSES.SUBMITTED,
        paymentStatus: PAYMENT_STATUSES.NOT_READY,
        finalAmount: totalAmount
      }, { transaction });

      return quote;
    });

    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: existingQuote ? 'QUOTE_UPDATED' : 'QUOTE_SUBMITTED',
      actorType: 'MECHANIC',
      actorUserId: req.user.userId,
      notes: notes || `${pricingMode} quote submitted for INR ${totalAmount.toFixed(2)}`,
      metadata: { pricingMode, totalAmount, requestQuoteId: savedQuote.getDataValue('id') }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: existingQuote ? 'Quote updated' : 'Quote submitted', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to save mechanic quote');
  }
};

export const getCustomerRequestQuote = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can access quotes' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('customerUserId') !== req.user.userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const quote = await getLatestQuoteForRequest(requestId);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch request quote');
  }
};

const handleCustomerQuoteDecision = async (req: AuthRequest, res: Response, decision: 'approve' | 'reject') => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can update quote decisions' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('customerUserId') !== req.user.userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const quote = await RequestQuote.findOne({
      where: { customerRequestId: requestId },
      order: [['createdAt', 'DESC']]
    });
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (quote.getDataValue('status') !== QUOTE_STATUSES.SUBMITTED) {
      return res.status(400).json({ error: `Quote cannot be ${decision}d from status ${quote.getDataValue('status')}` });
    }

    const notes = req.body.notes ? String(req.body.notes).trim() : null;
    const approved = decision === 'approve';

    await quote.update({
      status: approved ? QUOTE_STATUSES.APPROVED : QUOTE_STATUSES.REJECTED,
      approvedAt: approved ? new Date() : null,
      rejectedAt: approved ? null : new Date(),
      customerDecisionNotes: notes
    });

    await requestRecord.update({
      quoteStatus: approved ? QUOTE_STATUSES.APPROVED : QUOTE_STATUSES.REJECTED,
      paymentStatus: approved ? PAYMENT_STATUSES.PENDING : PAYMENT_STATUSES.NOT_READY,
      finalAmount: quote.getDataValue('totalAmount')
    });

    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: approved ? 'QUOTE_APPROVED' : 'QUOTE_REJECTED',
      actorType: 'CUSTOMER',
      actorUserId: req.user.userId,
      notes: notes || (approved ? 'Customer approved the quote.' : 'Customer rejected the quote.'),
      metadata: { requestQuoteId: quote.getDataValue('id') }
    });

    const enriched = await loadRequestForOps(requestId);
    res.json({ message: approved ? 'Quote approved' : 'Quote rejected', request: enriched });
  } catch (error) {
    handleControllerError(req, res, error, `Failed to ${decision} request quote`);
  }
};

export const customerApproveRequestQuote = async (req: AuthRequest, res: Response) => handleCustomerQuoteDecision(req, res, 'approve');
export const customerRejectRequestQuote = async (req: AuthRequest, res: Response) => handleCustomerQuoteDecision(req, res, 'reject');

export const initiateCustomerPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can initiate payments' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('customerUserId') !== req.user.userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const quote = await RequestQuote.findOne({
      where: { customerRequestId: requestId },
      order: [['createdAt', 'DESC']]
    });
    if (!quote || quote.getDataValue('status') !== QUOTE_STATUSES.APPROVED) {
      return res.status(400).json({ error: 'An approved quote is required before payment in the current phase.' });
    }

    const existingPayment = await PaymentTransaction.findOne({
      where: { customerRequestId: requestId },
      order: [['createdAt', 'DESC']]
    });
    if (existingPayment && existingPayment.getDataValue('paymentStatus') === PAYMENT_STATUSES.COMPLETED) {
      return res.json({ message: 'Payment already recorded', payment: existingPayment });
    }

    const amount = toMoney(quote.getDataValue('totalAmount'));
    const transactionReference = `RRQ-${requestId}-${Date.now()}`;
    const paymentMethod = req.body.paymentMethod ? String(req.body.paymentMethod).trim() : 'MANUAL_CAPTURE';
    const isMockFailure = paymentMethod === 'MOCK_FAILURE';
    const paymentStatus = isMockFailure ? PAYMENT_STATUSES.FAILED : PAYMENT_STATUSES.COMPLETED;

    const payment = await PaymentTransaction.create({
      customerRequestId: requestId,
      requestQuoteId: quote.getDataValue('id'),
      paymentStatus,
      provider: 'ROADRESQ_MANUAL_READY',
      paymentMethod,
      amount,
      currencyCode: 'INR',
      transactionReference,
      gatewayPayload: {
        mode: 'mock-readiness',
        outcome: isMockFailure ? 'failure' : 'success',
        recordedAt: new Date().toISOString()
      },
      paidAt: isMockFailure ? null : new Date()
    });

    await requestRecord.update({
      paymentStatus,
      finalAmount: amount
    });

    await appendTimelineEvent({
      customerRequestId: requestId,
      eventType: isMockFailure ? 'PAYMENT_FAILED' : 'PAYMENT_RECORDED',
      actorType: 'CUSTOMER',
      actorUserId: req.user.userId,
      notes: isMockFailure
        ? `Mock payment failure recorded for INR ${amount.toFixed(2)} via ${paymentMethod}`
        : `Mock payment readiness recorded for INR ${amount.toFixed(2)} via ${paymentMethod}`,
      metadata: { paymentTransactionId: payment.getDataValue('id'), transactionReference }
    });

    res.json({
      message: isMockFailure ? 'Mock payment failure recorded' : 'Payment readiness recorded',
      payment
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to initiate customer payment');
  }
};

export const getCustomerPaymentStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can access payment status' });
    }

    const requestId = parseRequestId(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await CustomerRequest.findByPk(requestId);
    if (!requestRecord || requestRecord.getDataValue('customerUserId') !== req.user.userId) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const payments = await PaymentTransaction.findAll({
      where: { customerRequestId: requestId },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      requestId,
      paymentStatus: requestRecord.getDataValue('paymentStatus'),
      finalAmount: requestRecord.getDataValue('finalAmount'),
      payments
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch payment status');
  }
};

export const listAdminPaymentIssues = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await CustomerRequest.findAll({
      where: {
        [Op.or]: [
          { quoteStatus: QUOTE_STATUSES.REJECTED },
          { paymentStatus: PAYMENT_STATUSES.FAILED },
          { paymentStatus: PAYMENT_STATUSES.PENDING }
        ]
      } as any,
      include: [
        { model: Mechanic, attributes: ['id', 'businessName', 'name'] },
        {
          model: User,
          as: 'CustomerUser',
          attributes: ['id', 'email'],
          include: [{ model: CustomerProfile, attributes: ['displayName'] }]
        }
      ],
      order: [['updatedAt', 'DESC']]
    });

    res.json(requests);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch admin payment issues');
  }
};

export const listAdminSupportTickets = async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await SupportTicket.findAll({
      include: [
        {
          model: CustomerRequest,
          include: [
            { model: Mechanic, attributes: ['id', 'businessName', 'name'] },
            {
              model: User,
              as: 'CustomerUser',
              attributes: ['id', 'email'],
              include: [{ model: CustomerProfile, attributes: ['displayName'] }]
            }
          ]
        },
        { model: User, as: 'RaisedByUser', attributes: ['id', 'email', 'name'] },
        { model: User, as: 'AssignedToUser', attributes: ['id', 'email', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(tickets);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch support tickets');
  }
};

export const updateAdminSupportTicket = async (req: AuthRequest, res: Response) => {
  try {
    const ticketId = Number.parseInt(String(req.params.id || ''), 10);
    if (!Number.isInteger(ticketId) || ticketId <= 0) {
      return res.status(400).json({ error: 'Invalid support ticket id' });
    }

    const ticket = await SupportTicket.findByPk(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Support ticket not found' });
    }

    const nextStatus = req.body.status ? String(req.body.status).trim() : ticket.getDataValue('status');
    const assignedToUserId = req.body.assignedToUserId == null
      ? ticket.getDataValue('assignedToUserId')
      : Number.parseInt(String(req.body.assignedToUserId), 10) || null;

    await ticket.update({
      status: nextStatus,
      priority: req.body.priority ? String(req.body.priority).trim() : ticket.getDataValue('priority'),
      assignedToUserId,
      description: req.body.description ? String(req.body.description).trim() : ticket.getDataValue('description'),
      resolvedAt: nextStatus === 'RESOLVED' ? new Date() : null,
      metadata: {
        ...(ticket.getDataValue('metadata') || {}),
        updatedByUserId: req.user?.userId || null,
        resolutionNote: req.body.resolutionNote ? String(req.body.resolutionNote).trim() : undefined
      }
    });

    const refreshed = await SupportTicket.findByPk(ticketId, {
      include: [
        {
          model: CustomerRequest,
          include: [
            { model: Mechanic, attributes: ['id', 'businessName', 'name'] },
            {
              model: User,
              as: 'CustomerUser',
              attributes: ['id', 'email'],
              include: [{ model: CustomerProfile, attributes: ['displayName'] }]
            }
          ]
        },
        { model: User, as: 'RaisedByUser', attributes: ['id', 'email', 'name'] },
        { model: User, as: 'AssignedToUser', attributes: ['id', 'email', 'name'] }
      ]
    });

    res.json({ message: 'Support ticket updated', ticket: refreshed });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update support ticket');
  }
};
