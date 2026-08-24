import {
  arrayField,
  booleanField,
  enumField,
  nullable,
  numberField,
  objectField,
  optional,
  stringField,
} from './schema';

const MECHANIC_TYPES = [
  'Individual Mechanic',
  'Workshop / Garage',
  'Authorized Service Center',
  'Mobile Mechanic',
  'Towing Company',
  'Fuel Delivery Partner'
] as const;

const MECHANIC_STATUSES = ['Pending', 'Approved', 'Rejected', 'Inactive'] as const;

const phoneSchema = objectField({
  number: stringField({ minLength: 5 }),
  isWhatsapp: optional(booleanField()),
  isTelephone: optional(booleanField())
});

const mechanicPayloadShape = {
  mechanicType: enumField(MECHANIC_TYPES),
  name: optional(stringField({ minLength: 1 })),
  businessName: stringField({ minLength: 1 }),
  mechanicName: optional(stringField({ minLength: 1 })),
  description: optional(stringField()),
  image: optional(stringField()),
  websiteUrl: optional(stringField()),
  googlePlaceId: optional(stringField()),
  phone: arrayField(phoneSchema, { minLength: 1 }),
  emails: optional(arrayField(stringField({ minLength: 3 }))),
  categories: optional(arrayField(stringField({ minLength: 1 }))),
  categoryName: optional(stringField()),
  address: stringField({ minLength: 1 }),
  landmark: optional(stringField({ minLength: 1 })),
  pincode: optional(stringField()),
  city: stringField({ minLength: 1 }),
  state: stringField({ minLength: 1 }),
  country: optional(stringField({ minLength: 1 })),
  latitude: numberField({ coerce: true }),
  longitude: numberField({ coerce: true }),
  serviceRadius: optional(nullable(numberField({ integer: true, min: 0, coerce: true }))),
  vehicleTypes: arrayField(stringField({ minLength: 1 }), { minLength: 1 }),
  serviceTypes: arrayField(stringField({ minLength: 1 }), { minLength: 1 }),
  evSupport: optional(booleanField()),
  homeService: optional(booleanField()),
  roadsideAssistance: optional(booleanField()),
  is24Hours: optional(booleanField()),
  holidayWorking: optional(booleanField()),
  operatingDays: arrayField(stringField({ minLength: 1 }), { minLength: 1 }),
  operatingHours: stringField({ minLength: 1 }),
  availability: optional(booleanField())
};

export const loginSchema = objectField({
  email: stringField({ minLength: 1 }),
  password: stringField({ minLength: 1 }),
  portal: optional(enumField(['CUSTOMER', 'PARTNER', 'ADMIN'] as const))
});

export const feedbackSubmissionSchema = objectField({
  type: stringField({ minLength: 1 }),
  description: stringField({ minLength: 1 })
});

export const donationSubmissionSchema = objectField({
  amount: numberField({ coerce: true, min: 1 }),
  paymentReference: optional(stringField({ minLength: 1 })),
  name: optional(stringField({ minLength: 1 })),
  email: optional(stringField({ minLength: 1 })),
  consentGiven: optional(booleanField())
});

export const routeRequestSchema = objectField({
  startLat: numberField({ coerce: true }),
  startLng: numberField({ coerce: true }),
  endLat: numberField({ coerce: true }),
  endLng: numberField({ coerce: true }),
  routeOption: optional(enumField(['Fastest', 'Shortest', 'Avoid Toll'] as const))
});

export const profileUpdateSchema = objectField({
  name: optional(stringField({ minLength: 1 })),
  email: optional(stringField({ minLength: 3 })),
  password: optional(stringField({ minLength: 6 }))
}, { requireAtLeastOne: true });

export const createUserSchema = objectField({
  email: stringField({ minLength: 1 }),
  name: optional(stringField({ minLength: 1 })),
  password: stringField({ minLength: 6 }),
  allowedScreens: optional(arrayField(stringField({ minLength: 1 })))
});

export const updateUserSchema = objectField({
  email: optional(stringField({ minLength: 1 })),
  name: optional(stringField({ minLength: 1 })),
  password: optional(stringField({ minLength: 6 })),
  allowedScreens: optional(arrayField(stringField({ minLength: 1 })))
}, { requireAtLeastOne: true });

export const feedbackStatusUpdateSchema = objectField({
  status: stringField({ minLength: 1 })
});

export const namedEntitySchema = objectField({
  name: stringField({ minLength: 1 })
});

export const featuredIdsSchema = objectField({
  ids: arrayField(numberField({ integer: true, min: 1, coerce: true }))
});

