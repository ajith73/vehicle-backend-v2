import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RequestTimelineEvent extends Model {}

RequestTimelineEvent.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fromStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    toStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    actorType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    actorUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  { sequelize, modelName: 'RequestTimelineEvent' }
);
