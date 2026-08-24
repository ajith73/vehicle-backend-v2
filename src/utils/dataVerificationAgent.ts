import fs from 'fs';
import path from 'path';
import axios from 'axios';
import https from 'https';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://10.0.0.22:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3-coder:latest';
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export interface VerificationAgentResult {
  updatedRecord: any;
  decision: "Approve" | "Reject" | "Manual Review";
  needInternetSearch: boolean;
  missingFields: string[];
}

const ALLOWED_MECHANIC_TYPES = [
  "Individual Mechanic",
  "Workshop / Garage",
  "Authorized Service Center",
  "Mobile Mechanic",
  "Towing Company",
  "Fuel Delivery Partner"
];

const ALLOWED_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Inactive"
];

const ALLOWED_VEHICLES = [
  "Bike", "Scooter", "Auto Rickshaw", "Car", "SUV", "Van", "Pickup", 
  "Truck", "Bus", "Tractor", "JCB", "Earth Mover", "Crane", 
  "Electric Bike", "Electric Car"
];

const ALLOWED_SERVICES = [
  "Puncture Repair", "Battery Jumpstart", "Battery Replacement", 
  "Engine Diagnostics", "Engine Repair", "Oil Change", "Brake Service", 
  "Clutch Repair", "Chain Adjustment", "Tyre Replacement", 
  "Wheel Alignment", "Wheel Balancing", "Fuel Delivery", 
  "Key Lockout Assistance", "Jump Start", "Towing Services", 
  "Accident Recovery", "Coolant Top-up", "Air Filter Replacement", 
  "Spark Plug Replacement", "Electrical Repair", "AC Repair", 
  "Suspension Repair", "General Service", "Emergency Breakdown"
];

/**
 * Stage 1: Rule Engine (Node.js)
 */
function runRuleEngine(record: any): any {
  const clean = { ...record };

  // 1. Enum validation & Duplicate removal for arrays
  if (Array.isArray(clean.vehicleTypes)) {
    clean.vehicleTypes = [...new Set(clean.vehicleTypes.filter((v: any) => ALLOWED_VEHICLES.includes(v)))];
  }
  
  if (Array.isArray(clean.serviceTypes)) {
    clean.serviceTypes = [...new Set(clean.serviceTypes.filter((s: any) => ALLOWED_SERVICES.includes(s)))];
  }

  if (Array.isArray(clean.categories)) {
    clean.categories = [...new Set(clean.categories)];
  }

  if (!ALLOWED_MECHANIC_TYPES.includes(clean.mechanicType)) {
    clean.mechanicType = null;
  }

  if (!ALLOWED_STATUSES.includes(clean.status)) {
    clean.status = 'Pending';
  }

  // 2. Phone validation and WhatsApp detection
  if (clean.phone && typeof clean.phone === 'string') {
    clean.phone = clean.phone.replace(/[^0-9+]/g, '');
  }
  if (clean.whatsappNumber && typeof clean.whatsappNumber === 'string') {
    clean.whatsappNumber = clean.whatsappNumber.replace(/[^0-9+]/g, '');
    clean.isWhatsapp = true;
  }

  // 3. Website validation
  if (clean.websiteUrl) {
    if (clean.websiteUrl.includes('wa.me') || clean.websiteUrl.includes('api.whatsapp.com')) {
      clean.isWhatsapp = true;
    }
  }

  // 4. Service radius defaults
  if (!clean.serviceRadius) {
    switch (clean.mechanicType) {
      case 'Workshop / Garage': clean.serviceRadius = 2; break;
      case 'Authorized Service Center': clean.serviceRadius = 5; break;
      case 'Mobile Mechanic': clean.serviceRadius = 10; break;
      case 'Towing Company':
      case 'Fuel Delivery Partner': clean.serviceRadius = 20; break;
      default: clean.serviceRadius = 5;
    }
  }

  // 5. Normalize address fields
  if (clean.address) {
    // Remove extra whitespace and normalize
    clean.address = clean.address.trim();
  }

  // 6. Ensure numeric fields are properly formatted
  if (clean.latitude && typeof clean.latitude === 'string') {
    clean.latitude = parseFloat(clean.latitude);
  }
  if (clean.longitude && typeof clean.longitude === 'string') {
    clean.longitude = parseFloat(clean.longitude);
  }

  return clean;
}

/**
 * Generic helper to call Ollama LLM
 */
