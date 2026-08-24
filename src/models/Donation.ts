import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Donation extends Model {}
Donation.init(
  {
    amount: { type: DataTypes.FLOAT, allowNull: false },
    paymentReference: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    consentGiven: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  { sequelize, modelName: 'Donation' }
);
