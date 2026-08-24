import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RequestDispatchAttempt extends Model {}

RequestDispatchAttempt.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    dispatchMode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MANUAL',
    },
    attemptStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'DISPATCHING',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    responseAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'RequestDispatchAttempt' }
);
