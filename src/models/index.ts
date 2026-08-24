import { sequelize } from '../config/database';
import { Role } from './Role';
import { User } from './User';
import { Mechanic } from './Mechanic';
import { MechanicUpdateRequest } from './MechanicUpdateRequest';
import { Feedback } from './Feedback';
import { Donation } from './Donation';
import { ActivityLog } from './ActivityLog';
import { PartnerEarning } from './PartnerEarning';
import { PayoutSettlement } from './PayoutSettlement';
import { VehicleType } from './VehicleType';
import { ServiceType } from './ServiceType';
import { VerificationRequest } from './VerificationRequest';
import { Otp } from './Otp';
import { SpecificService } from './SpecificService';
import { Review } from './Review';
import { CustomerProfile } from './CustomerProfile';
import { CustomerRequest } from './CustomerRequest';
import { RequestAssignment } from './RequestAssignment';
import { RequestTimelineEvent } from './RequestTimelineEvent';
import { RequestCancellation } from './RequestCancellation';
import { RequestProofAsset } from './RequestProofAsset';
import { RequestInternalNote } from './RequestInternalNote';
import { RequestQuote } from './RequestQuote';
import { RequestQuoteLineItem } from './RequestQuoteLineItem';
import { PaymentTransaction } from './PaymentTransaction';
import { SubscriptionPlan } from './SubscriptionPlan';
import { CustomerSubscription } from './CustomerSubscription';
import { TrustedPartnerAudit } from './TrustedPartnerAudit';
import { MechanicLiveState } from './MechanicLiveState';
import { RequestDispatchAttempt } from './RequestDispatchAttempt';
import { DispatchOverride } from './DispatchOverride';
import { SupportTicket } from './SupportTicket';
import { RealtimeEventLog } from './RealtimeEventLog';
import { AnalyticsEvent } from './AnalyticsEvent';
import { PartnerPerformanceMetric } from './PartnerPerformanceMetric';
import { MarketplaceZoneMetric } from './MarketplaceZoneMetric';
import { DispatchScoreSnapshot } from './DispatchScoreSnapshot';
import { CustomerFunnelSnapshot } from './CustomerFunnelSnapshot';
import { CityConfig } from './CityConfig';
import { ZoneConfig } from './ZoneConfig';
import { ServiceAvailabilityRule } from './ServiceAvailabilityRule';
import { RegionalPricingRule } from './RegionalPricingRule';
import { MarketplaceLaunchState } from './MarketplaceLaunchState';

// Relationships
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

User.hasMany(Mechanic, { foreignKey: 'createdById', as: 'CreatedMechanics' });
Mechanic.belongsTo(User, { foreignKey: 'createdById', as: 'Creator' });

User.hasMany(Mechanic, { foreignKey: 'approvedById', as: 'ApprovedMechanics' });
Mechanic.belongsTo(User, { foreignKey: 'approvedById', as: 'Approver' });

Mechanic.hasMany(MechanicUpdateRequest, { foreignKey: 'mechanicId' });
MechanicUpdateRequest.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

User.hasMany(MechanicUpdateRequest, { foreignKey: 'requestedById', as: 'Requestor' });
MechanicUpdateRequest.belongsTo(User, { foreignKey: 'requestedById', as: 'Requestor' });

User.hasMany(MechanicUpdateRequest, { foreignKey: 'reviewedById', as: 'Reviewer' });
MechanicUpdateRequest.belongsTo(User, { foreignKey: 'reviewedById', as: 'Reviewer' });

Mechanic.hasMany(VerificationRequest, { foreignKey: 'mechanicId' });
VerificationRequest.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

Mechanic.hasMany(Review, { foreignKey: 'mechanicId' });
Review.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

User.hasMany(ActivityLog, { foreignKey: 'userId' });
ActivityLog.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(CustomerProfile, { foreignKey: 'userId' });
CustomerProfile.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(CustomerRequest, { foreignKey: 'customerUserId', as: 'CustomerRequests' });
CustomerRequest.belongsTo(User, { foreignKey: 'customerUserId', as: 'CustomerUser' });

Mechanic.hasMany(CustomerRequest, { foreignKey: 'mechanicId' });
CustomerRequest.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

ServiceType.hasMany(CustomerRequest, { foreignKey: 'serviceTypeId' });
CustomerRequest.belongsTo(ServiceType, { foreignKey: 'serviceTypeId' });

SpecificService.hasMany(CustomerRequest, { foreignKey: 'specificServiceId' });
CustomerRequest.belongsTo(SpecificService, { foreignKey: 'specificServiceId' });

VehicleType.hasMany(CustomerRequest, { foreignKey: 'vehicleTypeId' });
CustomerRequest.belongsTo(VehicleType, { foreignKey: 'vehicleTypeId' });

CustomerRequest.hasMany(RequestAssignment, { foreignKey: 'customerRequestId' });
RequestAssignment.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
Mechanic.hasMany(RequestAssignment, { foreignKey: 'mechanicId' });
RequestAssignment.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
User.hasMany(RequestAssignment, { foreignKey: 'assignedByUserId', as: 'RequestAssignmentsMade' });
RequestAssignment.belongsTo(User, { foreignKey: 'assignedByUserId', as: 'AssignedByUser' });

