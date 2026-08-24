import { Response } from 'express';
import { Mechanic, MechanicUpdateRequest, Feedback, Donation, ActivityLog, User, CustomerRequest } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalMechanics = await Mechanic.count();
    const approvedMechanics = await Mechanic.count({ where: { status: 'Approved' } });
    const pendingMechanics = await Mechanic.count({ where: { status: 'Pending' } });
    const pendingRequests = await MechanicUpdateRequest.count({ where: { status: 'Pending Update Approval' } });
    const customerRequestCount = await CustomerRequest.count();
    const feedbackCount = await Feedback.count();
    const donationCount = await Donation.count();

    const recentActivities = await ActivityLog.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']]
    });

    const recentMechanics = await Mechanic.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']]
    });

    const allMechanics = await Mechanic.findAll({ attributes: ['city', 'createdAt', 'vehicleTypes', 'serviceTypes'] });
    
    const cityCount: Record<string, number> = {};
    const dateCount: Record<string, number> = {};
    const detailedCityStats: Record<string, { total: number; vehicleTypes: Record<string, number>; serviceTypes: Record<string, number> }> = {};
    
    allMechanics.forEach(m => {
      const city = m.dataValues.city || 'Unknown';
      cityCount[city] = (cityCount[city] || 0) + 1;
      
      const dateStr = new Date(m.dataValues.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateCount[dateStr] = (dateCount[dateStr] || 0) + 1;

      if (!detailedCityStats[city]) {
        detailedCityStats[city] = { total: 0, vehicleTypes: {}, serviceTypes: {} };
      }
      detailedCityStats[city].total += 1;

      const vTypes = Array.isArray(m.dataValues.vehicleTypes) ? m.dataValues.vehicleTypes : [];
      const sTypes = Array.isArray(m.dataValues.serviceTypes) ? m.dataValues.serviceTypes : [];

      vTypes.forEach((v: string) => {
        detailedCityStats[city].vehicleTypes[v] = (detailedCityStats[city].vehicleTypes[v] || 0) + 1;
      });
      sTypes.forEach((s: string) => {
        detailedCityStats[city].serviceTypes[s] = (detailedCityStats[city].serviceTypes[s] || 0) + 1;
      });
    });

    const mechanicsByCity = Object.keys(cityCount)
      .map(city => ({ name: city, value: cityCount[city] }))
      .sort((a, b) => b.value - a.value); // Remove slice to return all for frontend, or we just pass the detailed array

    const detailedCityStatsArray = Object.keys(detailedCityStats)
      .map(city => ({
        name: city,
        ...detailedCityStats[city]
      }))
      .sort((a, b) => b.total - a.total);

    const mechanicsByDate = Object.keys(dateCount)
      .map(date => ({ date, count: dateCount[date] }))
      .slice(-10);

    res.json({
      totalMechanics,
      approvedMechanics,
      pendingMechanics,
      pendingRequests,
      customerRequestCount,
      feedbackCount,
      donationCount,
      recentActivities,
      recentMechanics,
      mechanicsByCity,
      mechanicsByDate,
      detailedCityStats: detailedCityStatsArray
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch dashboard stats');
  }
};

export const getActivityLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await ActivityLog.findAll({
      include: [{ model: User, attributes: ['username'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(logs);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch activity logs');
  }
};
