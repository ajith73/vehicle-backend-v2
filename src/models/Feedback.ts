import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Feedback extends Model {}
Feedback.init(
  {
    type: { type: DataTypes.STRING, allowNull: false }, // Bug Report, Suggestion, etc.
    description: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'New' },
  },
  { sequelize, modelName: 'Feedback' }
);
