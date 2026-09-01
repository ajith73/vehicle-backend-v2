import { Op } from 'sequelize';
import {
  CustomerProfile,
  CustomerRequest,
  Mechanic,
  MechanicLiveState,
  PartnerEarning,
  PaymentTransaction,
  PayoutSettlement,
  RequestDispatchAttempt,
  ServiceType,
  SupportTicket,
  User
} from '../models';
import { REQUEST_STATUSES } from '../constants/requestLifecycle';
import { emitSocketRoomEvent } from './realtimeStreams';
import { socketRooms } from './socketServer';

const liveAdminStatuses = [
  REQUEST_STATUSES.SUBMITTED,
  REQUEST_STATUSES.UNDER_REVIEW,
  REQUEST_STATUSES.ASSIGNED,
  REQUEST_STATUSES.ACCEPTED,
  REQUEST_STATUSES.EN_ROUTE,
  REQUEST_STATUSES.ARRIVED,
  REQUEST_STATUSES.SERVICE_STARTED,
  REQUEST_STATUSES.NO_RESPONSE,
  REQUEST_STATUSES.REJECTED_BY_MECHANIC
];

const toNumber = (value: unknown) => Number(value || 0);

export const findMechanicForUserId = async (userId: number) =>
  Mechanic.findOne({ where: { createdById: userId } });

