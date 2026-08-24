import { verifyMechanicRecord } from './utils/dataVerificationAgent';

// Sample test records to validate the verification agent
const sampleRecords = [
  {
    id: 1,
    businessName: "ABC Auto Repair",
    mechanicType: "Workshop / Garage",
    status: "Approved",
    phone: "+919876543210",
    address: "123 Main Street, Mumbai, Maharashtra",
    vehicleTypes: ["Car", "SUV"],
    serviceTypes: ["Oil Change", "Brake Service"],
    categories: ["Auto Repair Shop", "Car Service Center"],
    description: "Professional auto repair services with experienced mechanics",
    latitude: "19.0760",
    longitude: "72.8777"
  },
  {
    id: 2,
    businessName: "XYZ Mobile Mechanic",
    mechanicType: "Mobile Mechanic",
    status: "Pending",
    phone: "+919876543211",
    address: "456 Park Avenue, Delhi",
    vehicleTypes: ["Car", "Bike"],
    serviceTypes: ["Engine Diagnostics", "Battery Replacement"],
    categories: ["Mobile Mechanic Service", "Emergency Repair"],
    description: "Mobile mechanic services available at your doorstep",
    latitude: "28.6139",
    longitude: "77.2090"
  }
];

async function runAgentTests() {
  console.log("Testing verification agent with sample records...\n");
  
  for (let i = 0; i < sampleRecords.length; i++) {
    const record = sampleRecords[i];
    console.log(`=== Testing Record ${i + 1} ===`);
    console.log(`Business: ${record.businessName}`);
    console.log(`Mechanic Type: ${record.mechanicType}`);
    console.log(`Status: ${record.status}`);
    
    try {
      const result = await verifyMechanicRecord(record);
      console.log("✅ Verification completed successfully");
      console.log(`Decision: ${result.decision}`);
      console.log(`Need Internet Search: ${result.needInternetSearch}`);
      console.log(`Missing Fields: ${JSON.stringify(result.missingFields)}`);
      console.log(`Updated Record Status: ${result.updatedRecord.status}`);
      console.log(`Updated Mechanic Type: ${result.updatedRecord.mechanicType}`);
      console.log(`Vehicle Types: ${JSON.stringify(result.updatedRecord.vehicleTypes)}`);
      console.log(`Service Types: ${JSON.stringify(result.updatedRecord.serviceTypes)}`);
      console.log("---\n");
    } catch (error) {
      console.error("❌ Error processing record:", error);
      console.log("---\n");
    }
  }
  
  console.log("Test completed!");
}

// Run the tests
runAgentTests();