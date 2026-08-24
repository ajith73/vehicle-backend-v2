import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class CustomerSubscription extends Model {}

CustomerSubscription.init(
  {
    customerUserId: { type: DataTypes.INTEGER, allowNull: false },
    subscriptionPlanId: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ACTIVE' },
    subscriptionTier: { type: DataTypes.STRING, allowNull: false, defaultValue: 'MEMBER' },
    priceAmount: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    startsAt: { type: DataTypes.DATE, allowNull: false },
    endsAt: { type: DataTypes.DATE, allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: true },
  },
  { sequelize, modelName: 'CustomerSubscription' }
);
