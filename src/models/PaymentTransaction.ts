import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class PaymentTransaction extends Model {}

PaymentTransaction.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    requestQuoteId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    paymentStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PAYMENT_PENDING',
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ROADRESQ_MANUAL_READY',
    },
    paymentMethod: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    currencyCode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'INR',
    },
    transactionReference: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    gatewayPayload: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'PaymentTransaction' }
);
