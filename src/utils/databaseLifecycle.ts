import { sequelize } from '../config/database';
import { logger } from '../lib/logger';

const isTruthy = (value?: string) =>
  value ? ['1', 'true', 'yes'].includes(value.toLowerCase()) : false;

const isProduction = process.env.NODE_ENV === 'production';

const assertDropAllowed = () => {
  const allowProductionDrop = isTruthy(process.env.DB_DROP_ALLOW_PRODUCTION);

  if (isProduction && !allowProductionDrop) {
    throw new Error('Refusing to drop database in production without DB_DROP_ALLOW_PRODUCTION=true');
  }
};

export const shouldDropDatabaseOnStart = () => isTruthy(process.env.DB_DROP_ON_START);

export const dropDatabase = async () => {
  assertDropAllowed();

  await sequelize.authenticate();

  logger.warn('database_drop_started', {
    environment: process.env.NODE_ENV || 'development'
  });

  const queryInterface = sequelize.getQueryInterface();
  await queryInterface.dropAllTables({ cascade: true } as any);

  logger.warn('database_drop_completed');
};
