import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class ZoneConfig extends Model {}

ZoneConfig.init(
  {
    cityConfigId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    cityName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    zoneName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    launchState: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PLANNED',
    },
    rapidResponseEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    standbySupplyTarget: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    etaExpectationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    pricingMultiplier: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    serviceAvailabilityMode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'NORMAL',
    },
    operationalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rules: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'ZoneConfig' }
);
