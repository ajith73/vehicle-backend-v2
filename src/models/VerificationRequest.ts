import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class VerificationRequest extends Model {
  public id!: number;
  public mechanicId!: number;
  public shopPhotosLink?: string; // Legacy
  public ownerIdentityLink?: string; // Legacy
  public submittedData!: Record<string, string>;
  public status!: 'Pending' | 'Approved' | 'Rejected';
  public remarks?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  
  public Mechanic?: any;
}
VerificationRequest.init(
  {
    mechanicId: { type: DataTypes.INTEGER, allowNull: false },
    shopPhotosLink: { type: DataTypes.STRING, allowNull: true },
    ownerIdentityLink: { type: DataTypes.STRING, allowNull: true },
    submittedData: { type: DataTypes.JSON, allowNull: false, defaultValue: {} },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'),
      defaultValue: 'Pending',
    },
    remarks: { type: DataTypes.TEXT, allowNull: true },
  },
  { sequelize, modelName: 'VerificationRequest' }
);
