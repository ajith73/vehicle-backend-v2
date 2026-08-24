import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class VehicleType extends Model {}
VehicleType.init(
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
    orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: 'VehicleType' }
);
