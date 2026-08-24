import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';
import { Mechanic } from './Mechanic';

export class Review extends Model {
  public id!: number;
  public mechanicId!: number;
  public name!: string;
  public email!: string;
  public visitorId!: string;
  public fingerprint!: string;
  public ratingTimeliness!: number;
  public ratingFairness!: number;
  public ratingRecommendation!: number;
  public isProblemFixed!: boolean;
  public comments!: string | null;
  public status!: 'Pending' | 'Approved' | 'Rejected';
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Review.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mechanicId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Mechanic, key: 'id' },
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    visitorId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fingerprint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ratingTimeliness: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    ratingFairness: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    ratingRecommendation: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 },
    },
    isProblemFixed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    comments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      defaultValue: 'Pending',
    },
  },
  {
    sequelize,
    modelName: 'Review',
  }
);
