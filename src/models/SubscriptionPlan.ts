import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class SubscriptionPlan extends Model {}

SubscriptionPlan.init(
  {
    name: { type: DataTypes.STRING, allowNull: false },
    tier: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MEMBER' },
    description: { type: DataTypes.TEXT, allowNull: true },
    priceAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    billingCycle: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MONTHLY' },
    platformFeeDiscountPercent: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    prioritySupport: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    priorityDispatch: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    trustedOnlyAccess: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, modelName: 'SubscriptionPlan' }
);
