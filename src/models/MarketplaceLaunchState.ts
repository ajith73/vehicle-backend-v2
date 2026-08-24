import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class MarketplaceLaunchState extends Model {}

MarketplaceLaunchState.init(
  {
    scopeType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'CITY',
    },
    scopeSlug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    launchState: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PLANNED',
    },
    effectiveFrom: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    effectiveTo: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pauseReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    supportMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'MarketplaceLaunchState' }
);
