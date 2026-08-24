import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class MechanicLiveState extends Model {}

MechanicLiveState.init(
  {
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    isOnline: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    availabilityState: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OFFLINE',
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    heading: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    accuracyMeters: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    lastLocationUpdateAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    staleAfterAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    activeRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'MechanicLiveState' }
);
