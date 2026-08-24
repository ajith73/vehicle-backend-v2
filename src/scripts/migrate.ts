import dotenv from 'dotenv';
dotenv.config();

import { sequelize } from '../config/database';
import { runMigrations } from '../migrations/runner';
import { logger } from '../lib/logger';

const main = async () => {
  await sequelize.authenticate();
  await runMigrations();
  logger.info('manual_migration_run_completed');
  await sequelize.close();
};

main().catch(async (error) => {
  logger.error('manual_migration_run_failed', { error });
  await sequelize.close();
  process.exit(1);
});
