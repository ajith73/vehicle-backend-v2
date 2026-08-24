import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RegionalPricingRule extends Model {}

RegionalPricingRule.init(
  {
    cityConfigId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    zoneConfigId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    serviceTypeId: {
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
    ruleName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    pricingMode: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MULTIPLIER',
    },
    multiplier: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    flatFee: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    taxPercent: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    memberDiscountPercent: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    rules: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'RegionalPricingRule' }
);
