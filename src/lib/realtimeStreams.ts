import { Response } from 'express';
import { getSocketServer, socketRooms } from './socketServer';

type RealtimeMessage = {
  type: string;
  payload: unknown;
};

type Subscriber = {
  id: string;
  response: Response;
};

const customerRequestSubscribers = new Map<string, Set<Subscriber>>();
const mechanicJobListSubscribers = new Map<string, Set<Subscriber>>();
const mechanicJobDetailSubscribers = new Map<string, Set<Subscriber>>();

const keyOf = (...parts: Array<number | string>) => parts.join(':');

const sendEvent = (response: Response, event: string, payload: unknown) => {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const addSubscriber = (bucket: Map<string, Set<Subscriber>>, key: string, response: Response) => {
  const set = bucket.get(key) || new Set<Subscriber>();
  const subscriber: Subscriber = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    response,
  };

  set.add(subscriber);
  bucket.set(key, set);

  response.on('close', () => {
    const current = bucket.get(key);
    if (!current) return;
    for (const item of current) {
      if (item.id === subscriber.id) {
        current.delete(item);
        break;
      }
    }
    if (!current.size) {
      bucket.delete(key);
    }
  });
};

const broadcast = (bucket: Map<string, Set<Subscriber>>, key: string, message: RealtimeMessage) => {
  const set = bucket.get(key);
  if (!set?.size) return;

  set.forEach((subscriber) => {
    sendEvent(subscriber.response, message.type, message.payload);
  });
};

export const initializeSse = (response: Response) => {
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();
  response.write(': connected\n\n');

  const heartbeat = setInterval(() => {
    response.write(': heartbeat\n\n');
  }, 25000);

  response.on('close', () => {
    clearInterval(heartbeat);
    response.end();
  });
};

export const subscribeCustomerRequest = (customerUserId: number, requestId: number, response: Response) =>
  addSubscriber(customerRequestSubscribers, keyOf(customerUserId, requestId), response);

export const subscribeMechanicJobList = (mechanicId: number, response: Response) =>
  addSubscriber(mechanicJobListSubscribers, keyOf(mechanicId), response);

export const subscribeMechanicJobDetail = (mechanicId: number, requestId: number, response: Response) =>
  addSubscriber(mechanicJobDetailSubscribers, keyOf(mechanicId, requestId), response);

export const emitCustomerRequestUpdate = (customerUserId: number, requestId: number, payload: unknown) => {
  broadcast(customerRequestSubscribers, keyOf(customerUserId, requestId), {
    type: 'request:update',
    payload,
  });

  getSocketServer()?.to(socketRooms.customerRequestRoom(customerUserId, requestId)).emit('request:update', payload);
};

export const emitMechanicJobsUpdate = (mechanicId: number, payload: unknown) => {
  broadcast(mechanicJobListSubscribers, keyOf(mechanicId), {
    type: 'jobs:update',
    payload,
  });

  getSocketServer()?.to(socketRooms.mechanicJobsRoom(mechanicId)).emit('jobs:update', payload);
};

export const emitMechanicJobDetailUpdate = (mechanicId: number, requestId: number, payload: unknown) => {
  broadcast(mechanicJobDetailSubscribers, keyOf(mechanicId, requestId), {
    type: 'job:update',
    payload,
  });

  getSocketServer()?.to(socketRooms.mechanicJobDetailRoom(mechanicId, requestId)).emit('job:update', payload);
};

export const emitSocketRoomEvent = (room: string, event: string, payload: unknown) => {
  getSocketServer()?.to(room).emit(event, payload);
};
