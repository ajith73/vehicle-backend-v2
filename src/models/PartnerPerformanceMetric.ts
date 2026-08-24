import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class PartnerPerformanceMetric extends Model {}

PartnerPerformanceMetric.init(
  {
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    metricDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    onlineHours: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    dispatchAttemptsReceived: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    acceptRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    rejectRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    timeoutRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    completionRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    quoteApprovalRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    paymentLinkedCompletionRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    averageEtaMinutes: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'PartnerPerformanceMetric' }
);
