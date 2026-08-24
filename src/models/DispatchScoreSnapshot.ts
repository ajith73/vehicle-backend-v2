import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class DispatchScoreSnapshot extends Model {}

DispatchScoreSnapshot.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    scoreType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'MATCH_SCORE',
    },
    score: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },
    factors: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    rules: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    isActiveRuleSet: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  { sequelize, modelName: 'DispatchScoreSnapshot' }
);
