import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class PayoutSettlement extends Model {}

PayoutSettlement.init(
  {
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PENDING', // PENDING, PROCESSING, COMPLETED, FAILED
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    currencyCode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INR',
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    processedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    bankReference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'PayoutSettlement',
    tableName: 'PayoutSettlements',
    timestamps: true,
  }
);
