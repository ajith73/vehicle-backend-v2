import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class CustomerRequest extends Model {}

CustomerRequest.init(
  {
    customerUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    serviceTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    specificServiceId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    vehicleTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    vehicleLabel: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    issueSummary: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    issueDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    addressText: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'SUBMITTED',
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    statusUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    enRouteAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    arrivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    serviceStartedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completionPin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    completionPinGeneratedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completionPinVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    pricingMode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    quoteStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    paymentStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    finalAmount: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    currentEtaMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    dispatchStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastDispatchAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLocationUpdateAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'CustomerRequest' }
);
