import { Response } from 'express';
import { CustomerRequest } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';
import {
  emitCustomerRequestUpdate,
  emitMechanicJobDetailUpdate,
  emitMechanicJobsUpdate,
  initializeSse,
  subscribeCustomerRequest,
  subscribeMechanicJobDetail,
  subscribeMechanicJobList,
} from '../lib/realtimeStreams';
import { getMechanicForUser, getMechanicJobByIdForMechanic, getMechanicJobsForMechanicId, getRequestForCustomerUser } from './requestOperationsController';

const parsePositiveInt = (value: string | string[] | undefined) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(normalized || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const sendSnapshot = (res: Response, event: string, payload: unknown) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const streamCustomerRequestStatus = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role?.toUpperCase() !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Only customer accounts can open request status streams' });
    }

    const requestId = parsePositiveInt(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const requestRecord = await getRequestForCustomerUser(requestId, req.user.userId);
    if (!requestRecord) {
      return res.status(404).json({ error: 'Request not found' });
    }

    initializeSse(res);
    subscribeCustomerRequest(req.user.userId, requestId, res);
    sendSnapshot(res, 'request:update', requestRecord);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to open customer request stream');
  }
};

export const streamMechanicJobs = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can open jobs streams' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const mechanicId = mechanic.getDataValue('id');
    const jobs = await getMechanicJobsForMechanicId(mechanicId);

    initializeSse(res);
    subscribeMechanicJobList(mechanicId, res);
    sendSnapshot(res, 'jobs:update', jobs);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to open mechanic jobs stream');
  }
};

export const streamMechanicJobDetail = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can open job streams' });
    }

    const requestId = parsePositiveInt(req.params.id);
    if (!requestId) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const mechanic = await getMechanicForUser(req.user.userId);
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const mechanicId = mechanic.getDataValue('id');
    const job = await getMechanicJobByIdForMechanic(requestId, mechanicId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    initializeSse(res);
    subscribeMechanicJobDetail(mechanicId, requestId, res);
    sendSnapshot(res, 'job:update', job);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to open mechanic job stream');
  }
};

export const pushCustomerRequestSnapshot = async (requestId: number) => {
  const requestRecord = await CustomerRequest.findByPk(requestId);
  if (!requestRecord) return;

  const customerUserId = Number(requestRecord.getDataValue('customerUserId') || 0);
  if (!customerUserId) return;

  const snapshot = await getRequestForCustomerUser(requestId, customerUserId);
  if (!snapshot) return;
  emitCustomerRequestUpdate(customerUserId, requestId, snapshot);
};

export const pushMechanicSnapshots = async (mechanicId?: number | null, requestId?: number | null) => {
  if (!mechanicId || mechanicId <= 0) return;

  const jobs = await getMechanicJobsForMechanicId(mechanicId);
  emitMechanicJobsUpdate(mechanicId, jobs);

  if (!requestId || requestId <= 0) return;

  const job = await getMechanicJobByIdForMechanic(requestId, mechanicId);
  if (job) {
    emitMechanicJobDetailUpdate(mechanicId, requestId, job);
  }
};
