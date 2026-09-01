import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { PartnerEarning, PayoutSettlement, Mechanic, CustomerRequest, PaymentTransaction } from '../models';
import { handleControllerError } from '../utils/controller';
import {
  getAdminSettlementsSnapshot,
  getMechanicEarningsSnapshot,
  pushAdminSettlementsSnapshot,
  pushMechanicEarningsSnapshot,
  pushMechanicNotificationsSnapshot
} from '../lib/realtimeSnapshotService';

export const getMechanicEarnings = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'Mechanic') {
      return res.status(403).json({ error: 'Only mechanics can view earnings' });
    }

    const mechanic = await Mechanic.findOne({ where: { createdById: req.user.userId } });
    if (!mechanic) {
      return res.status(404).json({ error: 'Mechanic profile not found' });
    }
    res.json(await getMechanicEarningsSnapshot(Number(mechanic.getDataValue('id'))));
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
