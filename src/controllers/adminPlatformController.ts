import { Op } from 'sequelize';
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  ActivityLog,
  AnalyticsEvent,
  CustomerRequest,
  PaymentTransaction,
  PayoutSettlement,
  RequestDispatchAttempt,
  SupportTicket,
  User,
  VerificationRequest,
  Review,
  Mechanic,
} from '../models';
import { handleControllerError } from '../utils/controller';

const safeParseJson = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const hoursAgo = (value: number) => {
  const date = new Date();
  date.setHours(date.getHours() - value);
  return date;
};

export const getAdminAutomationOverview = async (req: AuthRequest, res: Response) => {
  try {
    const [
      requests,
      supportTickets,
      settlements,
      paymentFailures,
      dispatchAttempts,
      verificationRequests,
      analyticsEvents,
    ] = await Promise.all([
      CustomerRequest.findAll({
        attributes: [
          'id',
          'status',
          'dispatchStatus',
          'quoteStatus',
          'paymentStatus',
          'updatedAt',
          'lastDispatchAt',
          'acceptedAt',
          'currentEtaMinutes',
        ],
      }),
      SupportTicket.findAll({
        attributes: ['id', 'status', 'priority', 'createdAt', 'updatedAt'],
      }),
      PayoutSettlement.findAll({
        attributes: ['id', 'status', 'createdAt', 'processedAt'],
      }),
      PaymentTransaction.findAll({
        attributes: ['id', 'paymentStatus', 'createdAt', 'updatedAt'],
      }),
      RequestDispatchAttempt.findAll({
        attributes: ['id', 'customerRequestId', 'attemptStatus', 'createdAt'],
      }),
      VerificationRequest.findAll({
        attributes: ['id', 'status', 'createdAt'],
      }),
      AnalyticsEvent.findAll({
        attributes: ['id', 'eventType', 'createdAt'],
        where: { createdAt: { [Op.gte]: hoursAgo(48) } },
      }),
    ]);

    const requestMap = new Map<number, number>();
    dispatchAttempts.forEach((attempt: any) => {
      const key = Number(attempt.getDataValue('customerRequestId'));
      requestMap.set(key, (requestMap.get(key) || 0) + 1);
    });

    const requestsPlain = requests.map((item: any) => item.get({ plain: true }));
    const supportPlain = supportTickets.map((item: any) => item.get({ plain: true }));
    const settlementsPlain = settlements.map((item: any) => item.get({ plain: true }));
    const paymentPlain = paymentFailures.map((item: any) => item.get({ plain: true }));
    const verificationPlain = verificationRequests.map((item: any) => item.get({ plain: true }));
    const eventsPlain = analyticsEvents.map((item: any) => item.get({ plain: true }));

    const metrics = {
      partnerMatching: requestsPlain.filter((item) => ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'SERVICE_STARTED', 'SERVICE_COMPLETED'].includes(String(item.status))).length,
      reDispatch: Array.from(requestMap.values()).filter((count) => count > 1).length,
      requestTimeout: requestsPlain.filter((item) => String(item.status) === 'ASSIGNING' && item.lastDispatchAt && new Date(item.lastDispatchAt).getTime() < hoursAgo(1).getTime()).length,
      noPartnerFound: requestsPlain.filter((item) => String(item.dispatchStatus) === 'NO_SUPPLY').length,
      partnerCancellation: requestsPlain.filter((item) => ['REJECTED_BY_MECHANIC', 'SERVICE_CANCELLED'].includes(String(item.status))).length,
      customerCancellation: requestsPlain.filter((item) => String(item.status) === 'CANCELLED_BY_CUSTOMER').length,
      partnerNoShow: requestsPlain.filter((item) => String(item.status) === 'MECHANIC_NO_SHOW').length,
      customerNoResponse: requestsPlain.filter((item) => String(item.status) === 'CUSTOMER_NO_RESPONSE').length,
      paymentFailure: paymentPlain.filter((item) => String(item.paymentStatus) === 'PAYMENT_FAILED').length,
      quoteExpiry: requestsPlain.filter((item) => String(item.quoteStatus) === 'QUOTE_SUBMITTED' && new Date(item.updatedAt).getTime() < hoursAgo(24).getTime()).length,
      refundProcessing: paymentPlain.filter((item) => String(item.paymentStatus) === 'REFUND_PENDING' || String(item.paymentStatus) === 'REFUND_PROCESSING').length,
      supportEscalation: supportPlain.filter((item) => ['HIGH', 'CRITICAL'].includes(String(item.priority)) && !['RESOLVED', 'CLOSED'].includes(String(item.status))).length,
      fraudFlagging: supportPlain.filter((item) => String(item.priority) === 'CRITICAL').length,
      kycReminders: verificationPlain.filter((item) => String(item.status) === 'Pending').length,
      documentExpiry: 0,
      settlementCalculation: settlementsPlain.filter((item) => ['PENDING', 'PROCESSING'].includes(String(item.status))).length,
      notificationTriggering: eventsPlain.filter((item) => String(item.eventType).includes('REQUEST_') || String(item.eventType).includes('PAYMENT_') || String(item.eventType).includes('SUPPORT_')).length,
      slaBreaches: requestsPlain.filter((item) => String(item.status) === 'EN_ROUTE' && item.acceptedAt && item.currentEtaMinutes != null && new Date(item.acceptedAt).getTime() < new Date(Date.now() - ((Number(item.currentEtaMinutes) + 15) * 60 * 1000)).getTime()).length,
    };

    res.json({
      generatedAt: new Date().toISOString(),
      metrics,
      recentSignals: [
        { label: 'Open high-priority support', value: metrics.supportEscalation, tone: metrics.supportEscalation > 0 ? 'warning' : 'normal' },
        { label: 'No-supply requests', value: metrics.noPartnerFound, tone: metrics.noPartnerFound > 0 ? 'warning' : 'normal' },
        { label: 'Pending settlements', value: metrics.settlementCalculation, tone: metrics.settlementCalculation > 0 ? 'info' : 'normal' },
        { label: 'Quote expiry risk', value: metrics.quoteExpiry, tone: metrics.quoteExpiry > 0 ? 'warning' : 'normal' },
      ],
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch automation overview');
  }
};

export const getAdminFraudSignals = async (req: AuthRequest, res: Response) => {
  try {
    const [requests, payments, reviews, users, mechanics] = await Promise.all([
      CustomerRequest.findAll({
        attributes: ['id', 'customerUserId', 'mechanicId', 'issueSummary', 'addressText', 'status', 'createdAt', 'updatedAt', 'finalAmount'],
      }),
      PaymentTransaction.findAll({
        attributes: ['id', 'customerRequestId', 'paymentStatus', 'amount', 'transactionReference', 'createdAt'],
      }),
      Review.findAll({
        attributes: ['id', 'mechanicId', 'ratingTimeliness', 'ratingFairness', 'ratingRecommendation', 'createdAt', 'status'],
      }),
      User.findAll({
        attributes: ['id', 'email', 'username', 'createdAt'],
      }),
      Mechanic.findAll({
        attributes: ['id', 'businessName', 'name', 'createdById', 'city', 'status'],
      }),
    ]);

    const requestRows = requests.map((item: any) => item.get({ plain: true }));
    const paymentRows = payments.map((item: any) => item.get({ plain: true }));
    const reviewRows = reviews.map((item: any) => item.get({ plain: true }));
    const userRows = users.map((item: any) => item.get({ plain: true }));
    const mechanicRows = mechanics.map((item: any) => item.get({ plain: true }));

    const flags: Array<Record<string, unknown>> = [];

    const customerCancelMap = new Map<number, number>();
    const mechanicCancelMap = new Map<number, number>();
    const duplicateRequestGroups = new Map<string, any[]>();
    const paymentMap = new Map<number, any[]>();
    const emailMap = new Map<string, any[]>();
    const reviewMap = new Map<number, any[]>();

    requestRows.forEach((request) => {
      if (request.customerUserId && String(request.status) === 'CANCELLED_BY_CUSTOMER') {
        customerCancelMap.set(Number(request.customerUserId), (customerCancelMap.get(Number(request.customerUserId)) || 0) + 1);
      }
      if (request.mechanicId && ['REJECTED_BY_MECHANIC', 'SERVICE_CANCELLED', 'MECHANIC_NO_SHOW'].includes(String(request.status))) {
        mechanicCancelMap.set(Number(request.mechanicId), (mechanicCancelMap.get(Number(request.mechanicId)) || 0) + 1);
      }
      const key = `${request.customerUserId || 'x'}|${String(request.issueSummary || '').trim().toLowerCase()}|${String(request.addressText || '').trim().toLowerCase()}`;
      duplicateRequestGroups.set(key, [...(duplicateRequestGroups.get(key) || []), request]);
    });

    paymentRows.forEach((payment) => {
      paymentMap.set(Number(payment.customerRequestId), [...(paymentMap.get(Number(payment.customerRequestId)) || []), payment]);
    });

    userRows.forEach((user) => {
      const key = String(user.email || '').trim().toLowerCase();
      if (!key) return;
      emailMap.set(key, [...(emailMap.get(key) || []), user]);
    });

    reviewRows.forEach((review) => {
      const key = Number(review.mechanicId || 0);
      if (!key) return;
      reviewMap.set(key, [...(reviewMap.get(key) || []), review]);
    });

    customerCancelMap.forEach((count, customerUserId) => {
      if (count >= 3) {
        flags.push({
          entityType: 'CUSTOMER',
          entityId: customerUserId,
          riskScore: Math.min(95, 40 + count * 10),
          signal: 'Repeated cancellations',
          reason: `${count} customer-side cancellations detected`,
        });
      }
    });

    mechanicCancelMap.forEach((count, mechanicId) => {
      if (count >= 3) {
        const mechanic = mechanicRows.find((item) => Number(item.id) === mechanicId);
        flags.push({
          entityType: 'PARTNER',
          entityId: mechanicId,
          riskScore: Math.min(95, 45 + count * 10),
          signal: 'Repeated partner cancellation',
          reason: `${mechanic?.businessName || mechanic?.name || `Mechanic #${mechanicId}`} has ${count} cancellation or no-show signals`,
        });
      }
    });

    duplicateRequestGroups.forEach((items) => {
      if (items.length < 2) return;
      const sorted = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const withinWindow = new Date(sorted[sorted.length - 1].createdAt).getTime() - new Date(sorted[0].createdAt).getTime() <= 60 * 60 * 1000;
      if (withinWindow) {
        flags.push({
          entityType: 'REQUEST',
          entityId: sorted[0].id,
          riskScore: 72,
          signal: 'Duplicate request pattern',
          reason: `${items.length} similar requests created in a short time window`,
        });
      }
    });

    paymentMap.forEach((items, customerRequestId) => {
      const completed = items.filter((item) => String(item.paymentStatus) === 'PAYMENT_COMPLETED');
      if (completed.length > 1) {
        flags.push({
          entityType: 'PAYMENT',
          entityId: customerRequestId,
          riskScore: 88,
          signal: 'Duplicate completed payments',
          reason: `${completed.length} completed payments found for request #${customerRequestId}`,
        });
      }
    });

    emailMap.forEach((items, email) => {
      if (items.length > 1) {
        flags.push({
          entityType: 'ACCOUNT',
          entityId: items[0].id,
          riskScore: 70,
          signal: 'Duplicate email accounts',
          reason: `${items.length} accounts share email ${email}`,
        });
      }
    });

    reviewMap.forEach((items, mechanicId) => {
      if (items.length < 5) return;
      const approved = items.filter((item) => String(item.status) === 'Approved');
      if (approved.length < 5) return;
      const allPerfect = approved.every((item) =>
        Number(item.ratingTimeliness) === 5 &&
        Number(item.ratingFairness) === 5 &&
        Number(item.ratingRecommendation) === 5
      );
      if (allPerfect) {
        flags.push({
          entityType: 'REVIEW',
          entityId: mechanicId,
          riskScore: 60,
          signal: 'Suspicious perfect review cluster',
          reason: `${approved.length} approved reviews appear uniformly perfect`,
        });
      }
    });

    const summary = {
      highRisk: flags.filter((item) => Number(item.riskScore) >= 80).length,
      mediumRisk: flags.filter((item) => Number(item.riskScore) >= 60 && Number(item.riskScore) < 80).length,
      lowRisk: flags.filter((item) => Number(item.riskScore) < 60).length,
      repeatedCustomerCancellations: Array.from(customerCancelMap.values()).filter((value) => value >= 3).length,
      repeatedPartnerCancellations: Array.from(mechanicCancelMap.values()).filter((value) => value >= 3).length,
      duplicateRequests: flags.filter((item) => item.signal === 'Duplicate request pattern').length,
      duplicatePayments: flags.filter((item) => item.signal === 'Duplicate completed payments').length,
    };

    res.json({
      generatedAt: new Date().toISOString(),
      summary,
      flags: flags.sort((left, right) => Number(right.riskScore) - Number(left.riskScore)).slice(0, 50),
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch fraud signals');
  }
};

export const getAdminNotificationEngine = async (req: AuthRequest, res: Response) => {
  try {
    const [requests, payments, tickets, events, logs] = await Promise.all([
      CustomerRequest.findAll({
        attributes: ['id', 'status', 'dispatchStatus', 'updatedAt', 'createdAt']
      }),
      PaymentTransaction.findAll({
        attributes: ['id', 'customerRequestId', 'paymentStatus', 'createdAt', 'updatedAt']
      }),
      SupportTicket.findAll({
        attributes: ['id', 'status', 'priority', 'source', 'updatedAt', 'createdAt']
      }),
      AnalyticsEvent.findAll({
        attributes: ['id', 'eventType', 'createdAt'],
        where: { createdAt: { [Op.gte]: hoursAgo(72) } }
      }),
      ActivityLog.findAll({
        attributes: ['id', 'action', 'details', 'createdAt'],
        where: {
          action: {
            [Op.in]: ['ADMIN_NOTIFICATION_RETRY', 'ADMIN_AUTOMATION_RULE_UPDATED', 'ADMIN_FRAUD_REVIEW']
          }
        },
        order: [['createdAt', 'DESC']],
        limit: 100
      })
    ]);

    const rows = [
      {
        notificationKey: 'request-assignment',
        title: 'Request assignment notification',
        audience: 'Customer',
        channel: 'push / whatsapp',
        health: requests.some((item: any) => ['ASSIGNED', 'ACCEPTED'].includes(String(item.getDataValue('status')))) ? 'ACTIVE' : 'QUIET',
        retryEligible: true,
        duplicateCount: requests.filter((item: any) => String(item.getDataValue('dispatchStatus')) === 'AUTO_REASSIGNING').length,
        lastTriggeredAt: requests[0]?.getDataValue('updatedAt') || null
      },
      {
        notificationKey: 'partner-payment-update',
        title: 'Partner settlement updates',
        audience: 'Partner',
        channel: 'in-app / sms',
        health: payments.some((item: any) => String(item.getDataValue('paymentStatus')).includes('PAYMENT')) ? 'ACTIVE' : 'QUIET',
        retryEligible: true,
        duplicateCount: payments.filter((item: any) => String(item.getDataValue('paymentStatus')) === 'PAYMENT_FAILED').length,
        lastTriggeredAt: payments[0]?.getDataValue('updatedAt') || payments[0]?.getDataValue('createdAt') || null
      },
      {
        notificationKey: 'support-escalation',
        title: 'Support escalation alerts',
        audience: 'Ops',
        channel: 'email / whatsapp',
        health: tickets.some((item: any) => ['HIGH', 'CRITICAL'].includes(String(item.getDataValue('priority')))) ? 'BUSY' : 'QUIET',
        retryEligible: true,
        duplicateCount: tickets.filter((item: any) => ['HIGH', 'CRITICAL'].includes(String(item.getDataValue('priority')))).length,
        lastTriggeredAt: tickets[0]?.getDataValue('updatedAt') || null
      }
    ];

    const retryLogMap = new Map<string, number>();
    logs.forEach((log: any) => {
      const details = safeParseJson(log.getDataValue('details'));
      if (!details?.notificationKey) return;
      retryLogMap.set(String(details.notificationKey), (retryLogMap.get(String(details.notificationKey)) || 0) + 1);
    });

    const history = events.slice(0, 25).map((event: any) => {
      const eventName = String(event.getDataValue('eventType'));
      const dedupeKey = eventName.startsWith('REQUEST_') ? 'request-flow' : eventName.startsWith('PAYMENT_') ? 'payment-flow' : 'support-flow';
      return {
        id: `event-${event.getDataValue('id')}`,
        eventName,
        dedupeKey,
        audience: eventName.startsWith('PAYMENT_') ? 'Customer / Partner' : eventName.startsWith('SUPPORT_') ? 'Ops' : 'Customer',
        status: retryLogMap.get(dedupeKey) ? 'RETRIED' : 'DELIVERED',
        retryEligible: true,
        retryCount: retryLogMap.get(dedupeKey) || 0,
        createdAt: event.getDataValue('createdAt')
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        activeFlows: rows.filter((row) => row.health === 'ACTIVE' || row.health === 'BUSY').length,
        retryBacklog: history.filter((item) => item.status !== 'DELIVERED').length,
        duplicateRisk: rows.reduce((sum, row) => sum + Number(row.duplicateCount || 0), 0),
      },
      rows,
      history
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch notification engine');
  }
};

export const retryAdminNotification = async (req: AuthRequest, res: Response) => {
  try {
    await ActivityLog.create({
      action: 'ADMIN_NOTIFICATION_RETRY',
      details: JSON.stringify({
        notificationKey: String(req.body.notificationKey || '').trim(),
        reason: req.body.reason ? String(req.body.reason).trim() : null,
        userId: req.user?.userId || null
      })
    });

    res.json({ message: 'Notification retry queued' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to retry notification');
  }
};

export const getAdminAutomationRules = async (req: AuthRequest, res: Response) => {
  try {
    const [overview, logs] = await Promise.all([
      Promise.resolve(null),
      ActivityLog.findAll({
        attributes: ['id', 'action', 'details', 'createdAt'],
        where: { action: 'ADMIN_AUTOMATION_RULE_UPDATED' } as any,
        order: [['createdAt', 'DESC']],
        limit: 50
      })
    ]);

    const baseRules = [
      {
        ruleKey: 'dispatch-timeout-reassign',
        eventName: 'REQUEST_ASSIGNMENT_TIMEOUT',
        conditionSummary: 'Assigned request has no partner acceptance within timeout window',
        actionSummary: 'Start re-dispatch and raise admin visibility',
        ownerRole: 'Operations',
        enabled: true,
        timeoutMinutes: 5,
        maxRetries: 2,
        notes: 'Core marketplace safety net for Uber/Rapido-style fast response.'
      },
      {
        ruleKey: 'quote-aging-followup',
        eventName: 'QUOTE_PENDING_TOO_LONG',
        conditionSummary: 'Submitted quote remains undecided beyond SLA',
        actionSummary: 'Remind customer and flag support if aging further',
        ownerRole: 'Support',
        enabled: true,
        timeoutMinutes: 30,
        maxRetries: 1,
        notes: 'Useful for roadside urgency and conversion recovery.'
      },
      {
        ruleKey: 'high-risk-payment-review',
        eventName: 'PAYMENT_DUPLICATE_PATTERN',
        conditionSummary: 'Duplicate or suspicious payment completion pattern detected',
        actionSummary: 'Create fraud review task and freeze auto-refund',
        ownerRole: 'Risk',
        enabled: true,
        timeoutMinutes: 0,
        maxRetries: 0,
        notes: 'Review-first, not automatic banning.'
      }
    ];

    const overrideMap = new Map<string, Record<string, unknown>>();
    logs.forEach((log: any) => {
      const details = safeParseJson(log.getDataValue('details'));
      if (details?.ruleKey && !overrideMap.has(String(details.ruleKey))) {
        overrideMap.set(String(details.ruleKey), details);
      }
    });

    const rules = baseRules.map((rule) => ({
      ...rule,
      ...(overrideMap.get(rule.ruleKey) || {})
    }));

    res.json({
      generatedAt: new Date().toISOString(),
      overview,
      rules,
      recentChanges: logs.map((log: any) => ({
        id: log.getDataValue('id'),
        action: log.getDataValue('action'),
        details: safeParseJson(log.getDataValue('details')),
        createdAt: log.getDataValue('createdAt')
      }))
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch automation rules');
  }
};

export const updateAdminAutomationRule = async (req: AuthRequest, res: Response) => {
  try {
    await ActivityLog.create({
      action: 'ADMIN_AUTOMATION_RULE_UPDATED',
      details: JSON.stringify({
        ...req.body,
        updatedByUserId: req.user?.userId || null
      })
    });

    res.json({ message: 'Automation rule updated', rule: req.body });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update automation rule');
  }
};

export const reviewAdminFraudSignal = async (req: AuthRequest, res: Response) => {
  try {
    await ActivityLog.create({
      action: 'ADMIN_FRAUD_REVIEW',
      details: JSON.stringify({
        entityType: req.body.entityType,
        entityId: req.body.entityId,
        decision: req.body.decision,
        assigneeRole: req.body.assigneeRole || null,
        notes: req.body.notes || null,
        reviewedByUserId: req.user?.userId || null
      })
    });

    res.json({ message: 'Fraud review action recorded' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to record fraud review');
  }
};
