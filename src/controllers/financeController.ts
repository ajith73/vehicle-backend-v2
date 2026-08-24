import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { PartnerEarning, PayoutSettlement, Mechanic, CustomerRequest, PaymentTransaction } from '../models';
import { handleControllerError } from '../utils/controller';

export const getMechanicEarnings = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanics can view earnings' });
    }

    const mechanic = await Mechanic.findOne({ where: { createdById: req.user.userId } });
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found' });
    }

    const earnings = await PartnerEarning.findAll({
      where: { mechanicId: mechanic.getDataValue('id') },
      include: [
        { model: CustomerRequest, attributes: ['id', 'status', 'issueSummary', 'vehicleLabel'] },
        { model: PayoutSettlement, attributes: ['id', 'status', 'processedAt', 'bankReference', 'totalAmount', 'notes', 'createdAt'] },
        { model: PaymentTransaction, attributes: ['id', 'paymentStatus', 'paymentMethod', 'amount', 'paidAt', 'transactionReference'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const settlements = await PayoutSettlement.findAll({
      where: { mechanicId: mechanic.getDataValue('id') },
      include: [{ model: PartnerEarning }],
      order: [['createdAt', 'DESC']]
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const toNumber = (value: unknown) => Number(value || 0);
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

    res.json({
      mechanic: {
        id: mechanic.getDataValue('id'),
        businessName: mechanic.getDataValue('businessName') || mechanic.getDataValue('name'),
        city: mechanic.getDataValue('city'),
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
        lastBankReference: latestSettlement?.getDataValue('bankReference') || null,
      },
      periodTotals: [
        { period: 'TODAY', totalAmount: netForWindow(startOfToday) },
        { period: 'WEEK', totalAmount: netForWindow(startOfWeek) },
        { period: 'MONTH', totalAmount: netForWindow(startOfMonth) },
      ],
      earnings,
      settlements,
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic earnings');
  }
};

export const listAdminSettlements = async (req: AuthRequest, res: Response) => {
  try {
    const settlements = await PayoutSettlement.findAll({
      include: [
        { model: Mechanic, attributes: ['id', 'businessName', 'name'] },
        { model: PartnerEarning }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(settlements);
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

    res.json({ message: 'Settlement processed successfully', settlement });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to process settlement');
  }
};
