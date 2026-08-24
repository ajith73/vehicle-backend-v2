import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class CityConfig extends Model {}

CityConfig.init(
  {
    cityName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    stateName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    countryName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'India',
    },
    launchState: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'PLANNED',
    },
    cityTier: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    defaultLanguage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    membershipBenefitsEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    trustedSupplyThreshold: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    rapidResponseEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    seoIntro: {
      type: DataTypes.TEXT,
      allowNull: true,
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
  { sequelize, modelName: 'CityConfig' }
);
