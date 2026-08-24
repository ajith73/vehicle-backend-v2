import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../config/database';
import { dropDatabase } from '../utils/databaseLifecycle';
import { logger } from '../lib/logger';

const main = async () => {
  await dropDatabase();
  logger.warn('manual_database_drop_completed');
  await sequelize.close();
};

main().catch(async (error) => {
  logger.error('manual_database_drop_failed', { error });
  await sequelize.close();
  process.exit(1);
});
