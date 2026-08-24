import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class AnalyticsEvent extends Model {}

AnalyticsEvent.init(
  {
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    actorType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'SYSTEM',
    },
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    zoneKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, modelName: 'AnalyticsEvent' }
);
