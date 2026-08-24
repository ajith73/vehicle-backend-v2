import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RealtimeEventLog extends Model {}

RealtimeEventLog.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actorUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    channel: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OPS',
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'RealtimeEventLog' }
);