export const mechanicSchema = objectField(mechanicPayloadShape);

export const publicMechanicSubmissionSchema = objectField({
  existingMechanicId: optional(numberField({ integer: true, min: 1, coerce: true })),
  ...mechanicPayloadShape
});

export const mechanicBulkCreateSchema = objectField({
  mechanics: arrayField(objectField(mechanicPayloadShape), { minLength: 1 })
});

export const mechanicBulkStatusSchema = objectField({
  ids: arrayField(numberField({ integer: true, min: 1, coerce: true }), { minLength: 1 }),
  status: enumField(MECHANIC_STATUSES),
  remarks: optional(stringField())
});

export const reviewSubmissionSchema = objectField({
  name: stringField({ minLength: 1 }),
  email: stringField({ minLength: 3 }),
  visitorId: stringField({ minLength: 1 }),
  fingerprint: stringField({ minLength: 1 }),
  ratingTimeliness: numberField({ integer: true, min: 1, max: 5, coerce: true }),
  ratingFairness: numberField({ integer: true, min: 1, max: 5, coerce: true }),
  ratingRecommendation: numberField({ integer: true, min: 1, max: 5, coerce: true }),
  isProblemFixed: booleanField(),
  comments: optional(stringField())
});

export const reviewStatusUpdateSchema = objectField({
  status: enumField(['Pending', 'Approved', 'Rejected'])
});

export const customerOtpSendSchema = objectField({
  email: stringField({ minLength: 3 })
});

export const customerOtpVerifySchema = objectField({
  email: stringField({ minLength: 3 }),
  code: stringField({ minLength: 4 }),
  displayName: optional(stringField({ minLength: 1 }))
});

export const customerRequestSchema = objectField({
  mechanicId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  serviceTypeId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  specificServiceId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  vehicleTypeId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  vehicleLabel: optional(stringField({ minLength: 1 })),
  issueSummary: stringField({ minLength: 3 }),
  issueDetails: optional(stringField({ minLength: 1 })),
  latitude: numberField({ coerce: true }),
  longitude: numberField({ coerce: true }),
  addressText: optional(stringField({ minLength: 1 }))
});

export const adminAssignRequestSchema = objectField({
  mechanicId: numberField({ integer: true, min: 1, coerce: true }),
  notes: optional(stringField({ minLength: 1 }))
});

export const adminCancelRequestSchema = objectField({
  reason: stringField({ minLength: 1 }),
  details: optional(stringField({ minLength: 1 }))
});

export const mechanicRejectJobSchema = objectField({
  reason: stringField({ minLength: 1 })
});

export const customerRequestCancelSchema = objectField({
  reason: stringField({ minLength: 1 }),
  details: optional(stringField({ minLength: 1 }))
});

export const mechanicJobStatusUpdateSchema = objectField({
  status: enumField(['EN_ROUTE', 'ARRIVED', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'CUSTOMER_NO_RESPONSE', 'MECHANIC_NO_SHOW', 'SERVICE_CANCELLED'] as const),
  notes: optional(stringField({ minLength: 1 })),
  proofAssetUrl: optional(stringField({ minLength: 1 })),
  proofCaption: optional(stringField({ minLength: 1 }))
});

export const adminInternalNoteSchema = objectField({
  note: stringField({ minLength: 1 })
});

export const mechanicQuoteSubmissionSchema = objectField({
  pricingMode: enumField(['FIXED_PRICE', 'QUOTE_REQUIRED'] as const),
  notes: optional(stringField({ minLength: 1 })),
  taxAmount: optional(numberField({ coerce: true, min: 0 })),
  feeAmount: optional(numberField({ coerce: true, min: 0 })),
  lineItems: arrayField(objectField({
    label: stringField({ minLength: 1 }),
    category: enumField(['LABOR', 'PART', 'FEE', 'TAX', 'OTHER'] as const),
    quantity: optional(numberField({ coerce: true, min: 0.01 })),
    unitAmount: numberField({ coerce: true, min: 0 }),
    description: optional(stringField({ minLength: 1 }))
  }), { minLength: 1 })
});

export const customerQuoteDecisionSchema = objectField({
  notes: optional(stringField({ minLength: 1 }))
});

export const customerPaymentInitiateSchema = objectField({
  paymentMethod: optional(stringField({ minLength: 1 }))
});

export const customerMembershipSubscribeSchema = objectField({
  subscriptionPlanId: numberField({ integer: true, min: 1, coerce: true })
});

