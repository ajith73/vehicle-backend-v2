import { Response } from 'express';
import { Op, col, fn, literal } from 'sequelize';
import {
  CustomerProfile,
  CustomerRequest,
  CustomerFunnelSnapshot,
  CustomerSubscription,
  DispatchScoreSnapshot,
  MarketplaceZoneMetric,
  Mechanic,
  PartnerPerformanceMetric,
  PaymentTransaction,
  RequestAssignment,
  RequestQuote,
  Review,
  User,
} from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';

const todayDateOnly = () => new Date().toISOString().slice(0, 10);
const DISPATCH_SCORING_CACHE_TTL_MS = 30 * 1000;

let dispatchScoringCache:
  | {
      expiresAt: number;
      payload: {
        rules: Record<string, unknown>;
        generatedAt: string;
        sampleRequestId: number | null;
        scores: Array<Record<string, unknown>>;
      };
    }
  | null = null;

let partnerPerformanceCache:
  | {
      expiresAt: number;
      payload: Array<Record<string, unknown>>;
    }
  | null = null;

const ratio = (value: number, total: number) => {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
};

const percentile = (value: number, max: number) => {
  if (!max) return 0;
  return Number(Math.min(100, Math.max(0, (value / max) * 100)).toFixed(2));
};

const buildZoneKey = (request: any) => {
  const city = String(request.city || request.addressText || 'Unknown').trim() || 'Unknown';
  const lat = Number(request.latitude || 0);
  const lng = Number(request.longitude || 0);
  return `${city}::${lat.toFixed(1)}:${lng.toFixed(1)}`;
};

const getActiveRules = async () => {
  const latest = await DispatchScoreSnapshot.findOne({
    where: { isActiveRuleSet: true, scoreType: 'RULE_SET' },
    order: [['updatedAt', 'DESC']]
  });

  return latest?.getDataValue('rules') || {
    distanceWeight: 35,
    serviceFitWeight: 15,
    vehicleFitWeight: 10,
    availabilityWeight: 15,
    trustWeight: 10,
    reliabilityWeight: 10,
    responseSpeedWeight: 3,
    premiumEligibilityWeight: 2,
  };
};

const normalizeScore = (parts: number[]) => {
  if (parts.length === 0) return 0;
  return Number(parts.reduce((sum, item) => sum + item, 0).toFixed(2));
};

const toGroupedNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateMechanicScore = async (mechanic: any, requestRecord: any, rules: any) => {
  const assignments = await RequestAssignment.findAll({
    where: { mechanicId: mechanic.getDataValue('id') },
    attributes: ['status']
  });
  const totalAssignments = assignments.length;
  const acceptedAssignments = assignments.filter((item) => item.getDataValue('status') === 'ACCEPTED').length;
  const completedRequests = await CustomerRequest.count({
    where: { mechanicId: mechanic.getDataValue('id'), status: 'SERVICE_COMPLETED' }
  });
  const ratingReviews = await Review.findAll({
    where: { mechanicId: mechanic.getDataValue('id'), status: 'Approved' },
    attributes: ['ratingTimeliness', 'ratingFairness', 'ratingRecommendation']
  });

  const requestService = requestRecord.ServiceType?.name;
  const requestVehicle = requestRecord.VehicleType?.name;
  const serviceFit = requestService && Array.isArray(mechanic.getDataValue('serviceTypes'))
    ? mechanic.getDataValue('serviceTypes').includes(requestService) ? 100 : 0
    : 50;
  const vehicleFit = requestVehicle && Array.isArray(mechanic.getDataValue('vehicleTypes'))
    ? mechanic.getDataValue('vehicleTypes').includes(requestVehicle) ? 100 : 0
    : 50;

  const distanceScore = percentile(Math.max(1, 50 - Number(mechanic.getDataValue('serviceRadius') || 10)), 50);
  const availabilityScore = mechanic.getDataValue('isOnline')
    ? mechanic.getDataValue('availabilityState') === 'ONLINE_IDLE' ? 100 : 65
    : 20;
  const trustScore = mechanic.getDataValue('isTrustedPartner')
    ? Number(mechanic.getDataValue('trustScore') || 85)
    : Number(mechanic.getDataValue('trustScore') || 45);
  const reliabilityScore = ratio(completedRequests, Math.max(totalAssignments, 1));
  const responseSpeedScore = ratio(acceptedAssignments, Math.max(totalAssignments, 1));
  const premiumEligibilityScore = mechanic.getDataValue('priorityDispatchEligible') ? 100 : 35;

  const qualityReviewScore = ratingReviews.length > 0
    ? Number((
      ratingReviews.reduce((sum, review: any) => sum + Number(review.getDataValue('ratingRecommendation') || 0), 0) /
      ratingReviews.length *
      20
    ).toFixed(2))
    : 60;

  const weightedScore = normalizeScore([
    (distanceScore * Number(rules.distanceWeight || 0)) / 100,
    (serviceFit * Number(rules.serviceFitWeight || 0)) / 100,
    (vehicleFit * Number(rules.vehicleFitWeight || 0)) / 100,
    (availabilityScore * Number(rules.availabilityWeight || 0)) / 100,
    (((trustScore + qualityReviewScore) / 2) * Number(rules.trustWeight || 0)) / 100,
    (reliabilityScore * Number(rules.reliabilityWeight || 0)) / 100,
    (responseSpeedScore * Number(rules.responseSpeedWeight || 0)) / 100,
    (premiumEligibilityScore * Number(rules.premiumEligibilityWeight || 0)) / 100,
  ]);

  return {
    mechanicId: mechanic.getDataValue('id'),
    mechanicName: mechanic.getDataValue('businessName') || mechanic.getDataValue('name'),
    score: weightedScore,
    factors: {
      distanceScore,
      serviceFit,
      vehicleFit,
      availabilityScore,
      trustScore,
      reliabilityScore,
      responseSpeedScore,
      premiumEligibilityScore,
      qualityReviewScore,
    }
  };
};

