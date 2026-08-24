import { User, Mechanic, Role } from './models';

async function seed() {
  try {
    const role = await Role.findOne({ where: { name: 'Mechanic' } });
    if (!role) {
      console.log('No mechanic role found');
      return;
    }
    
    // Find the latest mechanic user
    const user = await User.findOne({ 
      where: { roleId: role.dataValues.id }, 
      order: [['createdAt', 'DESC']] 
    });
    
    if (!user) {
      console.log('No mechanic user found in DB');
      return;
    }
    
    console.log('Found mechanic user:', user.dataValues.email, 'ID:', user.dataValues.id);
    
    let mechanic = await Mechanic.findOne({ where: { createdById: user.dataValues.id } });
    
    if (!mechanic) {
      mechanic = await Mechanic.create({
        mechanicType: 'Workshop / Garage',
        businessName: 'Test Garage',
        phone: [{ number: '9999999999', isWhatsapp: true }],
        emails: [user.dataValues.email],
        vehicleTypes: ['Car', 'Bike'],
        serviceTypes: ['General Service'],
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Test Address',
        city: 'Bangalore',
        createdById: user.dataValues.id,
        status: 'Approved',
        isOnline: true,
        isTrustedPartner: true
      });
      console.log('Successfully created dummy mechanic profile for user ID:', user.dataValues.id);
    } else {
      console.log('Mechanic profile already exists for user ID:', user.dataValues.id);
    }
  } catch (error) {
    console.error('Error seeding mechanic:', error);
  } finally {
    process.exit(0);
  }
}

seed();