export const customerSupportTicketCreateSchema = objectField({
  customerRequestId: numberField({ integer: true, min: 1, coerce: true }),
  category: stringField({ minLength: 1 }),
  subject: stringField({ minLength: 1 }),
  description: stringField({ minLength: 1 }),
  priority: optional(enumField(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const)),
  incidentType: optional(stringField({ minLength: 1 })),
  contactPreference: optional(stringField({ minLength: 1 })),
  evidenceNotes: optional(stringField({ minLength: 1 }))
});

export const mechanicSupportTicketCreateSchema = objectField({
  customerRequestId: numberField({ integer: true, min: 1, coerce: true }),
  category: stringField({ minLength: 1 }),
  subject: stringField({ minLength: 1 }),
  description: stringField({ minLength: 1 }),
  priority: optional(enumField(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const)),
  incidentType: optional(stringField({ minLength: 1 })),
  contactPreference: optional(stringField({ minLength: 1 })),
  evidenceNotes: optional(stringField({ minLength: 1 }))
});

export const adminSubscriptionPlanSchema = objectField({
  name: stringField({ minLength: 1 }),
  tier: stringField({ minLength: 1 }),
  description: optional(stringField({ minLength: 1 })),
  priceAmount: numberField({ coerce: true, min: 0 }),
  billingCycle: stringField({ minLength: 1 }),
  platformFeeDiscountPercent: optional(numberField({ coerce: true, min: 0 })),
  prioritySupport: optional(booleanField()),
  priorityDispatch: optional(booleanField()),
  trustedOnlyAccess: optional(booleanField()),
  isActive: optional(booleanField())
});

export const adminMechanicTrustSchema = objectField({
  isTrustedPartner: booleanField(),
  partnerTier: optional(stringField({ minLength: 1 })),
  trustScore: optional(numberField({ coerce: true, min: 0 })),
  priorityDispatchEligible: optional(booleanField()),
  reason: optional(stringField({ minLength: 1 }))
});

export const mechanicLiveOnlineSchema = objectField({
  availabilityState: optional(enumField(['ONLINE_IDLE', 'ONLINE_BUSY', 'TEMP_UNAVAILABLE'] as const)),
  latitude: optional(numberField({ coerce: true })),
  longitude: optional(numberField({ coerce: true })),
  accuracyMeters: optional(numberField({ coerce: true, min: 0 })),
  heading: optional(numberField({ coerce: true, min: 0 })),
});

export const mechanicLiveOfflineSchema = objectField({
  notes: optional(stringField({ minLength: 1 })),
});

export const mechanicLocationUpdateSchema = objectField({
  latitude: numberField({ coerce: true }),
  longitude: numberField({ coerce: true }),
  accuracyMeters: optional(numberField({ coerce: true, min: 0 })),
  heading: optional(numberField({ coerce: true, min: 0 })),
  availabilityState: optional(enumField(['ONLINE_IDLE', 'ONLINE_BUSY', 'EN_ROUTE', 'ON_SITE', 'TEMP_UNAVAILABLE'] as const)),
});

export const adminDispatchOverrideSchema = objectField({
  mechanicId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  overrideType: optional(enumField(['MANUAL_ASSIGN', 'MANUAL_REASSIGN', 'FORCE_NO_SUPPLY', 'LOCK_DISPATCH'] as const)),
  reason: stringField({ minLength: 1 }),
  notes: optional(stringField({ minLength: 1 }))
});

export const adminSupportEscalationSchema = objectField({
  subject: stringField({ minLength: 1 }),
  description: optional(stringField({ minLength: 1 })),
  priority: optional(enumField(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const)),
  assignedToUserId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
});

export const adminSupportTicketUpdateSchema = objectField({
  status: optional(stringField({ minLength: 1 })),
  priority: optional(stringField({ minLength: 1 })),
  assignedToUserId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  description: optional(stringField({ minLength: 1 })),
  resolutionNote: optional(stringField({ minLength: 1 }))
}, { requireAtLeastOne: true });

export const adminAutomationRuleUpdateSchema = objectField({
  ruleKey: stringField({ minLength: 1 }),
  eventName: stringField({ minLength: 1 }),
  conditionSummary: stringField({ minLength: 1 }),
  actionSummary: stringField({ minLength: 1 }),
  ownerRole: stringField({ minLength: 1 }),
  enabled: booleanField(),
  timeoutMinutes: optional(nullable(numberField({ integer: true, min: 0, coerce: true }))),
  maxRetries: optional(nullable(numberField({ integer: true, min: 0, coerce: true }))),
  notes: optional(stringField({ minLength: 1 }))
});