CustomerRequest.hasMany(RequestTimelineEvent, { foreignKey: 'customerRequestId' });
RequestTimelineEvent.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
User.hasMany(RequestTimelineEvent, { foreignKey: 'actorUserId', as: 'RequestTimelineActions' });
RequestTimelineEvent.belongsTo(User, { foreignKey: 'actorUserId', as: 'ActorUser' });

CustomerRequest.hasOne(RequestCancellation, { foreignKey: 'customerRequestId' });
RequestCancellation.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
User.hasMany(RequestCancellation, { foreignKey: 'cancelledByUserId', as: 'RequestCancellationsMade' });
RequestCancellation.belongsTo(User, { foreignKey: 'cancelledByUserId', as: 'CancelledByUser' });

CustomerRequest.hasMany(RequestProofAsset, { foreignKey: 'customerRequestId' });
RequestProofAsset.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
User.hasMany(RequestProofAsset, { foreignKey: 'uploadedByUserId', as: 'RequestProofUploads' });
RequestProofAsset.belongsTo(User, { foreignKey: 'uploadedByUserId', as: 'UploadedByUser' });

CustomerRequest.hasMany(RequestInternalNote, { foreignKey: 'customerRequestId' });
RequestInternalNote.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
User.hasMany(RequestInternalNote, { foreignKey: 'authorUserId', as: 'RequestInternalNotesAuthored' });
RequestInternalNote.belongsTo(User, { foreignKey: 'authorUserId', as: 'AuthorUser' });

CustomerRequest.hasMany(RequestQuote, { foreignKey: 'customerRequestId' });
RequestQuote.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
Mechanic.hasMany(RequestQuote, { foreignKey: 'mechanicId' });
RequestQuote.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

RequestQuote.hasMany(RequestQuoteLineItem, { foreignKey: 'requestQuoteId' });
RequestQuoteLineItem.belongsTo(RequestQuote, { foreignKey: 'requestQuoteId' });

CustomerRequest.hasMany(PaymentTransaction, { foreignKey: 'customerRequestId' });
PaymentTransaction.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
RequestQuote.hasMany(PaymentTransaction, { foreignKey: 'requestQuoteId' });
PaymentTransaction.belongsTo(RequestQuote, { foreignKey: 'requestQuoteId' });

SubscriptionPlan.hasMany(CustomerSubscription, { foreignKey: 'subscriptionPlanId' });
CustomerSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'subscriptionPlanId' });
User.hasMany(CustomerSubscription, { foreignKey: 'customerUserId', as: 'CustomerSubscriptions' });
CustomerSubscription.belongsTo(User, { foreignKey: 'customerUserId', as: 'CustomerUser' });

Mechanic.hasMany(TrustedPartnerAudit, { foreignKey: 'mechanicId' });
TrustedPartnerAudit.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
User.hasMany(TrustedPartnerAudit, { foreignKey: 'changedByUserId', as: 'TrustedPartnerChanges' });
TrustedPartnerAudit.belongsTo(User, { foreignKey: 'changedByUserId', as: 'ChangedByUser' });

Mechanic.hasOne(MechanicLiveState, { foreignKey: 'mechanicId' });
MechanicLiveState.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
CustomerRequest.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
CustomerRequest.hasMany(RequestDispatchAttempt, { foreignKey: 'customerRequestId' });
RequestDispatchAttempt.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
Mechanic.hasMany(RequestDispatchAttempt, { foreignKey: 'mechanicId' });
RequestDispatchAttempt.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

CustomerRequest.hasMany(DispatchOverride, { foreignKey: 'customerRequestId' });
DispatchOverride.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
Mechanic.hasMany(DispatchOverride, { foreignKey: 'mechanicId' });
DispatchOverride.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
User.hasMany(DispatchOverride, { foreignKey: 'overriddenByUserId', as: 'DispatchOverridesMade' });
DispatchOverride.belongsTo(User, { foreignKey: 'overriddenByUserId', as: 'OverriddenByUser' });

CustomerRequest.hasMany(SupportTicket, { foreignKey: 'customerRequestId' });
SupportTicket.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
User.hasMany(SupportTicket, { foreignKey: 'raisedByUserId', as: 'RaisedSupportTickets' });
SupportTicket.belongsTo(User, { foreignKey: 'raisedByUserId', as: 'RaisedByUser' });
User.hasMany(SupportTicket, { foreignKey: 'assignedToUserId', as: 'AssignedSupportTickets' });
SupportTicket.belongsTo(User, { foreignKey: 'assignedToUserId', as: 'AssignedToUser' });

CustomerRequest.hasMany(RealtimeEventLog, { foreignKey: 'customerRequestId' });
RealtimeEventLog.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
Mechanic.hasMany(RealtimeEventLog, { foreignKey: 'mechanicId' });
RealtimeEventLog.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
User.hasMany(RealtimeEventLog, { foreignKey: 'actorUserId', as: 'RealtimeEventsAuthored' });
RealtimeEventLog.belongsTo(User, { foreignKey: 'actorUserId', as: 'ActorUser' });

