import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RequestAssignment extends Model {}

RequestAssignment.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assignedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ASSIGNED',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'RequestAssignment' }
);
