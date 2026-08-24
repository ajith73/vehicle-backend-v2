import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class TrustedPartnerAudit extends Model {}

TrustedPartnerAudit.init(
  {
    mechanicId: { type: DataTypes.INTEGER, allowNull: false },
    changedByUserId: { type: DataTypes.INTEGER, allowNull: true },
    isTrustedPartner: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    partnerTier: { type: DataTypes.STRING, allowNull: true },
    trustScore: { type: DataTypes.FLOAT, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'TrustedPartnerAudit' }
);
