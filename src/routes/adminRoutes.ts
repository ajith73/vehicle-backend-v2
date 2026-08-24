import { Router } from 'express';
import { authenticate, authorizeRole } from '../middleware/authMiddleware';
import * as userController from '../controllers/userController';
import * as dashboardController from '../controllers/dashboardController';
import * as mechanicController from '../controllers/mechanicController';
import * as feedbackController from '../controllers/feedbackController';
import * as settingsController from '../controllers/settingsController';
import * as customerController from '../controllers/customerController';
import * as requestOperationsController from '../controllers/requestOperationsController';
import * as analyticsController from '../controllers/analyticsController';
import * as adminPlatformController from '../controllers/adminPlatformController';
import * as regionalConfigController from '../controllers/regionalConfigController';
import { validateBody } from '../middleware/validation';
import {
  adminDispatchOverrideSchema,
  adminFraudReviewSchema,
  adminMechanicTrustSchema,
  adminNotificationRetrySchema,
  adminSupportEscalationSchema,
  adminSupportTicketUpdateSchema,
  adminSubscriptionPlanSchema,
  adminAutomationRuleUpdateSchema,
  cityConfigSchema,
  createUserSchema,
  dispatchScoringRulesSchema,
  featuredIdsSchema,
  feedbackStatusUpdateSchema,
  mechanicBulkCreateSchema,
  mechanicBulkStatusSchema,
  mechanicSchema,
  namedEntitySchema,
  regionalPricingRuleSchema,
  profileUpdateSchema,
  serviceAvailabilityRuleSchema,
  updateUserSchema
} from '../validation/schemas';
import { adminAssignRequestSchema, adminCancelRequestSchema, adminInternalNoteSchema, zoneConfigSchema } from '../validation/schemas';

export const adminRoutes = Router();
import * as financeController from '../controllers/financeController';

adminRoutes.use(authenticate as any);
const superAdminOnly = authorizeRole(['Super Admin']) as any;
const adminOrSuperAdmin = authorizeRole(['Admin', 'Super Admin']) as any;

// Finance & Settlements
adminRoutes.get('/finance/settlements', adminOrSuperAdmin, financeController.listAdminSettlements as any);
adminRoutes.post('/finance/settlements/:id/process', adminOrSuperAdmin, financeController.processSettlement as any);

// Admin Profile
adminRoutes.get('/profile', userController.getProfile as any);
adminRoutes.put('/profile', validateBody(profileUpdateSchema), userController.updateProfile as any);

// Users
adminRoutes.get('/users', superAdminOnly, userController.getUsers as any);
adminRoutes.post('/users', superAdminOnly, validateBody(createUserSchema), userController.createUser as any);
adminRoutes.put('/users/:id', superAdminOnly, validateBody(updateUserSchema), userController.updateUser as any);
adminRoutes.delete('/users/:id', superAdminOnly, userController.deleteUser as any);

