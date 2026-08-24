import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class RequestProofAsset extends Model {}

RequestProofAsset.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    uploadedByType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uploadedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assetType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    assetUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    caption: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'RequestProofAsset' }
);
