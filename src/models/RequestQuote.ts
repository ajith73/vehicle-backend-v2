import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RequestQuote extends Model {}

RequestQuote.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'QUOTE_PENDING',
    },
    pricingMode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'QUOTE_REQUIRED',
    },
    currencyCode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INR',
    },
    subtotalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    taxAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    feeAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    customerDecisionNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'RequestQuote' }
);