// Dashboard
adminRoutes.get('/dashboard', dashboardController.getDashboardStats as any);
adminRoutes.get('/activity-logs', dashboardController.getActivityLogs as any);
adminRoutes.get('/analytics/customer-funnel', analyticsController.getCustomerFunnelAnalytics as any);
adminRoutes.get('/analytics/partner-performance', analyticsController.getPartnerPerformanceAnalytics as any);
adminRoutes.get('/analytics/marketplace-zones', analyticsController.getMarketplaceZoneAnalytics as any);
adminRoutes.get('/analytics/financial', analyticsController.getFinancialAnalytics as any);
adminRoutes.get('/automation/overview', adminPlatformController.getAdminAutomationOverview as any);
adminRoutes.get('/automation/rules', adminPlatformController.getAdminAutomationRules as any);
adminRoutes.post('/automation/rules', validateBody(adminAutomationRuleUpdateSchema), adminPlatformController.updateAdminAutomationRule as any);
adminRoutes.get('/fraud/signals', adminPlatformController.getAdminFraudSignals as any);
adminRoutes.post('/fraud/review', validateBody(adminFraudReviewSchema), adminPlatformController.reviewAdminFraudSignal as any);
adminRoutes.get('/notifications/engine', adminPlatformController.getAdminNotificationEngine as any);
adminRoutes.post('/notifications/engine/retry', validateBody(adminNotificationRetrySchema), adminPlatformController.retryAdminNotification as any);
adminRoutes.get('/dispatch/scoring', analyticsController.getDispatchScoring as any);
adminRoutes.put('/dispatch/scoring/rules', validateBody(dispatchScoringRulesSchema), analyticsController.updateDispatchScoringRules as any);
adminRoutes.get('/cities', regionalConfigController.listAdminCities as any);
adminRoutes.put('/cities/:id/config', validateBody(cityConfigSchema), regionalConfigController.updateAdminCityConfig as any);
adminRoutes.get('/zones', regionalConfigController.listAdminZones as any);
adminRoutes.post('/zones', validateBody(zoneConfigSchema), regionalConfigController.createAdminZoneConfig as any);
adminRoutes.put('/zones/:id/config', validateBody(zoneConfigSchema), regionalConfigController.updateAdminZoneConfig as any);
adminRoutes.get('/requests', customerController.listCustomerRequestsForAdmin as any);
adminRoutes.get('/requests/:id', customerController.getCustomerRequestForAdmin as any);
adminRoutes.get('/customers', customerController.listCustomersForAdmin as any);
adminRoutes.post('/customers/:id/reset-password', adminOrSuperAdmin, customerController.adminResetCustomerPassword as any);
adminRoutes.delete('/customers/:id', adminOrSuperAdmin, customerController.adminDeleteCustomer as any);
adminRoutes.get('/live/requests', requestOperationsController.listAdminLiveRequests as any);
adminRoutes.get('/live/mechanics', requestOperationsController.listAdminLiveMechanics as any);
adminRoutes.get('/subscription-plans', customerController.listSubscriptionPlansForAdmin as any);
adminRoutes.post('/subscription-plans', validateBody(adminSubscriptionPlanSchema), customerController.createSubscriptionPlan as any);
adminRoutes.put('/subscription-plans/:id', validateBody(adminSubscriptionPlanSchema), customerController.updateSubscriptionPlan as any);
adminRoutes.post('/requests/:id/assign', validateBody(adminAssignRequestSchema), requestOperationsController.assignRequestByAdmin as any);
adminRoutes.post('/requests/:id/reassign', validateBody(adminAssignRequestSchema), requestOperationsController.reassignRequestByAdmin as any);
adminRoutes.post('/requests/:id/dispatch/override', validateBody(adminDispatchOverrideSchema), requestOperationsController.overrideRequestDispatch as any);
adminRoutes.post('/requests/:id/support/escalate', validateBody(adminSupportEscalationSchema), requestOperationsController.escalateSupportTicket as any);
adminRoutes.post('/requests/:id/cancel', validateBody(adminCancelRequestSchema), requestOperationsController.cancelRequestByAdmin as any);
adminRoutes.post('/requests/:id/notes', validateBody(adminInternalNoteSchema), requestOperationsController.addAdminRequestInternalNote as any);
adminRoutes.get('/payments/issues', requestOperationsController.listAdminPaymentIssues as any);
adminRoutes.get('/support/tickets', requestOperationsController.listAdminSupportTickets as any);
adminRoutes.put('/support/tickets/:id', validateBody(adminSupportTicketUpdateSchema), requestOperationsController.updateAdminSupportTicket as any);

// Mechanics
adminRoutes.get('/mechanics', mechanicController.getMechanics as any);
adminRoutes.get('/mechanics/gmaps-import', mechanicController.fetchFromGMapsScraper as any);
adminRoutes.post('/mechanics', validateBody(mechanicSchema), mechanicController.createMechanic as any);
adminRoutes.post('/mechanics/bulk', validateBody(mechanicBulkCreateSchema), mechanicController.bulkCreateMechanics as any);
adminRoutes.put('/mechanics/bulk/status', superAdminOnly, validateBody(mechanicBulkStatusSchema), mechanicController.bulkUpdateMechanicsStatus as any);
adminRoutes.get('/mechanics/:id', mechanicController.getMechanicById as any);
adminRoutes.put('/mechanics/:id', validateBody(mechanicSchema), mechanicController.updateMechanic as any);
adminRoutes.put('/mechanics/:id/trust-status', validateBody(adminMechanicTrustSchema), mechanicController.updateMechanicTrustStatus as any);
adminRoutes.post('/mechanics/:id/reset-password', adminOrSuperAdmin, mechanicController.adminResetMechanicPassword as any);
adminRoutes.put('/mechanics/:id/status', adminOrSuperAdmin, mechanicController.adminUpdateMechanicStatus as any);
adminRoutes.delete('/mechanics/:id', superAdminOnly, mechanicController.deleteMechanic as any);
adminRoutes.post('/mechanics/:id/approve', superAdminOnly, mechanicController.approveMechanic as any);
adminRoutes.put('/mechanics/:id/verification', superAdminOnly, mechanicController.updateVerification as any);

