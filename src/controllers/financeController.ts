import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { PartnerEarning, PayoutSettlement, Mechanic, CustomerRequest, PaymentTransaction, RequestQuote } from '../models';
import { handleControllerError } from '../utils/controller';
import {
  getAdminSettlementsSnapshot,
  getMechanicEarningsSnapshot,
  pushAdminSettlementsSnapshot,
  pushMechanicEarningsSnapshot,
  pushMechanicNotificationsSnapshot
} from '../lib/realtimeSnapshotService';

const toMoney = (value: unknown) => Number(Number(value || 0).toFixed(2));

const syncMissingMechanicEarnings = async (mechanicId: number) => {
  const paidRequests = await CustomerRequest.findAll({
    where: {
      mechanicId,
      paymentStatus: 'PAYMENT_COMPLETED'
    } as any,
    attributes: ['id'],
    raw: true
  });

  for (const requestRow of paidRequests) {
    const requestId = Number((requestRow as any).id || 0);
    if (!requestId) {
      continue;
    }

    const existing = await PartnerEarning.findOne({ where: { customerRequestId: requestId } });
    if (existing) {
      continue;
    }

    const [payment, quote] = await Promise.all([
      PaymentTransaction.findOne({
        where: { customerRequestId: requestId, paymentStatus: 'PAYMENT_COMPLETED' } as any,
        order: [['createdAt', 'DESC']]
      }),
      RequestQuote.findOne({
        where: { customerRequestId: requestId },
        order: [['createdAt', 'DESC']]
      })
    ]);

    if (!payment) {
      continue;
    }

    const grossAmount = toMoney(payment.getDataValue('amount'));
    const platformFeeDeduction = toMoney(quote?.getDataValue('feeAmount'));
    const netEarningAmount = Math.max(0, Number((grossAmount - platformFeeDeduction).toFixed(2)));

    await PartnerEarning.create({
      mechanicId,
      customerRequestId: requestId,
      paymentTransactionId: payment.getDataValue('id'),
      grossAmount,
      platformFeeDeduction,
      netEarningAmount,
      currencyCode: String(payment.getDataValue('currencyCode') || 'INR'),
      status: 'PENDING_SETTLEMENT',
      notes: 'Backfilled automatically from completed payment.'
    });
  }
};

export const getMechanicEarnings = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanics can view earnings' });
    }

    const mechanic = await Mechanic.findOne({ where: { createdById: req.user.userId } });
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found' });
    }
    const mechanicId = Number(mechanic.getDataValue('id'));
    await syncMissingMechanicEarnings(mechanicId);
    res.json(await getMechanicEarningsSnapshot(mechanicId));
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic earnings');
  }
};

export const listAdminSettlements = async (req: AuthRequest, res: Response) => {
  try {
    res.json(await getAdminSettlementsSnapshot());
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch settlements');
  }
};

export const processSettlement = async (req: AuthRequest, res: Response) => {
  try {
    const settlementId = req.params.id as string;
    const { status, bankReference, notes } = req.body;

    const settlement = await PayoutSettlement.findByPk(settlementId);
    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    await settlement.update({
      status,
      bankReference: bankReference || null,
      notes: notes || null,
      processedAt: status === 'COMPLETED' ? new Date() : null,
      processedByUserId: req.user?.userId || null
    });

    if (status === 'COMPLETED') {
      await PartnerEarning.update(
        { status: 'SETTLED' },
        { where: { payoutSettlementId: settlement.getDataValue('id') } }
      );
    }

    const mechanicId = Number(settlement.getDataValue('mechanicId') || 0);
    if (mechanicId > 0) {
      const mechanic = await Mechanic.findByPk(mechanicId, { attributes: ['id', 'createdById'] });
      await Promise.all([
        pushAdminSettlementsSnapshot(),
        pushMechanicEarningsSnapshot(mechanicId),
        mechanic ? pushMechanicNotificationsSnapshot(mechanicId, Number(mechanic.getDataValue('createdById'))) : Promise.resolve()
      ]);
    } else {
      await pushAdminSettlementsSnapshot();
    }

    res.json({ message: 'Settlement processed successfully', settlement });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to process settlement');
  }
};
