import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction
  ? process.env.DATABASE_URL_PROD || process.env.DATABASE_URL_LOCAL
  : process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL_PROD;

const inferRemoteSslRequirement = (connectionUrl?: string) => {
  if (!connectionUrl) return false;

  try {
    const parsed = new URL(connectionUrl);
    const host = parsed.hostname.toLowerCase();
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    return !isLocalHost;
  } catch {
    return isProduction;
  }
};

const useSsl = process.env.DB_SSL
  ? ['1', 'true', 'yes'].includes(process.env.DB_SSL.toLowerCase())
  : inferRemoteSslRequirement(databaseUrl);
const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED
  ? ['1', 'true', 'yes'].includes(process.env.DB_SSL_REJECT_UNAUTHORIZED.toLowerCase())
  : false;

if (!databaseUrl) {
  console.warn(`WARNING: ${isProduction ? 'DATABASE_URL_PROD' : 'DATABASE_URL_LOCAL'} is not set in environment variables.`);
}

export const sequelize = new Sequelize(databaseUrl || '', {
  dialect: 'postgres',
  logging: false, // Set to console.log to see SQL queries
  dialectOptions: useSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized
        }
      }
    : undefined
});
