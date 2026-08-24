import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class CustomerFunnelSnapshot extends Model {}

CustomerFunnelSnapshot.init(
  {
    metricDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    requestStarted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    requestSubmitted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    requestAssigned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    requestAccepted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    serviceStarted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    serviceCompleted: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    quoteApproved: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    paymentRecorded: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    repeatRequestCreated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'CustomerFunnelSnapshot' }
);
