import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class DispatchOverride extends Model {}

DispatchOverride.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    overriddenByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    overrideType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL_REASSIGN',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'DispatchOverride' }
);
