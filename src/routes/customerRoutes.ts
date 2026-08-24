import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validation';
import { createCustomerRequest, createCustomerSupportTicket, deleteCustomerAccount, getCustomerNotifications, getMembershipStatus, listCustomerSupportTickets, listMembershipPlans, sendCustomerOtp, subscribeMembershipPlan, verifyCustomerOtp, getCustomerProfile, updateCustomerProfile, getCustomerRequestsHistory } from '../controllers/customerController';
import { cancelCustomerRequest, customerApproveRequestQuote, customerRejectRequestQuote, getCustomerPaymentStatus, getCustomerRequestQuote, getCustomerRequestStatus, initiateCustomerPayment } from '../controllers/requestOperationsController';
import { streamCustomerRequestStatus } from '../controllers/realtimeController';
import { customerMembershipSubscribeSchema, customerPaymentInitiateSchema, customerQuoteDecisionSchema, customerRequestCancelSchema, customerRequestSchema, customerOtpSendSchema, customerOtpVerifySchema, customerSupportTicketCreateSchema } from '../validation/schemas';

export const customerRoutes = Router();

customerRoutes.post('/auth/send-otp', validateBody(customerOtpSendSchema), sendCustomerOtp);
customerRoutes.post('/auth/verify-otp', validateBody(customerOtpVerifySchema), verifyCustomerOtp);
customerRoutes.get('/membership/plans', listMembershipPlans as any);
customerRoutes.get('/membership/status', authenticate as any, getMembershipStatus as any);
customerRoutes.post('/membership/subscribe', authenticate as any, validateBody(customerMembershipSubscribeSchema), subscribeMembershipPlan as any);
customerRoutes.post('/requests', authenticate as any, validateBody(customerRequestSchema), createCustomerRequest);
customerRoutes.get('/requests/:id/status', authenticate as any, getCustomerRequestStatus as any);
customerRoutes.get('/requests/:id/stream', authenticate as any, streamCustomerRequestStatus as any);
customerRoutes.get('/requests/:id/quote', authenticate as any, getCustomerRequestQuote as any);
customerRoutes.post('/requests/:id/quote/approve', authenticate as any, validateBody(customerQuoteDecisionSchema), customerApproveRequestQuote as any);
customerRoutes.post('/requests/:id/quote/reject', authenticate as any, validateBody(customerQuoteDecisionSchema), customerRejectRequestQuote as any);
customerRoutes.post('/requests/:id/payment/initiate', authenticate as any, validateBody(customerPaymentInitiateSchema), initiateCustomerPayment as any);
customerRoutes.get('/requests/:id/payment/status', authenticate as any, getCustomerPaymentStatus as any);
customerRoutes.put('/requests/:id/cancel', authenticate as any, validateBody(customerRequestCancelSchema), cancelCustomerRequest as any);

customerRoutes.get('/profile', authenticate as any, getCustomerProfile as any);
customerRoutes.put('/profile', authenticate as any, updateCustomerProfile as any);
customerRoutes.delete('/account', authenticate as any, deleteCustomerAccount as any);
customerRoutes.get('/notifications', authenticate as any, getCustomerNotifications as any);
customerRoutes.get('/requests/history', authenticate as any, getCustomerRequestsHistory as any);
customerRoutes.get('/support/tickets', authenticate as any, listCustomerSupportTickets as any);
customerRoutes.post('/support/tickets', authenticate as any, validateBody(customerSupportTicketCreateSchema), createCustomerSupportTicket as any);
