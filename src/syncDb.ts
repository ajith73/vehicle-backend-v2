import { sequelize } from './models/index';

async function sync() {
  try {
    console.log("Starting DB sync...");
    await sequelize.sync({ alter: true });
    console.log("DB sync complete!");
  } catch (error) {
    console.error("DB sync failed:", error);
  } finally {
    process.exit(0);
  }
}

sync();
