import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RequestInternalNote extends Model {}

RequestInternalNote.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    authorUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  { sequelize, modelName: 'RequestInternalNote' }
);
