import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { getMechanicPerformanceInsights } from '../controllers/analyticsController';
import { acceptMechanicJob, createMechanicSupportTicket, createOrUpdateMechanicQuote, getMechanicJob, goMechanicOffline, goMechanicOnline, listMechanicJobs, listMechanicNotifications, listMechanicSupportTickets, rejectMechanicJob, updateMechanicJobLifecycle, updateMechanicLiveLocation } from '../controllers/requestOperationsController';
import { streamMechanicJobDetail, streamMechanicJobs } from '../controllers/realtimeController';
import { validateBody } from '../middleware/validation';
import { mechanicJobStatusUpdateSchema, mechanicLiveOfflineSchema, mechanicLiveOnlineSchema, mechanicLocationUpdateSchema, mechanicQuoteSubmissionSchema, mechanicRejectJobSchema, mechanicSupportTicketCreateSchema } from '../validation/schemas';

import { getMechanicEarnings } from '../controllers/financeController';

export const mechanicRoutes = Router();

mechanicRoutes.use(authenticate as any);
mechanicRoutes.get('/jobs', listMechanicJobs as any);
mechanicRoutes.get('/jobs/stream', streamMechanicJobs as any);
mechanicRoutes.get('/jobs/:id', getMechanicJob as any);
mechanicRoutes.get('/jobs/:id/stream', streamMechanicJobDetail as any);
mechanicRoutes.get('/performance/insights', getMechanicPerformanceInsights as any);
mechanicRoutes.post('/live/go-online', validateBody(mechanicLiveOnlineSchema), goMechanicOnline as any);
mechanicRoutes.post('/live/go-offline', validateBody(mechanicLiveOfflineSchema), goMechanicOffline as any);
mechanicRoutes.post('/live/location', validateBody(mechanicLocationUpdateSchema), updateMechanicLiveLocation as any);
mechanicRoutes.post('/jobs/:id/accept', acceptMechanicJob as any);
mechanicRoutes.post('/jobs/:id/reject', validateBody(mechanicRejectJobSchema), rejectMechanicJob as any);
mechanicRoutes.put('/jobs/:id/status', validateBody(mechanicJobStatusUpdateSchema), updateMechanicJobLifecycle as any);
mechanicRoutes.post('/jobs/:id/quote', validateBody(mechanicQuoteSubmissionSchema), createOrUpdateMechanicQuote as any);
mechanicRoutes.get('/earnings', getMechanicEarnings as any);
mechanicRoutes.get('/notifications', listMechanicNotifications as any);
mechanicRoutes.get('/support/tickets', listMechanicSupportTickets as any);
mechanicRoutes.post('/support/tickets', validateBody(mechanicSupportTicketCreateSchema), createMechanicSupportTicket as any);

mechanicRoutes.put('/jobs/:id/quote', validateBody(mechanicQuoteSubmissionSchema), createOrUpdateMechanicQuote as any);
