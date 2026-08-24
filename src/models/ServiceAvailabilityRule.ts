import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ServiceAvailabilityRule extends Model {}

ServiceAvailabilityRule.init(
  {
    serviceTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cityConfigId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    zoneConfigId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    citySlug: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    zoneSlug: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    availabilityState: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ENABLED',
    },
    customerMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    minTrustedPartners: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rapidResponseOnly: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    rules: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'ServiceAvailabilityRule' }
);
