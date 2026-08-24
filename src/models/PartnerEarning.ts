import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class PartnerEarning extends Model {}

PartnerEarning.init(
  {
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    paymentTransactionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    payoutSettlementId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    grossAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    platformFeeDeduction: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    netEarningAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    currencyCode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INR',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING_SETTLEMENT', // PENDING_SETTLEMENT, PROCESSING, SETTLED, FAILED
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PartnerEarning',
    tableName: 'PartnerEarnings',
    timestamps: true,
  }
);
