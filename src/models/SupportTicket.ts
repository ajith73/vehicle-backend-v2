import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export class SupportTicket extends Model {}

SupportTicket.init(
  {
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    raisedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    assignedToUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ADMIN',
    },
    ticketType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'LIVE_SUPPORT',
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'OPEN',
    },
    priority: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'NORMAL',
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  { sequelize, modelName: 'SupportTicket' }
);
