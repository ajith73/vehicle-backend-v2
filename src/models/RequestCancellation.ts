import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RequestCancellation extends Model {}

RequestCancellation.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cancelledByType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cancelledByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'RequestCancellation' }
);