export const adminNotificationRetrySchema = objectField({
  notificationKey: stringField({ minLength: 1 }),
  reason: optional(stringField({ minLength: 1 }))
});

export const adminFraudReviewSchema = objectField({
  entityType: stringField({ minLength: 1 }),
  entityId: numberField({ integer: true, min: 1, coerce: true }),
  decision: enumField(['WATCH', 'ESCALATE', 'CLEAR', 'RESTRICT'] as const),
  assigneeRole: optional(stringField({ minLength: 1 })),
  notes: optional(stringField({ minLength: 1 }))
});

export const dispatchScoringRulesSchema = objectField({
  distanceWeight: numberField({ coerce: true, min: 0 }),
  serviceFitWeight: numberField({ coerce: true, min: 0 }),
  vehicleFitWeight: numberField({ coerce: true, min: 0 }),
  availabilityWeight: numberField({ coerce: true, min: 0 }),
  trustWeight: numberField({ coerce: true, min: 0 }),
  reliabilityWeight: numberField({ coerce: true, min: 0 }),
  responseSpeedWeight: numberField({ coerce: true, min: 0 }),
  premiumEligibilityWeight: numberField({ coerce: true, min: 0 }),
});

export const cityConfigSchema = objectField({
  cityName: stringField({ minLength: 1 }),
  slug: optional(stringField({ minLength: 1 })),
  stateName: optional(stringField({ minLength: 1 })),
  countryName: optional(stringField({ minLength: 1 })),
  launchState: optional(enumField(['PLANNED', 'LIMITED', 'ACTIVE', 'PAUSED'] as const)),
  cityTier: optional(stringField({ minLength: 1 })),
  defaultLanguage: optional(stringField({ minLength: 1 })),
  membershipBenefitsEnabled: optional(booleanField()),
  trustedSupplyThreshold: optional(numberField({ integer: true, min: 0, coerce: true })),
  rapidResponseEnabled: optional(booleanField()),
  seoIntro: optional(stringField({ minLength: 1 })),
  operationalNotes: optional(stringField({ minLength: 1 })),
  rules: optional(objectField({}, { allowUnknown: true }))
});

export const zoneConfigSchema = objectField({
  cityConfigId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  cityName: stringField({ minLength: 1 }),
  zoneName: stringField({ minLength: 1 }),
  slug: optional(stringField({ minLength: 1 })),
  launchState: optional(enumField(['PLANNED', 'LIMITED', 'ACTIVE', 'PAUSED'] as const)),
  rapidResponseEnabled: optional(booleanField()),
  standbySupplyTarget: optional(nullable(numberField({ integer: true, min: 0, coerce: true }))),
  etaExpectationMinutes: optional(nullable(numberField({ integer: true, min: 0, coerce: true }))),
  pricingMultiplier: optional(nullable(numberField({ coerce: true, min: 0 }))),
  serviceAvailabilityMode: optional(stringField({ minLength: 1 })),
  operationalNotes: optional(stringField({ minLength: 1 })),
  rules: optional(objectField({}, { allowUnknown: true }))
});

export const serviceAvailabilityRuleSchema = objectField({
  cityConfigId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  zoneConfigId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  citySlug: optional(stringField({ minLength: 1 })),
  zoneSlug: optional(stringField({ minLength: 1 })),
  availabilityState: stringField({ minLength: 1 }),
  customerMessage: optional(stringField({ minLength: 1 })),
  minTrustedPartners: optional(nullable(numberField({ integer: true, min: 0, coerce: true }))),
  rapidResponseOnly: optional(booleanField()),
  rules: optional(objectField({}, { allowUnknown: true }))
});

export const regionalPricingRuleSchema = objectField({
  cityConfigId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  zoneConfigId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  serviceTypeId: optional(nullable(numberField({ integer: true, min: 1, coerce: true }))),
  citySlug: optional(stringField({ minLength: 1 })),
  zoneSlug: optional(stringField({ minLength: 1 })),
  ruleName: stringField({ minLength: 1 }),
  pricingMode: stringField({ minLength: 1 }),
  multiplier: optional(nullable(numberField({ coerce: true, min: 0 }))),
  flatFee: optional(nullable(numberField({ coerce: true, min: 0 }))),
  taxPercent: optional(nullable(numberField({ coerce: true, min: 0 }))),
  memberDiscountPercent: optional(nullable(numberField({ coerce: true, min: 0 }))),
  rules: optional(objectField({}, { allowUnknown: true }))
});