export const getAdminLiveRequestsSnapshot = async () =>
  CustomerRequest.findAll({
    where: {
      status: {
        [Op.in]: liveAdminStatuses
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

export const getAdminLiveMechanicsSnapshot = async () =>
  Mechanic.findAll({
    where: {
      status: 'Approved'
    },
    attributes: [
      'id',
      'businessName',
      'name',
      'phone',
      'city',
      'state',
      'isOnline',
      'availabilityState',
      'latitude',
      'longitude',
      'trustScore',
      'isTrustedPartner',
      'priorityDispatchEligible',
      'serviceRadius',
      'updatedAt',
      'lastActiveAt'
    ],
    include: [{
      model: MechanicLiveState,
      attributes: [
        'id',
        'mechanicId',
        'isOnline',
        'availabilityState',
        'latitude',
        'longitude',
        'heading',
        'accuracyMeters',
        'lastLocationUpdateAt',
        'staleAfterAt',
        'activeRequestId'
      ]
    }],
    order: [['lastActiveAt', 'DESC'], ['updatedAt', 'DESC']]
  });

export const getCustomerNotificationsSnapshot = async (userId: number) => {
  const profile = await CustomerProfile.findOne({ where: { userId } });
  const [requests, supportTickets, payments] = await Promise.all([
    CustomerRequest.findAll({
      where: { customerUserId: userId },
      include: [{ model: ServiceType, attributes: ['id', 'name'] }],
      order: [['updatedAt', 'DESC']],
      limit: 8
    }),
    SupportTicket.findAll({
      include: [{ model: CustomerRequest, attributes: ['id', 'customerUserId'] }],
      order: [['updatedAt', 'DESC']],
      limit: 8
    }),
    PaymentTransaction.findAll({
      include: [{
        model: CustomerRequest,
        attributes: ['id', 'customerUserId'],
        where: { customerUserId: userId }
      }],
      order: [['createdAt', 'DESC']],
      limit: 8
    })
  ]);

  const notifications: Array<Record<string, unknown>> = [];

  requests.forEach((request: any) => {
    const status = String(request.getDataValue('status') || '');
    const serviceName = request.ServiceType?.name || request.getDataValue('issueSummary') || 'Service request';

    if (['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'SERVICE_STARTED'].includes(status)) {
      notifications.push({
        id: `request-live-${request.getDataValue('id')}`,
        type: 'ALERT',
        title: `${serviceName} is in progress`,
        message: `Your request REQ-${request.getDataValue('id')} is currently ${status.replace(/_/g, ' ').toLowerCase()}.`,
        time: request.getDataValue('updatedAt'),
        read: false
      });
    }

    if (status === 'SERVICE_COMPLETED') {
      notifications.push({
        id: `request-complete-${request.getDataValue('id')}`,
        type: 'SUCCESS',
        title: 'Service completed',
        message: `${serviceName} for REQ-${request.getDataValue('id')} was completed successfully.`,
        time: request.getDataValue('updatedAt'),
        read: true
      });
    }
  });

  payments.forEach((payment: any) => {
    if (String(payment.getDataValue('paymentStatus')) === 'PAYMENT_COMPLETED') {
      notifications.push({
        id: `payment-${payment.getDataValue('id')}`,
        type: 'SUCCESS',
        title: 'Payment recorded',
        message: `Payment of INR ${Number(payment.getDataValue('amount') || 0).toFixed(2)} has been recorded successfully.`,
        time: payment.getDataValue('updatedAt') || payment.getDataValue('createdAt'),
        read: true
      });
    }
  });

  supportTickets
    .filter((ticket: any) => ticket.CustomerRequest?.customerUserId === userId)
    .forEach((ticket: any) => {
      notifications.push({
        id: `support-${ticket.getDataValue('id')}`,
        type: ticket.getDataValue('status') === 'RESOLVED' ? 'SUCCESS' : 'WARNING',
        title: ticket.getDataValue('subject') || 'Support ticket update',
        message: `Support ticket TKT-${ticket.getDataValue('id')} is ${String(ticket.getDataValue('status') || 'OPEN').toLowerCase().replace(/_/g, ' ')}.`,
        time: ticket.getDataValue('updatedAt') || ticket.getDataValue('createdAt'),
        read: ticket.getDataValue('status') === 'RESOLVED'
      });
    });

  if (!profile?.getDataValue('phone')) {
    notifications.push({
      id: 'profile-completion',
      type: 'SYSTEM',
      title: 'Complete your profile',
      message: 'Add your phone number to speed up emergency roadside coordination.',
      time: new Date().toISOString(),
      read: false
    });
  }

  return notifications
    .sort((left, right) => new Date(String(right.time)).getTime() - new Date(String(left.time)).getTime())
    .slice(0, 20);
};

export const getCustomerSupportTicketsSnapshot = async (userId: number) =>
  SupportTicket.findAll({
    include: [{
      model: CustomerRequest,
      attributes: ['id', 'customerUserId', 'issueSummary', 'status', 'createdAt'],
      where: { customerUserId: userId }
    }],
    order: [['updatedAt', 'DESC']]
  });

export const getMechanicNotificationsSnapshot = async (mechanicId: number, userId: number) => {
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
          { raisedByUserId: userId },
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
      return !request || Number(request.mechanicId) === mechanicId || Number(ticket.getDataValue('raisedByUserId')) === userId;
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
    type: settlement.getDataValue('status') === 'PROCESSED' || settlement.getDataValue('status') === 'COMPLETED' ? 'SUCCESS' : 'SYSTEM',
    title: settlement.getDataValue('status') === 'PROCESSED' || settlement.getDataValue('status') === 'COMPLETED' ? 'Settlement processed' : 'Settlement update',
    message: `Settlement #${settlement.getDataValue('id')} • INR ${Number(settlement.getDataValue('totalAmount') || 0).toFixed(2)} • ${settlement.getDataValue('status')}`,
    time: settlement.getDataValue('processedAt') || settlement.getDataValue('createdAt'),
    read: false,
    source: 'settlement'
  }));

  return [...requestNotifications, ...supportNotifications, ...settlementNotifications]
    .sort((left, right) => new Date(String(right.time)).getTime() - new Date(String(left.time)).getTime())
    .slice(0, 30);
};

export const getMechanicSupportTicketsSnapshot = async (mechanicId: number, userId: number) => {
  const tickets = await SupportTicket.findAll({
    where: {
      [Op.or]: [
        { raisedByUserId: userId },
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
    order: [['updatedAt', 'DESC']]
  });

  return tickets.filter((ticket: any) => {
    const request = ticket.getDataValue('CustomerRequest');
    return !request || Number(request.mechanicId) === mechanicId || Number(ticket.getDataValue('raisedByUserId')) === userId;
  });
};

export const getMechanicEarningsSnapshot = async (mechanicId: number) => {
  const mechanic = await Mechanic.findByPk(mechanicId);
  if (!mechanic) {
    return null;
  }

  const earnings = await PartnerEarning.findAll({
    where: { mechanicId },
    include: [
      { model: CustomerRequest, attributes: ['id', 'status', 'issueSummary', 'vehicleLabel'] },
      { model: PayoutSettlement, attributes: ['id', 'status', 'processedAt', 'bankReference', 'totalAmount', 'notes', 'createdAt'] },
      { model: PaymentTransaction, attributes: ['id', 'paymentStatus', 'paymentMethod', 'amount', 'paidAt', 'transactionReference'] }
    ],
    order: [['createdAt', 'DESC']]
  });

  const settlements = await PayoutSettlement.findAll({
    where: { mechanicId },
    include: [{ model: PartnerEarning }],
    order: [['createdAt', 'DESC']]
  });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const netForWindow = (dateBoundary: Date) =>
    earnings
      .filter((item: any) => new Date(item.getDataValue('createdAt')) >= dateBoundary)
      .reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('netEarningAmount')), 0);

  const grossTotal = earnings.reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('grossAmount')), 0);
  const platformFeeTotal = earnings.reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('platformFeeDeduction')), 0);
  const netTotal = earnings.reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('netEarningAmount')), 0);
  const pendingTotal = earnings
    .filter((item: any) => String(item.getDataValue('status')) !== 'SETTLED')
    .reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('netEarningAmount')), 0);
  const settledTotal = earnings
    .filter((item: any) => String(item.getDataValue('status')) === 'SETTLED')
    .reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('netEarningAmount')), 0);
  const cashCollected = earnings
    .filter((item: any) => String(item.PaymentTransaction?.paymentMethod || '').toUpperCase().includes('CASH'))
    .reduce((sum: number, item: any) => sum + toNumber(item.PaymentTransaction?.amount || item.getDataValue('grossAmount')), 0);
  const onlinePayments = earnings
    .filter((item: any) => item.PaymentTransaction && !String(item.PaymentTransaction?.paymentMethod || '').toUpperCase().includes('CASH'))
    .reduce((sum: number, item: any) => sum + toNumber(item.PaymentTransaction?.amount || item.getDataValue('grossAmount')), 0);
  const refundAdjustments = earnings
    .filter((item: any) => String(item.getDataValue('notes') || '').toLowerCase().includes('refund'))
    .reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('netEarningAmount')), 0);
  const cancellationCompensation = earnings
    .filter((item: any) => {
      const requestStatus = String(item.CustomerRequest?.status || '');
      const notes = String(item.getDataValue('notes') || '').toLowerCase();
      return requestStatus.includes('CANCELLED') || notes.includes('cancellation');
    })
    .reduce((sum: number, item: any) => sum + toNumber(item.getDataValue('netEarningAmount')), 0);

  const latestSettlement = settlements[0] || null;

  return {
    mechanic: {
      id: mechanic.getDataValue('id'),
      businessName: mechanic.getDataValue('businessName') || mechanic.getDataValue('name'),
      city: mechanic.getDataValue('city')
    },
    summary: {
      today: netForWindow(startOfToday),
      week: netForWindow(startOfWeek),
      month: netForWindow(startOfMonth),
      total: netTotal,
      pending: pendingTotal,
      settled: settledTotal,
      grossEarnings: grossTotal,
      platformFee: platformFeeTotal,
      netEarnings: netTotal,
      cashCollected,
      onlinePayments,
      refundAdjustments,
      cancellationCompensation,
      payoutStatus: latestSettlement?.getDataValue('status') || (pendingTotal > 0 ? 'PENDING' : 'COMPLETED'),
      lastBankReference: latestSettlement?.getDataValue('bankReference') || null
    },
    periodTotals: [
      { period: 'TODAY', totalAmount: netForWindow(startOfToday) },
      { period: 'WEEK', totalAmount: netForWindow(startOfWeek) },
      { period: 'MONTH', totalAmount: netForWindow(startOfMonth) }
    ],
    earnings,
    settlements
  };
};

