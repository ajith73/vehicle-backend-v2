import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ActivityLog extends Model {}
ActivityLog.init(
  {
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'ActivityLog' }
);
