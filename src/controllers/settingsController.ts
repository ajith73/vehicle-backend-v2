import { Request, Response } from 'express';
import { col, fn, where as sqlWhere } from 'sequelize';
import { ValidationError } from '../errors/AppError';
import { VehicleType, ServiceType, SpecificService } from '../models';
import { handleControllerError } from '../utils/controller';

const normalizeName = (value: unknown) => String(value || '').trim();

const findVehicleByName = async (name: string, excludeId?: string) => {
  const existing = await VehicleType.findOne({
    where: sqlWhere(fn('LOWER', col('name')), name.toLowerCase())
  });

  if (!existing) return null;
  if (excludeId && String(existing.get('id')) === excludeId) return null;
  return existing;
};

const findServiceByName = async (name: string, excludeId?: string) => {
  const existing = await ServiceType.findOne({
    where: sqlWhere(fn('LOWER', col('name')), name.toLowerCase())
  });

  if (!existing) return null;
  if (excludeId && String(existing.get('id')) === excludeId) return null;
  return existing;
};

const findSpecificServiceByName = async (name: string, excludeId?: string) => {
  const existing = await SpecificService.findOne({
    where: sqlWhere(fn('LOWER', col('name')), name.toLowerCase())
  });

  if (!existing) return null;
  if (excludeId && String(existing.get('id')) === excludeId) return null;
  return existing;
};

// Public endpoints
export const getVehicles = async (req: Request, res: Response) => {
  try {
    const vehicles = await VehicleType.findAll({ order: [['isFeatured', 'DESC'], ['orderIndex', 'ASC'], ['name', 'ASC']] });
    res.json(vehicles);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch vehicles');
  }
};

export const getServices = async (req: Request, res: Response) => {
  try {
    const services = await ServiceType.findAll({ order: [['isFeatured', 'DESC'], ['orderIndex', 'ASC'], ['name', 'ASC']] });
    res.json(services);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch services');
  }
};

export const getSpecificServices = async (req: Request, res: Response) => {
  try {
    const specificServices = await SpecificService.findAll({ order: [['isFeatured', 'DESC'], ['orderIndex', 'ASC'], ['name', 'ASC']] });
    res.json(specificServices);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch specific services');
  }
};

// Admin endpoints
export const addVehicle = async (req: Request, res: Response) => {
  try {
    const name = normalizeName(req.body.name);
    const duplicate = await findVehicleByName(name);
    if (duplicate) {
      throw new ValidationError(`Vehicle type "${name}" already exists`);
    }
    const vehicle = await VehicleType.create({ name });
    res.status(201).json(vehicle);
  } catch (error) {
    if (error instanceof ValidationError) {
      return handleControllerError(req, res, error, error.message, error.statusCode);
    }
    handleControllerError(req, res, error, 'Failed to create vehicle type');
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await VehicleType.destroy({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete vehicle type');
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const name = normalizeName(req.body.name);
    const duplicate = await findVehicleByName(name, id);
    if (duplicate) {
      throw new ValidationError(`Vehicle type "${name}" already exists`);
    }
    await VehicleType.update({ name }, { where: { id } });
    res.json({ message: 'Updated successfully' });
  } catch (error) {
    if (error instanceof ValidationError) {
      return handleControllerError(req, res, error, error.message, error.statusCode);
    }
    handleControllerError(req, res, error, 'Failed to update vehicle type');
  }
};

export const addService = async (req: Request, res: Response) => {
  try {
    const name = normalizeName(req.body.name);
    const duplicate = await findServiceByName(name);
    if (duplicate) {
      throw new ValidationError(`Service type "${name}" already exists`);
    }
    const service = await ServiceType.create({ name });
    res.status(201).json(service);
  } catch (error) {
    if (error instanceof ValidationError) {
      return handleControllerError(req, res, error, error.message, error.statusCode);
    }
    handleControllerError(req, res, error, 'Failed to create service type');
  }
};

export const deleteService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await ServiceType.destroy({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete service type');
  }
};

export const updateService = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const name = normalizeName(req.body.name);
    const duplicate = await findServiceByName(name, id);
    if (duplicate) {
      throw new ValidationError(`Service type "${name}" already exists`);
    }
    await ServiceType.update({ name }, { where: { id } });
    res.json({ message: 'Updated successfully' });
  } catch (error) {
    if (error instanceof ValidationError) {
      return handleControllerError(req, res, error, error.message, error.statusCode);
    }
    handleControllerError(req, res, error, 'Failed to update service type');
  }
};

export const addSpecificService = async (req: Request, res: Response) => {
  try {
    const name = normalizeName(req.body.name);
    const duplicate = await findSpecificServiceByName(name);
    if (duplicate) {
      throw new ValidationError(`Service "${name}" already exists`);
    }
    const service = await SpecificService.create({ name });
    res.status(201).json(service);
  } catch (error) {
    if (error instanceof ValidationError) {
      return handleControllerError(req, res, error, error.message, error.statusCode);
    }
    handleControllerError(req, res, error, 'Failed to create specific service');
  }
};

export const deleteSpecificService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await SpecificService.destroy({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete specific service');
  }
};

export const updateSpecificService = async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const name = normalizeName(req.body.name);
    const duplicate = await findSpecificServiceByName(name, id);
    if (duplicate) {
      throw new ValidationError(`Service "${name}" already exists`);
    }
    await SpecificService.update({ name }, { where: { id } });
    res.json({ message: 'Updated successfully' });
  } catch (error) {
    if (error instanceof ValidationError) {
      return handleControllerError(req, res, error, error.message, error.statusCode);
    }
    handleControllerError(req, res, error, 'Failed to update specific service');
  }
};

export const updateFeaturedVehicles = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body; // array of ids in order
    
    // Reset all
    await VehicleType.update({ isFeatured: false, orderIndex: 0 }, { where: {} });
    
    // Update selected sequentially
    for (let i = 0; i < ids.length; i++) {
      await VehicleType.update({ isFeatured: true, orderIndex: i }, { where: { id: ids[i] } });
    }
    res.json({ message: 'Featured vehicles updated' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update featured vehicles');
  }
};

export const updateFeaturedServices = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body; // array of ids in order
    
    // Reset all
    await ServiceType.update({ isFeatured: false, orderIndex: 0 }, { where: {} });
    
    // Update selected sequentially
    for (let i = 0; i < ids.length; i++) {
      await ServiceType.update({ isFeatured: true, orderIndex: i }, { where: { id: ids[i] } });
    }
    res.json({ message: 'Featured services updated' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update featured services');
  }
};

export const updateFeaturedSpecificServices = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body; // array of ids in order
    
    // Reset all
    await SpecificService.update({ isFeatured: false, orderIndex: 0 }, { where: {} });
    
    // Update selected sequentially
    for (let i = 0; i < ids.length; i++) {
      await SpecificService.update({ isFeatured: true, orderIndex: i }, { where: { id: ids[i] } });
    }
    res.json({ message: 'Featured specific services updated' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update featured specific services');
  }
};