CustomerRequest.hasMany(AnalyticsEvent, { foreignKey: 'customerRequestId' });
AnalyticsEvent.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
Mechanic.hasMany(AnalyticsEvent, { foreignKey: 'mechanicId' });
AnalyticsEvent.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
User.hasMany(AnalyticsEvent, { foreignKey: 'userId', as: 'AnalyticsEventsAuthored' });
AnalyticsEvent.belongsTo(User, { foreignKey: 'userId', as: 'User' });

Mechanic.hasMany(PartnerPerformanceMetric, { foreignKey: 'mechanicId' });
PartnerPerformanceMetric.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

CustomerRequest.hasMany(DispatchScoreSnapshot, { foreignKey: 'customerRequestId' });
DispatchScoreSnapshot.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
Mechanic.hasMany(DispatchScoreSnapshot, { foreignKey: 'mechanicId' });
DispatchScoreSnapshot.belongsTo(Mechanic, { foreignKey: 'mechanicId' });

CityConfig.hasMany(ZoneConfig, { foreignKey: 'cityConfigId' });
ZoneConfig.belongsTo(CityConfig, { foreignKey: 'cityConfigId' });
CityConfig.hasMany(ServiceAvailabilityRule, { foreignKey: 'cityConfigId' });
ServiceAvailabilityRule.belongsTo(CityConfig, { foreignKey: 'cityConfigId' });
ZoneConfig.hasMany(ServiceAvailabilityRule, { foreignKey: 'zoneConfigId' });
ServiceAvailabilityRule.belongsTo(ZoneConfig, { foreignKey: 'zoneConfigId' });
ServiceType.hasMany(ServiceAvailabilityRule, { foreignKey: 'serviceTypeId' });
ServiceAvailabilityRule.belongsTo(ServiceType, { foreignKey: 'serviceTypeId' });

CityConfig.hasMany(RegionalPricingRule, { foreignKey: 'cityConfigId' });
RegionalPricingRule.belongsTo(CityConfig, { foreignKey: 'cityConfigId' });
ZoneConfig.hasMany(RegionalPricingRule, { foreignKey: 'zoneConfigId' });
RegionalPricingRule.belongsTo(ZoneConfig, { foreignKey: 'zoneConfigId' });
ServiceType.hasMany(RegionalPricingRule, { foreignKey: 'serviceTypeId' });
RegionalPricingRule.belongsTo(ServiceType, { foreignKey: 'serviceTypeId' });

// P1 Finance Associations
PartnerEarning.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
Mechanic.hasMany(PartnerEarning, { foreignKey: 'mechanicId' });

PartnerEarning.belongsTo(CustomerRequest, { foreignKey: 'customerRequestId' });
CustomerRequest.hasOne(PartnerEarning, { foreignKey: 'customerRequestId' });

PartnerEarning.belongsTo(PaymentTransaction, { foreignKey: 'paymentTransactionId' });
PaymentTransaction.hasOne(PartnerEarning, { foreignKey: 'paymentTransactionId' });

PayoutSettlement.belongsTo(Mechanic, { foreignKey: 'mechanicId' });
Mechanic.hasMany(PayoutSettlement, { foreignKey: 'mechanicId' });

PartnerEarning.belongsTo(PayoutSettlement, { foreignKey: 'payoutSettlementId' });
PayoutSettlement.hasMany(PartnerEarning, { foreignKey: 'payoutSettlementId' });

User.hasMany(PayoutSettlement, { foreignKey: 'processedByUserId', as: 'ProcessedSettlements' });
PayoutSettlement.belongsTo(User, { foreignKey: 'processedByUserId', as: 'ProcessorUser' });

export {
  sequelize,
  Role,
  User,
  Mechanic,
  MechanicUpdateRequest,
  Feedback,
  Donation,
  ActivityLog,
  PartnerEarning,
  PayoutSettlement,
  VehicleType,
  ServiceType,
  VerificationRequest,
  Otp,
  SpecificService,
  Review,
  CustomerProfile,
  CustomerRequest,
  RequestAssignment,
  RequestTimelineEvent,
  RequestCancellation,
  RequestProofAsset,
  RequestInternalNote,
  RequestQuote,
  RequestQuoteLineItem,
  PaymentTransaction,
  SubscriptionPlan,
  CustomerSubscription,
  TrustedPartnerAudit,
  MechanicLiveState,
  RequestDispatchAttempt,
  DispatchOverride,
  SupportTicket,
  RealtimeEventLog,
  AnalyticsEvent,
  PartnerPerformanceMetric,
  MarketplaceZoneMetric,
  DispatchScoreSnapshot,
  CustomerFunnelSnapshot,
  CityConfig,
  ZoneConfig,
  ServiceAvailabilityRule,
  RegionalPricingRule,
  MarketplaceLaunchState,
};
