import { Router } from 'express';
import { getMechanics, getMechanicById, getRoute, submitFeedback, submitDonation, submitMechanicRegistration, checkEmail, sendOtp, verifyOtp, setupAccount, submitVerification, updateVerification } from '../controllers/publicController';
import { getCityPublicConfig, getZonePublicAvailability } from '../controllers/regionalConfigController';
import { getVehicles, getServices, getSpecificServices } from '../controllers/settingsController';
import { submitReview, getMechanicReviews } from '../controllers/reviewController';
import { getSitemap } from '../controllers/sitemapController';
import { validateBody } from '../middleware/validation';
import { donationSubmissionSchema, feedbackSubmissionSchema, publicMechanicSubmissionSchema, routeRequestSchema, reviewSubmissionSchema } from '../validation/schemas';
import { getStates, getCitiesByState } from '../controllers/geoController';

export const publicRoutes = Router();

publicRoutes.get('/geo/states', getStates);
publicRoutes.get('/geo/states/:stateCode/cities', getCitiesByState);

publicRoutes.get('/sitemap.xml', getSitemap);
publicRoutes.get('/mechanics', getMechanics);
publicRoutes.get('/mechanics/:id', getMechanicById);
publicRoutes.get('/cities/:slug/config', getCityPublicConfig as any);
publicRoutes.get('/zones/:slug/availability', getZonePublicAvailability as any);
publicRoutes.post('/mechanics/register', validateBody(publicMechanicSubmissionSchema), submitMechanicRegistration);

publicRoutes.post('/mechanics/:id/submit-verification', submitVerification);
publicRoutes.put('/mechanics/:id/submit-verification/:verificationId', updateVerification);

publicRoutes.post('/mechanics/:id/reviews', validateBody(reviewSubmissionSchema), submitReview);
publicRoutes.get('/mechanics/:id/reviews', getMechanicReviews);

publicRoutes.post('/feedback', validateBody(feedbackSubmissionSchema), submitFeedback);
publicRoutes.post('/donation', validateBody(donationSubmissionSchema), submitDonation);
publicRoutes.post('/route', validateBody(routeRequestSchema), getRoute);

// OTP & Verification
publicRoutes.post('/check-email', checkEmail);
publicRoutes.post('/send-otp', sendOtp);
publicRoutes.post('/verify-otp', verifyOtp);
publicRoutes.post('/setup-account', setupAccount);

// Settings
publicRoutes.get('/vehicles', getVehicles);
publicRoutes.get('/services', getServices);
publicRoutes.get('/specific-services', getSpecificServices);