async function callLLM(prompt: string): Promise<any> {
  try {
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9
      }
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
      httpsAgent
    });

    let rawResponse = response.data?.response;
    if (!rawResponse) throw new Error('Empty response received from Ollama API');
    
    try {
      let jsonStr = rawResponse;
      const startIndex = rawResponse.indexOf('{');
      const endIndex = rawResponse.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1 && endIndex >= startIndex) {
        jsonStr = rawResponse.substring(startIndex, endIndex + 1);
      }
      return JSON.parse(jsonStr);
    } catch (parseErr) {
      throw new Error(`Failed to parse JSON. Raw response: ${rawResponse}`);
    }
  } catch (err: any) {
    if (err.response) {
      throw new Error(`Ollama API error: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
    } else {
      throw new Error(`Failed to contact Ollama API at ${OLLAMA_BASE_URL}: ${err.message}`);
    }
  }
}

const GLOBAL_RULES = `
==================================
CRITICAL UPDATE RULES
==================================
You are a DATA VERIFIER. You are NOT a mechanic. You are NOT allowed to guess.
Your primary objective is to PRESERVE existing data.
Before changing ANY field ask yourself:
1. Is the existing value clearly wrong?
2. Do I have direct evidence proving it is wrong?
3. Can I prove the new value from the current record?
If the answer is NO, DO NOT MODIFY THE FIELD.
Never modify a field because it "seems better", "typical", "common", or you "think" it should be different.
Only modify fields supported by explicit evidence.

==================================
CATEGORY RULES
==================================
Google Categories are considered authoritative.
Do NOT rename categories. Do NOT replace categories.
Only remove categories that describe Accessibility, Amenities, Payments, Parking, Facilities (e.g. Wheelchair-accessible entrance).
Everything else must remain unchanged.

==================================
FINAL GOLDEN RULE
==================================
Your job is NOT to improve the record. Your job is to verify the record.
If you are not certain, LEAVE THE FIELD UNCHANGED.
Changing correct data is a much worse mistake than leaving imperfect data unchanged.
Always prefer NO CHANGE over UNSUPPORTED CHANGE.

==================================
OUTPUT RESTRICTIONS
==================================
DO NOT output any reasoning, chain of thought, or conversational text.
Return ONLY valid, parseable JSON.
`;

const VALIDATION_RULES = `
==================================
VALIDATION RULES
==================================
1. All fields must be validated for correctness and completeness.
2. If a field is missing or invalid, mark it as needing internet search.
3. Do not make assumptions about data that isn't explicitly provided.
4. When in doubt, keep the original value.
5. For phone numbers, ensure they are valid numeric format.
6. For addresses, ensure they contain meaningful location information.
7. For service types, only include those explicitly mentioned in the record.
`;

/**
 * Main verification pipeline
 */
export async function verifyMechanicRecord(record: any): Promise<VerificationAgentResult> {
  // 1. Rule Engine
  let currentRecord = runRuleEngine(record);

  // 2. Classification AI
  const classificationPrompt = `
${GLOBAL_RULES}
${VALIDATION_RULES}

==================================
STATUS RULES
==================================
If the business is Auto Parts Store, Accessories Shop, Dealer, Showroom, Tyre Retail Store, Battery Retail Store, Lubricant Store, Vehicle Accessories WITHOUT repair services:
status = Inactive. Do NOT change mechanicType. Do NOT invent repair services. Do NOT rewrite description as a workshop. Simply mark Inactive.

==================================
VEHICLE RULES
==================================
VehicleTypes must NOT be guessed. VehicleTypes must NOT be inferred from mechanicType or category alone.
Only modify vehicleTypes when Business Name, Description, Categories, or Website explicitly mention supported vehicles.
If there is no explicit evidence, KEEP THE ORIGINAL vehicleTypes.
Never add Truck, Bus, JCB, SUV, Pickup unless explicitly supported.

==================================
SERVICE RULES
==================================
ServiceTypes must NEVER be guessed. Only include services explicitly mentioned in Business Name, Description, Categories, or Website.
Never invent AC Repair, Oil Change, Engine Repair, General Service or any other service.
If there is insufficient evidence, KEEP EXISTING serviceTypes. Do NOT replace with General Service.

Analyze this record and return ONLY a JSON object with:
- "mechanicType": (Allowed: Individual Mechanic, Workshop / Garage, Authorized Service Center, Mobile Mechanic, Towing Company, Fuel Delivery Partner). Keep original if unsure.
- "status": (Allowed: Pending, Approved, Rejected, Inactive). Set Inactive if it's purely a parts store/showroom without repair services.
- "vehicleTypes": Array of verified vehicle types. Keep existing if unsure.
- "serviceTypes": Array of verified service types. Keep existing if unsure.
- "categories": Array of verified categories after applying CATEGORY RULES.
- "needInternetSearch": boolean (true if address, phone, or critical details are missing/invalid)

Record:
${JSON.stringify(currentRecord, null, 2)}
  `;
  const classificationOutput = await callLLM(classificationPrompt);
  
  if (classificationOutput.mechanicType && ALLOWED_MECHANIC_TYPES.includes(classificationOutput.mechanicType)) {
    currentRecord.mechanicType = classificationOutput.mechanicType;
  }
  if (classificationOutput.status && ALLOWED_STATUSES.includes(classificationOutput.status)) {
    currentRecord.status = classificationOutput.status;
  }
  if (Array.isArray(classificationOutput.vehicleTypes)) {
    currentRecord.vehicleTypes = classificationOutput.vehicleTypes.filter((v: string) => ALLOWED_VEHICLES.includes(v));
  }
  if (Array.isArray(classificationOutput.serviceTypes)) {
    currentRecord.serviceTypes = classificationOutput.serviceTypes.filter((s: string) => ALLOWED_SERVICES.includes(s));
  }
  if (Array.isArray(classificationOutput.categories)) {
    currentRecord.categories = classificationOutput.categories;
  }
  const needInternetSearch = !!classificationOutput.needInternetSearch;

  // 3. Description AI
  const descriptionPrompt = `
${GLOBAL_RULES}

==================================
DESCRIPTION RULES
==================================
Description MUST describe the current business.
Never advertise. Never exaggerate. Never invent services. Never invent opening hours. Never invent vehicle support.
Never use words like Professional, Trusted, Reliable, Best, Quality, Expert unless already present.
Remove ONLY Phone numbers, HTML, Duplicate text, Emoji, Accessibility information, Advertisements.
Do NOT convert Auto Parts Store into Workshop, Dealer into Mechanic, Supplier into Repair Shop.
If no meaningful description exists, write a simple factual description using only Business Name, Google Category, Location. Nothing else.
Maximum 250 characters.

==================================
ACCESSIBILITY RULES
==================================
Accessibility information is NOT part of the business description. (e.g. Wheelchair entrance, Wheelchair toilet, Accessible parking).
Do not include these in description. Do not use accessibility to determine services or mechanicType.

Analyze this record and return ONLY a JSON object with the key "description".

Record:
${JSON.stringify(currentRecord, null, 2)}
  `;
  const descriptionOutput = await callLLM(descriptionPrompt);
  if (descriptionOutput.description) {
    currentRecord.description = descriptionOutput.description;
  }

  // 4. Internet Search AI (Conditional)
  let missingFields: string[] = [];
  if (needInternetSearch) {
    const searchPrompt = `
${GLOBAL_RULES}
${VALIDATION_RULES}

==================================
INTERNET SEARCH RULES
==================================
Never guess missing information.
If any required field is missing (website, phone, operatingHours, operatingDays, city, state, country, landmark, pincode)
Return needInternetSearch=true and list missing fields. Do NOT fabricate values.

Analyze this record and return ONLY a JSON object with the key "missingFields" containing an array of strings.

Record:
${JSON.stringify(currentRecord, null, 2)}
    `;
    const searchOutput = await callLLM(searchPrompt);
    missingFields = searchOutput.missingFields || [];
  }

  // 5. Review AI
  const reviewPrompt = `
You are a Review AI for automotive business listings.
Analyze this fully processed record and make a final decision.
Return ONLY a JSON object with the key "decision", valued as either "Approve", "Reject", or "Manual Review".
- Approve if the record has sufficient data, a valid mechanicType, and status isn't Rejected/Inactive.
- Reject if it's explicitly Inactive or clearly invalid/junk.
- Manual Review if data is borderline or needs internet search.

Record:
${JSON.stringify(currentRecord, null, 2)}
  `;
  const reviewOutput = await callLLM(reviewPrompt);
  let decision = "Manual Review";
  if (["Approve", "Reject", "Manual Review"].includes(reviewOutput.decision)) {
    decision = reviewOutput.decision;
  }

  return {
    updatedRecord: currentRecord,
    decision: decision as any,
    needInternetSearch,
    missingFields
  };
}
