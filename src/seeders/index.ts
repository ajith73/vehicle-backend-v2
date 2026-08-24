import bcrypt from 'bcrypt';
import { sequelize } from '../config/database';
import { Role, User, VehicleType, ServiceType, SpecificService } from '../models';
import { logger } from '../lib/logger';
import { runMigrations } from '../migrations/runner';
import { dropDatabase, shouldDropDatabaseOnStart } from '../utils/databaseLifecycle';

const DEFAULT_SERVICES = [
  "Puncture Repair", "Battery Jumpstart", "Battery Replacement", 
  "Engine Diagnostics", "Engine Repair", "Oil Change", "Brake Service", 
  "Clutch Repair", "Chain Adjustment", "Tyre Replacement", 
  "Wheel Alignment", "Wheel Balancing", "Fuel Delivery", 
  "Key Lockout Assistance", "Jump Start", "Towing Services", 
  "Accident Recovery", "Coolant Top-up", "Air Filter Replacement", 
  "Spark Plug Replacement", "Electrical Repair", "AC Repair", 
  "Suspension Repair", "General Service", "Emergency Breakdown"
];

const DEFAULT_VEHICLES = [
  "Bike", "Scooter", "Auto Rickshaw", "Car", "SUV", "Van", "Pickup", 
  "Truck", "Bus", "Tractor", "JCB", "Earth Mover", "Crane", 
  "Electric Bike", "Electric Car"
];

const DEFAULT_SPECIFIC_SERVICES = [
  "Bike Puncture", "Scooter Puncture", "Auto Puncture", "Car Puncture", "SUV Puncture", "Truck Puncture",
  "Bike Towing", "Car Towing", "SUV Towing", "Truck Towing",
  "Bike Jumpstart", "Car Jumpstart", "Truck Jumpstart",
  "Bike Oil Change", "Car Oil Change", "SUV Oil Change", "Truck Oil Change",
  "Bike Engine Repair", "Car Engine Repair", "Truck Engine Repair",
  "Car AC Repair", "SUV AC Repair", "Truck AC Repair",
  "Car Wheel Alignment", "SUV Wheel Alignment", "Truck Wheel Alignment",
  "Electric Bike General Service", "Electric Car General Service",
  "Car Brake Service", "Truck Brake Service",
  "Car Battery Replacement", "Bike Battery Replacement"
];

export async function setupDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('database_connection_established');

    if (shouldDropDatabaseOnStart()) {
      logger.warn('database_drop_on_start_enabled');
      await dropDatabase();
    }

    await runMigrations();

    // Seed Vehicles
    for (const v of DEFAULT_VEHICLES) {
      await VehicleType.findOrCreate({ where: { name: v } });
    }

    // Seed Services
    for (const s of DEFAULT_SERVICES) {
      await ServiceType.findOrCreate({ where: { name: s } });
    }

    // Seed Specific Services
    for (const s of DEFAULT_SPECIFIC_SERVICES) {
      await SpecificService.findOrCreate({ where: { name: s } });
    }

    // Seed Roles
    const [superAdminRole] = await Role.findOrCreate({ where: { name: 'Super Admin' } });
    const [adminRole] = await Role.findOrCreate({ where: { name: 'Admin' } });

    const adminEmail = process.env.SUPERADMIN_EMAIL || process.env.SUPERADMIN_USERNAME || 'admin@vehicle.com';
    const adminPassword = process.env.SUPERADMIN_PASSWORD || 'admin123';

    if (!process.env.SUPERADMIN_EMAIL && !process.env.SUPERADMIN_USERNAME) {
      logger.warn('superadmin_email_missing_using_default');
    }
    
    const superAdminExists = await User.findOne({ where: { email: adminEmail } });
    if (!superAdminExists) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await User.create({
        username: adminEmail.split('@')[0],
        email: adminEmail,
        passwordHash,
        roleId: superAdminRole.dataValues.id,
        allowedScreens: ['*']
      });
      logger.info('super_admin_seeded');
    }
  } catch (error) {
    logger.error('database_setup_failed', { error });
    throw error;
  }
}