export const getAdminSettlementsSnapshot = async () =>
  PayoutSettlement.findAll({
    include: [
      { model: Mechanic, attributes: ['id', 'businessName', 'name'] },
      { model: PartnerEarning }
    ],
    order: [['createdAt', 'DESC']]
  });

export const getAdminSupportTicketsSnapshot = async () =>
  SupportTicket.findAll({
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

export const pushAdminLiveRequestsSnapshot = async () => {
  const snapshot = await getAdminLiveRequestsSnapshot();
  emitSocketRoomEvent(socketRooms.adminLiveRequestsRoom(), 'admin:live-requests:update', snapshot);
};

export const pushAdminLiveMechanicsSnapshot = async () => {
  const snapshot = await getAdminLiveMechanicsSnapshot();
  emitSocketRoomEvent(socketRooms.adminLiveMechanicsRoom(), 'admin:live-mechanics:update', snapshot);
};

export const pushCustomerNotificationsSnapshot = async (userId: number) => {
  const snapshot = await getCustomerNotificationsSnapshot(userId);
  emitSocketRoomEvent(socketRooms.customerNotificationsRoom(userId), 'customer:notifications:update', snapshot);
};

export const pushCustomerSupportTicketsSnapshot = async (userId: number) => {
  const snapshot = await getCustomerSupportTicketsSnapshot(userId);
  emitSocketRoomEvent(socketRooms.customerSupportRoom(userId), 'customer:support:update', snapshot);
};

export const pushMechanicNotificationsSnapshot = async (mechanicId: number, userId: number) => {
  const snapshot = await getMechanicNotificationsSnapshot(mechanicId, userId);
  emitSocketRoomEvent(socketRooms.mechanicNotificationsRoom(mechanicId), 'mechanic:notifications:update', snapshot);
};

export const pushMechanicSupportTicketsSnapshot = async (mechanicId: number, userId: number) => {
  const snapshot = await getMechanicSupportTicketsSnapshot(mechanicId, userId);
  emitSocketRoomEvent(socketRooms.mechanicSupportRoom(mechanicId), 'mechanic:support:update', snapshot);
};

export const pushMechanicEarningsSnapshot = async (mechanicId: number) => {
  const snapshot = await getMechanicEarningsSnapshot(mechanicId);
  if (!snapshot) return;
  emitSocketRoomEvent(socketRooms.mechanicEarningsRoom(mechanicId), 'mechanic:earnings:update', snapshot);
};

export const pushAdminSettlementsSnapshot = async () => {
  const snapshot = await getAdminSettlementsSnapshot();
  emitSocketRoomEvent(socketRooms.adminSettlementsRoom(), 'admin:settlements:update', snapshot);
};

export const pushAdminSupportTicketsSnapshot = async () => {
  const snapshot = await getAdminSupportTicketsSnapshot();
  emitSocketRoomEvent(socketRooms.adminSupportRoom(), 'admin:support:update', snapshot);
};

export const pushAffectedRequestSideSnapshots = async (args: {
  customerRequestId?: number | null;
  mechanicId?: number | null;
}) => {
  const requestId = Number(args.customerRequestId || 0);
  let customerUserId: number | null = null;
  let mechanicId = Number(args.mechanicId || 0) || null;

  if (requestId > 0) {
    const requestRecord = await CustomerRequest.findByPk(requestId, {
      attributes: ['id', 'customerUserId', 'mechanicId']
    });
    if (requestRecord) {
      customerUserId = Number(requestRecord.getDataValue('customerUserId') || 0) || null;
      mechanicId = mechanicId || (Number(requestRecord.getDataValue('mechanicId') || 0) || null);
    }
  }

  const tasks: Array<Promise<unknown>> = [
    pushAdminLiveRequestsSnapshot()
  ];

  if (customerUserId) {
    tasks.push(pushCustomerNotificationsSnapshot(customerUserId));
  }

  if (mechanicId) {
    tasks.push(pushAdminLiveMechanicsSnapshot());
    const mechanic = await Mechanic.findByPk(mechanicId, { attributes: ['id', 'createdById'] });
    const mechanicUserId = mechanic ? Number(mechanic.getDataValue('createdById') || 0) : 0;
    if (mechanicUserId > 0) {
      tasks.push(pushMechanicNotificationsSnapshot(mechanicId, mechanicUserId));
      tasks.push(pushMechanicEarningsSnapshot(mechanicId));
    }
  }

  await Promise.all(tasks);
};
