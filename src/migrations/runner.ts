import { DataTypes, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';
import { logger } from '../lib/logger';
import { migrations } from './index';

const META_TABLE = 'SequelizeMeta';

const ensureMetaTable = async () => {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const hasMetaTable = tables.some((table) => {
    if (typeof table === 'string') return table === META_TABLE;
    return (table as { tableName?: string }).tableName === META_TABLE;
  });

  if (!hasMetaTable) {
    await queryInterface.createTable(META_TABLE, {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
      },
      executedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });
  }
};

const getExecutedMigrations = async () => {
  const rows = await sequelize.query<{ name: string }>(
    `SELECT name FROM "${META_TABLE}"`,
    { type: QueryTypes.SELECT }
  );

  return new Set(rows.map((row) => row.name));
};

export const runMigrations = async () => {
  await ensureMetaTable();
  const executed = await getExecutedMigrations();
  const queryInterface = sequelize.getQueryInterface();

  for (const migration of migrations) {
    if (executed.has(migration.name)) {
      continue;
    }

    logger.info('migration_started', { migration: migration.name });
    await migration.up(queryInterface);
    await sequelize.query(
      `INSERT INTO "${META_TABLE}" ("name", "executedAt") VALUES (:name, NOW())`,
      { replacements: { name: migration.name } }
    );
    logger.info('migration_completed', { migration: migration.name });
  }
};
