import { sequelize } from '../config/database';
import { Mechanic } from '../models/Mechanic';
import { verifyMechanicRecord } from '../utils/dataVerificationAgent';

export async function runTest() {
  try {
    // 1. Connect to the database
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // 2. Fetch first 10 active mechanic records
    const mechanics = await Mechanic.findAll({
      where: {
        status: 'Approved'
      },
      limit: 20
    });

    if (!mechanics || mechanics.length === 0) {
      console.log('No active mechanics found in the database.');
      process.exit(0);
    }

    console.log(`Found ${mechanics.length} active mechanics. Starting verification...`);

    // Process each mechanic
    for (const mechanic of mechanics) {
      console.log(`\nTesting verification agent on Mechanic ID: ${mechanic.getDataValue('id')} (${mechanic.getDataValue('businessName') || mechanic.getDataValue('name')})`);
      console.log('Sending to Ollama (this may take a minute or two depending on your local model speed)...');

      // 3. Run the verification agent
      const result = await verifyMechanicRecord(mechanic.get({ plain: true }));

      // 4. Output the result
      console.log('==================================');
      console.log(`AGENT OUTPUT FOR MECHANIC ID: ${mechanic.getDataValue('id')}`);
      console.log('==================================');
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('Error running the test:', error);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

// Execute the test when run directly
// runTest();