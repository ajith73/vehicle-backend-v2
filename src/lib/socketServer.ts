import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { ensureActiveUser, verifyAuthToken } from '../middleware/authMiddleware';
import { getMechanicForUser, getMechanicJobByIdForMechanic, getMechanicJobsForMechanicId, getRequestForCustomerUser } from '../controllers/helpers/requestOperations.shared';
import {
  findMechanicForUserId,
  getAdminLiveMechanicsSnapshot,
  getAdminLiveRequestsSnapshot,
  getAdminSettlementsSnapshot,
  getCustomerNotificationsSnapshot,
  getCustomerSupportTicketsSnapshot,
  getMechanicEarningsSnapshot,
  getMechanicNotificationsSnapshot,
  getMechanicSupportTicketsSnapshot
} from './realtimeSnapshotService';

type SocketUser = {
  userId: number;
  role: string;
};

type SubscribePayload = {
  endpoint?: string;
};

let io: SocketIOServer | null = null;

const customerRequestRoom = (customerUserId: number, requestId: number) => `customer-request:${customerUserId}:${requestId}`;
const mechanicJobsRoom = (mechanicId: number) => `mechanic-jobs:${mechanicId}`;
const mechanicJobDetailRoom = (mechanicId: number, requestId: number) => `mechanic-job:${mechanicId}:${requestId}`;
const adminLiveRequestsRoom = () => 'admin-live-requests';
const adminLiveMechanicsRoom = () => 'admin-live-mechanics';
const customerNotificationsRoom = (customerUserId: number) => `customer-notifications:${customerUserId}`;
const customerSupportRoom = (customerUserId: number) => `customer-support:${customerUserId}`;
const mechanicNotificationsRoom = (mechanicId: number) => `mechanic-notifications:${mechanicId}`;
const mechanicSupportRoom = (mechanicId: number) => `mechanic-support:${mechanicId}`;
const mechanicEarningsRoom = (mechanicId: number) => `mechanic-earnings:${mechanicId}`;
const adminSettlementsRoom = () => 'admin-settlements';
const adminSupportRoom = () => 'admin-support';

const parsePositiveInt = (value: string | undefined) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getSocketUser = (socket: Socket) => socket.data.user as SocketUser | undefined;
const isAdminRole = (role: string) => ['Admin', 'Super Admin'].includes(role);

