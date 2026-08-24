import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class Role extends Model {}
Role.init(
  {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
  },
  { sequelize, modelName: 'Role' }
);