// Verification Requests
adminRoutes.get('/verifications', mechanicController.getVerificationRequests as any);
adminRoutes.post('/verifications/:id/approve', superAdminOnly, mechanicController.approveVerificationRequest as any);
adminRoutes.post('/verifications/:id/reject', superAdminOnly, mechanicController.rejectVerificationRequest as any);
adminRoutes.delete('/verifications/:id', superAdminOnly, mechanicController.deleteVerificationRequest as any);

// Update Requests
adminRoutes.get('/update-requests', mechanicController.getUpdateRequests as any);
adminRoutes.get('/update-requests/:id', mechanicController.getUpdateRequestById as any);
adminRoutes.put('/update-requests/:id', mechanicController.updateUpdateRequest as any);
adminRoutes.delete('/update-requests/:id', superAdminOnly, mechanicController.deleteUpdateRequest as any);
adminRoutes.post('/update-requests/:id/approve', superAdminOnly, mechanicController.approveUpdateRequest as any);
adminRoutes.post('/update-requests/:id/reject', superAdminOnly, mechanicController.rejectUpdateRequest as any);

// Reviews
import * as reviewController from '../controllers/reviewController';
import { reviewStatusUpdateSchema } from '../validation/schemas';
adminRoutes.get('/reviews', reviewController.getAllReviews as any);
adminRoutes.put('/reviews/:id', superAdminOnly, reviewController.updateReview as any);
adminRoutes.delete('/reviews/:id', superAdminOnly, reviewController.deleteReview as any);

// Feedback & Donations
adminRoutes.get('/feedback', feedbackController.getFeedback as any);
adminRoutes.put('/feedback/:id', validateBody(feedbackStatusUpdateSchema), feedbackController.updateFeedback as any);
adminRoutes.delete('/feedback/:id', superAdminOnly, feedbackController.deleteFeedback as any);
adminRoutes.get('/donations', feedbackController.getDonations as any);

// Settings
adminRoutes.put('/vehicles/featured', superAdminOnly, validateBody(featuredIdsSchema), settingsController.updateFeaturedVehicles as any);
adminRoutes.post('/vehicles', superAdminOnly, validateBody(namedEntitySchema), settingsController.addVehicle as any);
adminRoutes.put('/vehicles/:id', superAdminOnly, validateBody(namedEntitySchema), settingsController.updateVehicle as any);
adminRoutes.delete('/vehicles/:id', superAdminOnly, settingsController.deleteVehicle as any);
adminRoutes.put('/services/featured', superAdminOnly, validateBody(featuredIdsSchema), settingsController.updateFeaturedServices as any);
adminRoutes.post('/services', superAdminOnly, validateBody(namedEntitySchema), settingsController.addService as any);
adminRoutes.put('/services/:id', superAdminOnly, validateBody(namedEntitySchema), settingsController.updateService as any);
adminRoutes.put('/services/:id/availability-rules', validateBody(serviceAvailabilityRuleSchema), regionalConfigController.upsertServiceAvailabilityRule as any);
adminRoutes.delete('/services/:id', superAdminOnly, settingsController.deleteService as any);
adminRoutes.put('/specific-services/featured', superAdminOnly, validateBody(featuredIdsSchema), settingsController.updateFeaturedSpecificServices as any);
adminRoutes.post('/specific-services', superAdminOnly, validateBody(namedEntitySchema), settingsController.addSpecificService as any);
adminRoutes.put('/specific-services/:id', superAdminOnly, validateBody(namedEntitySchema), settingsController.updateSpecificService as any);
adminRoutes.delete('/specific-services/:id', superAdminOnly, settingsController.deleteSpecificService as any);
adminRoutes.put('/pricing/regional-rules/:id', validateBody(regionalPricingRuleSchema), regionalConfigController.upsertRegionalPricingRule as any);