const resolveSubscription = async (socket: Socket, payload: SubscribePayload) => {
  const endpoint = String(payload.endpoint || '').trim();
  const user = getSocketUser(socket);
  if (!endpoint || !user) {
    throw new Error('Invalid realtime subscription');
  }

  const customerRequestMatch = endpoint.match(/^\/customer\/requests\/(\d+)\/stream$/);
  if (customerRequestMatch) {
    if (user.role.toUpperCase() !== 'CUSTOMER') {
      throw new Error('Only customer accounts can subscribe to request updates');
    }

    const requestId = parsePositiveInt(customerRequestMatch[1]);
    if (!requestId) {
      throw new Error('Invalid request id');
    }

    const requestRecord = await getRequestForCustomerUser(requestId, user.userId);
    if (!requestRecord) {
      throw new Error('Request not found');
    }

    return {
      room: customerRequestRoom(user.userId, requestId),
      event: 'request:update',
      snapshot: requestRecord
    };
  }

  if (endpoint === '/mechanic/jobs/stream') {
    if (user.role !== 'Mechanic') {
      throw new Error('Only mechanic accounts can subscribe to jobs updates');
    }

    const mechanic = await getMechanicForUser(user.userId);
    if (!mechanic) {
      throw new Error('Mechanic profile not found for this account');
    }

    const mechanicId = Number(mechanic.getDataValue('id'));
    const jobs = await getMechanicJobsForMechanicId(mechanicId);

    return {
      room: mechanicJobsRoom(mechanicId),
      event: 'jobs:update',
      snapshot: jobs
    };
  }

  if (endpoint === '/admin/live/requests') {
    if (!isAdminRole(user.role)) {
      throw new Error('Only admin accounts can subscribe to live request updates');
    }

    return {
      room: adminLiveRequestsRoom(),
      event: 'admin:live-requests:update',
      snapshot: await getAdminLiveRequestsSnapshot()
    };
  }

  if (endpoint === '/admin/live/mechanics') {
    if (!isAdminRole(user.role)) {
      throw new Error('Only admin accounts can subscribe to live mechanic updates');
    }

    return {
      room: adminLiveMechanicsRoom(),
      event: 'admin:live-mechanics:update',
      snapshot: await getAdminLiveMechanicsSnapshot()
    };
  }

  if (endpoint === '/admin/finance/settlements') {
    if (!isAdminRole(user.role)) {
      throw new Error('Only admin accounts can subscribe to settlement updates');
    }

    return {
      room: adminSettlementsRoom(),
      event: 'admin:settlements:update',
      snapshot: await getAdminSettlementsSnapshot()
    };
  }

  if (endpoint === '/customer/notifications') {
    if (user.role.toUpperCase() !== 'CUSTOMER') {
      throw new Error('Only customer accounts can subscribe to notifications');
    }

    return {
      room: customerNotificationsRoom(user.userId),
      event: 'customer:notifications:update',
      snapshot: await getCustomerNotificationsSnapshot(user.userId)
    };
  }

  if (endpoint === '/customer/support/tickets') {
    if (user.role.toUpperCase() !== 'CUSTOMER') {
      throw new Error('Only customer accounts can subscribe to support tickets');
    }

    return {
      room: customerSupportRoom(user.userId),
      event: 'customer:support:update',
      snapshot: await getCustomerSupportTicketsSnapshot(user.userId)
    };
  }

  const mechanicJobDetailMatch = endpoint.match(/^\/mechanic\/jobs\/(\d+)\/stream$/);
  if (mechanicJobDetailMatch) {
    if (user.role !== 'Mechanic') {
      throw new Error('Only mechanic accounts can subscribe to job updates');
    }

    const requestId = parsePositiveInt(mechanicJobDetailMatch[1]);
    if (!requestId) {
      throw new Error('Invalid request id');
    }

    const mechanic = await getMechanicForUser(user.userId);
    if (!mechanic) {
      throw new Error('Mechanic profile not found for this account');
    }

    const mechanicId = Number(mechanic.getDataValue('id'));
    const job = await getMechanicJobByIdForMechanic(requestId, mechanicId);
    if (!job) {
      throw new Error('Job not found');
    }

    return {
      room: mechanicJobDetailRoom(mechanicId, requestId),
      event: 'job:update',
      snapshot: job
    };
  }

  if (endpoint === '/mechanic/notifications') {
    if (user.role !== 'Mechanic') {
      throw new Error('Only mechanic accounts can subscribe to notifications');
    }

    const mechanic = await findMechanicForUserId(user.userId);
    if (!mechanic) {
      throw new Error('Mechanic profile not found for this account');
    }

    const mechanicId = Number(mechanic.getDataValue('id'));
    return {
      room: mechanicNotificationsRoom(mechanicId),
      event: 'mechanic:notifications:update',
      snapshot: await getMechanicNotificationsSnapshot(mechanicId, user.userId)
    };
  }

  if (endpoint === '/mechanic/support/tickets') {
    if (user.role !== 'Mechanic') {
      throw new Error('Only mechanic accounts can subscribe to support tickets');
    }

    const mechanic = await findMechanicForUserId(user.userId);
    if (!mechanic) {
      throw new Error('Mechanic profile not found for this account');
    }

    const mechanicId = Number(mechanic.getDataValue('id'));
    return {
      room: mechanicSupportRoom(mechanicId),
      event: 'mechanic:support:update',
      snapshot: await getMechanicSupportTicketsSnapshot(mechanicId, user.userId)
    };
  }

  if (endpoint === '/mechanic/earnings') {
    if (user.role !== 'Mechanic') {
      throw new Error('Only mechanic accounts can subscribe to earnings');
    }

    const mechanic = await findMechanicForUserId(user.userId);
    if (!mechanic) {
      throw new Error('Mechanic profile not found for this account');
    }

    const mechanicId = Number(mechanic.getDataValue('id'));
    const snapshot = await getMechanicEarningsSnapshot(mechanicId);
    if (!snapshot) {
      throw new Error('Mechanic earnings not found');
    }

    return {
      room: mechanicEarningsRoom(mechanicId),
      event: 'mechanic:earnings:update',
      snapshot
    };
  }

  throw new Error('Unsupported realtime endpoint');
};

export const initializeSocketServer = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  io.use(async (socket, next) => {
    try {
      const authToken = typeof socket.handshake.auth?.token === 'string'
        ? socket.handshake.auth.token
        : typeof socket.handshake.query?.token === 'string'
          ? socket.handshake.query.token
          : '';

      if (!authToken) {
        return next(new Error('Unauthorized: No token provided'));
      }

      const decoded = verifyAuthToken(authToken);
      const user = await ensureActiveUser(decoded.userId);
      if (!user) {
        return next(new Error('Unauthorized: User does not exist or was deleted'));
      }

      socket.data.user = {
        userId: decoded.userId,
        role: decoded.role
      } satisfies SocketUser;

      next();
    } catch (error: any) {
      next(new Error(error?.message || 'Unauthorized: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('realtime:subscribe', async (payload: SubscribePayload, callback?: (response: { ok: boolean; error?: string }) => void) => {
      try {
        const subscription = await resolveSubscription(socket, payload);
        await socket.join(subscription.room);
        socket.emit(subscription.event, subscription.snapshot);
        callback?.({ ok: true });
      } catch (error: any) {
        callback?.({ ok: false, error: error?.message || 'Failed to subscribe to realtime updates' });
      }
    });
  });

  return io;
};

export const getSocketServer = () => io;

export const socketRooms = {
  customerRequestRoom,
  mechanicJobsRoom,
  mechanicJobDetailRoom,
  adminLiveRequestsRoom,
  adminLiveMechanicsRoom,
  customerNotificationsRoom,
  customerSupportRoom,
  mechanicNotificationsRoom,
  mechanicSupportRoom,
  mechanicEarningsRoom,
  adminSettlementsRoom,
  adminSupportRoom
};
