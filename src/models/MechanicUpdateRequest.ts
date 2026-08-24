import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class MechanicUpdateRequest extends Model {}
MechanicUpdateRequest.init(
  {
    updatedData: { type: DataTypes.JSON, allowNull: false },
    mechanicId: { type: DataTypes.INTEGER, allowNull: true },
    requestedById: { type: DataTypes.INTEGER, allowNull: true },
    reviewedById: { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM('Pending Update Approval', 'Approved', 'Rejected'),
      defaultValue: 'Pending Update Approval',
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'MechanicUpdateRequest' }
);