export const getCustomerFunnelAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await CustomerRequest.findAll({
      include: [{ model: User, as: 'CustomerUser', attributes: ['id'], include: [{ model: CustomerProfile, attributes: ['displayName'] }] }]
    });

    const requestSubmitted = requests.length;
    const requestAssigned = requests.filter((item: any) => ['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'CUSTOMER_NO_RESPONSE', 'MECHANIC_NO_SHOW', 'SERVICE_CANCELLED'].includes(item.getDataValue('status'))).length;
    const requestAccepted = requests.filter((item: any) => ['ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'SERVICE_STARTED', 'SERVICE_COMPLETED'].includes(item.getDataValue('status'))).length;
    const serviceStarted = requests.filter((item: any) => ['SERVICE_STARTED', 'SERVICE_COMPLETED'].includes(item.getDataValue('status'))).length;
    const serviceCompleted = requests.filter((item: any) => item.getDataValue('status') === 'SERVICE_COMPLETED').length;
    const quoteApproved = requests.filter((item: any) => item.getDataValue('quoteStatus') === 'QUOTE_APPROVED').length;
    const paymentRecorded = requests.filter((item: any) => item.getDataValue('paymentStatus') === 'PAYMENT_COMPLETED').length;
    const repeatRequestCreated = (() => {
      const counts: Record<string, number> = {};
      requests.forEach((item: any) => {
        const key = String(item.getDataValue('customerUserId'));
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.values(counts).filter((count) => count > 1).length;
    })();

    const requestStarted = requestSubmitted + Math.max(1, Math.round(requestSubmitted * 0.18));
    const snapshotPayload = {
      metricDate: todayDateOnly(),
      city: 'ALL',
      requestStarted,
      requestSubmitted,
      requestAssigned,
      requestAccepted,
      serviceStarted,
      serviceCompleted,
      quoteApproved,
      paymentRecorded,
      repeatRequestCreated,
      metadata: {
        assignmentRate: ratio(requestAssigned, requestSubmitted),
        completionRate: ratio(serviceCompleted, requestSubmitted),
        paymentRate: ratio(paymentRecorded, Math.max(quoteApproved, 1))
      }
    };

    const existing = await CustomerFunnelSnapshot.findOne({ where: { metricDate: snapshotPayload.metricDate, city: 'ALL' } });
    if (existing) await existing.update(snapshotPayload);
    else await CustomerFunnelSnapshot.create(snapshotPayload as any);

    res.json(snapshotPayload);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch customer funnel analytics');
  }
};

export const getPartnerPerformanceAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    if (partnerPerformanceCache && partnerPerformanceCache.expiresAt > Date.now()) {
      return res.json(partnerPerformanceCache.payload);
    }

    const mechanics = await Mechanic.findAll({
      where: { status: 'Approved' },
      attributes: ['id', 'businessName', 'name', 'city', 'isTrustedPartner', 'isOnline', 'lastActiveAt']
    });
    const performanceRows: Array<Record<string, unknown>> = [];
    const mechanicIds = mechanics.map((mechanic) => mechanic.getDataValue('id'));

    if (mechanicIds.length === 0) {
      return res.json([]);
    }

    const [assignmentRows, requestRows, reviewRows] = await Promise.all([
      RequestAssignment.findAll({
        where: { mechanicId: { [Op.in]: mechanicIds } } as any,
        attributes: ['mechanicId', 'status'],
        raw: true
      }),
      CustomerRequest.findAll({
        where: { mechanicId: { [Op.in]: mechanicIds } } as any,
        attributes: ['mechanicId', 'status', 'quoteStatus', 'paymentStatus', 'currentEtaMinutes'],
        raw: true
      }),
      Review.findAll({
        where: {
          mechanicId: { [Op.in]: mechanicIds },
          status: 'Approved'
        } as any,
        attributes: ['mechanicId', 'ratingRecommendation'],
        raw: true
      })
    ]);

    const assignmentMap = new Map<number, { dispatchAttempts: number; accepted: number; rejected: number }>();
    assignmentRows.forEach((row: any) => {
      const mechanicId = Number(row.mechanicId);
      const current = assignmentMap.get(mechanicId) || { dispatchAttempts: 0, accepted: 0, rejected: 0 };
      current.dispatchAttempts += 1;
      if (row.status === 'ACCEPTED') current.accepted += 1;
      if (row.status === 'REJECTED_BY_MECHANIC') current.rejected += 1;
      assignmentMap.set(mechanicId, current);
    });

    const requestMap = new Map<number, {
      totalOwnedRequests: number;
      completed: number;
      quoteApproved: number;
      paymentLinked: number;
      averageEtaMinutes: number | null;
    }>();
    requestRows.forEach((row: any) => {
      const mechanicId = Number(row.mechanicId);
      const current = requestMap.get(mechanicId) || {
        totalOwnedRequests: 0,
        completed: 0,
        quoteApproved: 0,
        paymentLinked: 0,
        averageEtaMinutes: null as number | null
      };
      const etaSamples: number[] = Array.isArray((current as any).__etaSamples) ? (current as any).__etaSamples : [];

      current.totalOwnedRequests += 1;
      if (row.status === 'SERVICE_COMPLETED') current.completed += 1;
      if (row.quoteStatus === 'QUOTE_APPROVED') current.quoteApproved += 1;
      if (row.paymentStatus === 'PAYMENT_COMPLETED') current.paymentLinked += 1;
      if (row.currentEtaMinutes != null && Number.isFinite(Number(row.currentEtaMinutes))) {
        etaSamples.push(Number(row.currentEtaMinutes));
      }

      (current as any).__etaSamples = etaSamples;
      requestMap.set(mechanicId, current);
    });

    requestMap.forEach((value: any) => {
      const etaSamples = Array.isArray(value.__etaSamples) ? value.__etaSamples : [];
      value.averageEtaMinutes = etaSamples.length > 0
        ? Number((etaSamples.reduce((sum: number, item: number) => sum + item, 0) / etaSamples.length).toFixed(2))
        : null;
      delete value.__etaSamples;
    });

    const reviewMap = new Map<number, { total: number; count: number }>();
    reviewRows.forEach((row: any) => {
      const mechanicId = Number(row.mechanicId);
      const current = reviewMap.get(mechanicId) || { total: 0, count: 0 };
      current.total += toGroupedNumber(row.ratingRecommendation);
      current.count += 1;
      reviewMap.set(mechanicId, current);
    });

    for (const mechanic of mechanics) {
      const mechanicId = mechanic.getDataValue('id');
      const assignmentStats = assignmentMap.get(mechanicId) || { dispatchAttempts: 0, accepted: 0, rejected: 0 };
      const requestStats = requestMap.get(mechanicId) || {
        totalOwnedRequests: 0,
        completed: 0,
        quoteApproved: 0,
        paymentLinked: 0,
        averageEtaMinutes: null
      };
      const reviewStats = reviewMap.get(mechanicId) || { total: 0, count: 0 };
      const avgRecommendation = reviewStats.count > 0 ? reviewStats.total / reviewStats.count : 0;
      const dispatchAttempts = assignmentStats.dispatchAttempts;
      const accepted = assignmentStats.accepted;
      const rejected = assignmentStats.rejected;
      const completed = requestStats.completed;
      const totalOwnedRequests = requestStats.totalOwnedRequests;
      const quoteApproved = requestStats.quoteApproved;
      const paymentLinked = requestStats.paymentLinked;

      const onlineHours = mechanic.getDataValue('isOnline') ? 8 : 2;
      const metricPayload = {
        mechanicId,
        metricDate: todayDateOnly(),
        onlineHours,
        dispatchAttemptsReceived: dispatchAttempts,
        acceptRate: ratio(accepted, dispatchAttempts),
        rejectRate: ratio(rejected, dispatchAttempts),
        timeoutRate: ratio(Math.max(dispatchAttempts - accepted - rejected, 0), dispatchAttempts),
        completionRate: ratio(completed, Math.max(totalOwnedRequests, 1)),
        quoteApprovalRate: ratio(quoteApproved, Math.max(totalOwnedRequests, 1)),
        paymentLinkedCompletionRate: ratio(paymentLinked, Math.max(completed, 1)),
        averageEtaMinutes: requestStats.averageEtaMinutes,
        score: Number(((ratio(accepted, dispatchAttempts) * 0.3) + (ratio(completed, Math.max(totalOwnedRequests, 1)) * 0.4) + (ratio(paymentLinked, Math.max(completed, 1)) * 0.2) + (((avgRecommendation ? avgRecommendation * 20 : 60)) * 0.1)).toFixed(2)),
        metadata: {
          trusted: mechanic.getDataValue('isTrustedPartner'),
          city: mechanic.getDataValue('city'),
          lastActiveAt: mechanic.getDataValue('lastActiveAt')
        }
      };

      performanceRows.push({
        mechanicName: mechanic.getDataValue('businessName') || mechanic.getDataValue('name'),
        city: mechanic.getDataValue('city'),
        isTrustedPartner: mechanic.getDataValue('isTrustedPartner'),
        ...metricPayload
      });
    }

    const payload = performanceRows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    partnerPerformanceCache = {
      expiresAt: Date.now() + 30 * 1000,
      payload
    };

    res.json(payload);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch partner performance analytics');
  }
};

export const getMarketplaceZoneAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await CustomerRequest.findAll();
    const onlineMechanics = await Mechanic.count({ where: { isOnline: true, status: 'Approved' } });
    const zoneMap: Record<string, any> = {};

    requests.forEach((request: any) => {
      const zoneKey = buildZoneKey(request.dataValues);
      if (!zoneMap[zoneKey]) {
        zoneMap[zoneKey] = {
          zoneKey,
          city: String(request.getDataValue('addressText') || request.getDataValue('vehicleLabel') || 'Unknown').slice(0, 60) || 'Unknown',
          metricDate: todayDateOnly(),
          requestCount: 0,
          assignedCount: 0,
          completedCount: 0,
          noSupplyCount: 0,
          cancellationCount: 0,
          activeSupplyCount: 0,
          averageEtaMinutes: 0,
          etaSamples: 0,
        };
      }
      const bucket = zoneMap[zoneKey];
      bucket.requestCount += 1;
      if (['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'SERVICE_STARTED', 'SERVICE_COMPLETED'].includes(request.getDataValue('status'))) bucket.assignedCount += 1;
      if (request.getDataValue('status') === 'SERVICE_COMPLETED') bucket.completedCount += 1;
      if (request.getDataValue('dispatchStatus') === 'NO_SUPPLY') bucket.noSupplyCount += 1;
      if (String(request.getDataValue('status') || '').includes('CANCELLED')) bucket.cancellationCount += 1;
      if (request.getDataValue('currentEtaMinutes') != null) {
        bucket.averageEtaMinutes += Number(request.getDataValue('currentEtaMinutes'));
        bucket.etaSamples += 1;
      }
    });

    const metrics = Object.values(zoneMap).map((bucket: any) => {
      const metricPayload = {
        zoneKey: bucket.zoneKey,
        city: bucket.city,
        metricDate: bucket.metricDate,
        requestCount: bucket.requestCount,
        assignedCount: bucket.assignedCount,
        completedCount: bucket.completedCount,
        noSupplyCount: bucket.noSupplyCount,
        cancellationCount: bucket.cancellationCount,
        activeSupplyCount: Math.max(0, Math.round(onlineMechanics / Math.max(Object.keys(zoneMap).length, 1))),
        averageEtaMinutes: bucket.etaSamples ? Number((bucket.averageEtaMinutes / bucket.etaSamples).toFixed(2)) : null,
        metadata: {
          assignmentRate: ratio(bucket.assignedCount, bucket.requestCount),
          completionRate: ratio(bucket.completedCount, bucket.requestCount),
          noSupplyRate: ratio(bucket.noSupplyCount, bucket.requestCount),
        }
      };
      return metricPayload;
    });

    for (const metric of metrics) {
      const existing = await MarketplaceZoneMetric.findOne({ where: { zoneKey: metric.zoneKey, metricDate: metric.metricDate } });
      if (existing) await existing.update(metric as any);
      else await MarketplaceZoneMetric.create(metric as any);
    }

    res.json(metrics.sort((a, b) => b.requestCount - a.requestCount));
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch marketplace zone analytics');
  }
};

export const getFinancialAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await CustomerRequest.findAll({ include: [{ model: Mechanic, attributes: ['city', 'isTrustedPartner'] }] });
    const payments = await PaymentTransaction.findAll();
    const subscriptions = await CustomerSubscription.findAll({ where: { status: 'ACTIVE' } });

    const recordedTransactionValue = payments.reduce((sum: number, payment: any) => sum + Number(payment.getDataValue('amount') || 0), 0);
    const cityTotals: Record<string, number> = {};
    let trustedPartnerContribution = 0;

    requests.forEach((request: any) => {
      const amount = Number(request.getDataValue('finalAmount') || 0);
      const city = request.Mechanic?.city || 'Unknown';
      cityTotals[city] = (cityTotals[city] || 0) + amount;
      if (request.Mechanic?.isTrustedPartner) trustedPartnerContribution += amount;
    });

    const platformFeeRealization = Number((recordedTransactionValue * 0.08).toFixed(2));
    const membershipRevenue = subscriptions.reduce((sum: number, item: any) => sum + Number(item.getDataValue('priceAmount') || 0), 0);
    const repeatCustomerShare = (() => {
      const customerMap: Record<string, number> = {};
      requests.forEach((request: any) => {
        const key = String(request.getDataValue('customerUserId'));
        customerMap[key] = (customerMap[key] || 0) + 1;
      });
      const repeatCustomers = Object.values(customerMap).filter((count) => count > 1).length;
      return ratio(repeatCustomers, Math.max(Object.keys(customerMap).length, 1));
    })();

    res.json({
      recordedTransactionValue: Number(recordedTransactionValue.toFixed(2)),
      platformFeeRealization,
      membershipRevenue: Number(membershipRevenue.toFixed(2)),
      membershipConversion: ratio(subscriptions.length, Math.max(await User.count({ include: [{ model: CustomerProfile }] }), 1)),
      trustedPartnerContribution: Number(trustedPartnerContribution.toFixed(2)),
      repeatCustomerShare,
      cityWiseValue: Object.entries(cityTotals).map(([city, value]) => ({ city, value: Number(value.toFixed(2)) })).sort((a, b) => b.value - a.value)
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch financial analytics');
  }
};

export const getDispatchScoring = async (req: AuthRequest, res: Response) => {
  try {
    if (dispatchScoringCache && dispatchScoringCache.expiresAt > Date.now()) {
      return res.json(dispatchScoringCache.payload);
    }

    const rules = await getActiveRules();
    const requestRecord = await CustomerRequest.findOne({
      where: { mechanicId: { [Op.ne]: null } } as any,
      include: [{ model: Mechanic }, { association: 'ServiceType' as any }, { association: 'VehicleType' as any }],
      order: [['updatedAt', 'DESC']]
    });

    const mechanics = await Mechanic.findAll({ where: { status: 'Approved' }, limit: 8, order: [['updatedAt', 'DESC']] });
    const scores = await Promise.all(
      mechanics.map((mechanic) => calculateMechanicScore(mechanic, requestRecord || {}, rules))
    );

    const payload = {
      rules,
      generatedAt: new Date().toISOString(),
      sampleRequestId: requestRecord?.getDataValue('id') || null,
      scores: scores.sort((a, b) => b.score - a.score)
    };

    dispatchScoringCache = {
      expiresAt: Date.now() + DISPATCH_SCORING_CACHE_TTL_MS,
      payload
    };

    res.json(payload);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch dispatch scoring');
  }
};

export const updateDispatchScoringRules = async (req: AuthRequest, res: Response) => {
  try {
    await DispatchScoreSnapshot.update(
      { isActiveRuleSet: false },
      { where: { scoreType: 'RULE_SET', isActiveRuleSet: true } }
    );

    const record = await DispatchScoreSnapshot.create({
      scoreType: 'RULE_SET',
      score: 100,
      rules: req.body,
      factors: {
        explainable: true,
        changedByUserId: req.user?.userId || null
      },
      isActiveRuleSet: true
    });

    dispatchScoringCache = null;
    partnerPerformanceCache = null;

    res.json({ message: 'Dispatch scoring rules updated', rules: record.getDataValue('rules') });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update dispatch scoring rules');
  }
};

export const getMechanicPerformanceInsights = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanic accounts can access performance insights' });
    }

    const mechanic = await Mechanic.findOne({ where: { createdById: req.user.userId } });
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found for this account' });
    }

    const mechanicId = mechanic.getDataValue('id');
    const metric = await PartnerPerformanceMetric.findOne({
      where: { mechanicId },
      order: [['metricDate', 'DESC']]
    });

    if (!metric) {
      const adminViewReq = { ...req } as AuthRequest;
      await getPartnerPerformanceAnalytics(adminViewReq, {
        json: () => undefined
      } as unknown as Response);
    }

    const latest = await PartnerPerformanceMetric.findOne({
      where: { mechanicId },
      order: [['metricDate', 'DESC']]
    });

    res.json({
      mechanicId,
      mechanicName: mechanic.getDataValue('businessName') || mechanic.getDataValue('name'),
      city: mechanic.getDataValue('city'),
      trusted: mechanic.getDataValue('isTrustedPartner'),
      score: latest?.getDataValue('score') || 0,
      metrics: latest,
      improvements: [
        (latest?.getDataValue('acceptRate') || 0) < 60 ? 'Improve job acceptance speed to raise dispatch rank.' : 'Acceptance is healthy for your current rank.',
        (latest?.getDataValue('completionRate') || 0) < 70 ? 'Complete more assigned jobs to increase reliability score.' : 'Completion reliability is supporting your rank.',
        mechanic.getDataValue('isTrustedPartner') ? 'Trusted partner status is boosting your visibility.' : 'Trusted partner status can further improve your ranking.',
      ]
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic performance insights');
  }
};
