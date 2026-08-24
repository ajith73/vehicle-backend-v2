import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class CustomerProfile extends Model {
  public id!: number;
  public userId!: number;
  public displayName!: string | null;
  public phone!: string | null;
  public lastLoginAt!: Date | null;
  public profilePicture!: string | null;
  public savedVehicles!: any[];
  public savedLocations!: any[];
}

CustomerProfile.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    displayName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    profilePicture: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    subscriptionStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subscriptionTier: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subscriptionEndsAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    prioritySupportEligible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    savedVehicles: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    savedLocations: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
  },
  { sequelize, modelName: 'CustomerProfile' }
);
