import { Response } from 'express';
import axios from 'axios';
import { Op, col, fn, where as sqlWhere } from 'sequelize';
import { Mechanic, MechanicUpdateRequest, ActivityLog, TrustedPartnerAudit, User, VerificationRequest } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';

export const getMechanics = async (req: AuthRequest, res: Response) => {
  try {
    const mechanics = await Mechanic.findAll();
    res.json(mechanics);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanics');
  }
};

export const getVerificationRequests = async (req: AuthRequest, res: Response) => {
  try {
    const requests = await VerificationRequest.findAll({
      include: [{ model: Mechanic }],
      order: [['createdAt', 'DESC']]
    });
    res.json(requests);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch verification requests');
  }
};

export const approveVerificationRequest = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const request = await VerificationRequest.findByPk(id, { include: [Mechanic] });
    
    if (!request) return res.status(404).json({ error: 'Verification request not found' });
    
    request.status = 'Approved';
    await request.save();

    // Give them Level 4 verification for example, assuming contact and location are verified in flow
    if (request.Mechanic) {
      const mechanic: any = request.Mechanic;
      
      // Apply deferred mechanic details updates
      const submittedDataObj = (request.submittedData as any) || {};
      if (submittedDataObj.__mechanicDetails) {
        await mechanic.update(submittedDataObj.__mechanicDetails);
      }
      
      // Assign ownership if a new user was created for this verification
      if (submittedDataObj.__userId) {
        await mechanic.update({ createdById: submittedDataObj.__userId });
      }
      
      const checklist = mechanic.verificationChecklist || {};
      
      // Merge all other submitted data (like pricing and services) into checklist
      for (const key of Object.keys(submittedDataObj)) {
        if (!key.startsWith('__')) {
          checklist[key] = submittedDataObj[key];
        }
      }
      

      mechanic.verificationLevel = 4;
      mechanic.set('verificationChecklist', checklist);
      mechanic.changed('verificationChecklist', true);
      
      await mechanic.save();
    }

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Verification Request Approved',
      details: `Approved verification request ID ${id} for mechanic ID ${request.mechanicId}.`
    });

    res.json({ message: 'Verification request approved successfully', request });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to approve verification request');
  }
};

export const rejectVerificationRequest = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { remarks } = req.body;

    const request = await VerificationRequest.findByPk(id);
    if (!request) return res.status(404).json({ error: 'Verification request not found' });
    
    request.status = 'Rejected';
    if (remarks) request.remarks = remarks;
    await request.save();

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Verification Request Rejected',
      details: `Rejected verification request ID ${id} for mechanic ID ${request.mechanicId}.`
    });

    res.json({ message: 'Verification request rejected successfully', request });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to reject verification request');
  }
};

export const deleteVerificationRequest = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const request = await VerificationRequest.findByPk(id);
    if (!request) return res.status(404).json({ error: 'Verification request not found' });
    
    await request.destroy();

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Verification Request Deleted',
      details: `Deleted verification request ID ${id} for mechanic ID ${request.mechanicId}.`
    });

    res.json({ message: 'Verification request deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete verification request');
  }
};

export const getMechanicById = async (req: AuthRequest, res: Response) => {
  try {
    const mechanicId = parseInt(req.params.id as string, 10);
    if (isNaN(mechanicId)) return res.status(400).json({ error: 'Invalid Mechanic ID' });
    const mechanic = await Mechanic.findByPk(mechanicId);
    if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });
    res.json(mechanic);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch mechanic');
  }
};

export const updateMechanicTrustStatus = async (req: AuthRequest, res: Response) => {
  try {
    const mechanicId = parseInt(req.params.id as string, 10);
    if (isNaN(mechanicId)) return res.status(400).json({ error: 'Invalid Mechanic ID' });
    const mechanic = await Mechanic.findByPk(mechanicId);
    if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });

    const payload = {
      isTrustedPartner: Boolean(req.body.isTrustedPartner),
      partnerTier: req.body.partnerTier || null,
      trustScore: req.body.trustScore ?? null,
      priorityDispatchEligible: Boolean(req.body.priorityDispatchEligible)
    };

    await mechanic.update(payload);
    await TrustedPartnerAudit.create({
      mechanicId,
      changedByUserId: req.user?.userId || null,
      isTrustedPartner: payload.isTrustedPartner,
      partnerTier: payload.partnerTier,
      trustScore: payload.trustScore,
      reason: req.body.reason || null
    });

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Updated Mechanic Trust Status',
      details: `Mechanic ID ${mechanicId} trust updated to trusted=${payload.isTrustedPartner}, tier=${payload.partnerTier || 'none'}.`
    });

    res.json({ message: 'Mechanic trust status updated', mechanic });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update mechanic trust status');
  }
};

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const normalizePhoneNumbers = (phoneList: unknown) => {
  if (!Array.isArray(phoneList)) return [] as string[];
  return phoneList
    .map((phone: any) => String(phone?.number || '').replace(/\D/g, ''))
    .filter(Boolean)
    .sort();
};

const normalizeEmails = (emails: unknown) => {
  if (!Array.isArray(emails)) return [] as string[];
  return emails
    .map((email) => normalizeText(email))
    .filter(Boolean)
    .sort();
};

const buildMechanicDuplicateSignature = (data: any) => {
  const signature = {
    businessName: normalizeText(data.businessName || data.name),
    mechanicName: normalizeText(data.mechanicName),
    city: normalizeText(data.city),
    phones: normalizePhoneNumbers(data.phone),
    emails: normalizeEmails(data.emails),
  };

  if (!signature.businessName && !signature.mechanicName && !signature.city && signature.phones.length === 0 && signature.emails.length === 0) {
    return null;
  }

  return JSON.stringify(signature);
};

const findDuplicateMechanic = async (data: any, excludeId?: number) => {
  const normalizedBusinessName = normalizeText(data.businessName || data.name);
  const normalizedMechanicName = normalizeText(data.mechanicName);
  const normalizedCity = normalizeText(data.city);
  const newPhones = normalizePhoneNumbers(data.phone);
  const newEmails = normalizeEmails(data.emails);

  if (!normalizedBusinessName && !normalizedMechanicName && !normalizedCity && newPhones.length === 0 && newEmails.length === 0) {
    return null;
  }

  const where: any = {};
  const orClauses: any[] = [];

  if (normalizedBusinessName) {
    orClauses.push(sqlWhere(fn('LOWER', col('businessName')), normalizedBusinessName));
    orClauses.push(sqlWhere(fn('LOWER', col('name')), normalizedBusinessName));
  }
  if (normalizedMechanicName) {
    orClauses.push(sqlWhere(fn('LOWER', col('mechanicName')), normalizedMechanicName));
  }
  if (normalizedCity) {
    orClauses.push(sqlWhere(fn('LOWER', col('city')), normalizedCity));
  }

  if (orClauses.length > 0) {
    where[Op.or] = orClauses;
  }

  if (excludeId) {
    where.id = { [Op.ne]: excludeId };
  }

  const existingMechanics = await Mechanic.findAll({ where });

  for (const mechanic of existingMechanics) {
    const existingBusinessName = normalizeText(mechanic.dataValues.businessName || mechanic.dataValues.name);
    const existingMechanicName = normalizeText(mechanic.dataValues.mechanicName);
    const existingCity = normalizeText(mechanic.dataValues.city);

    const businessNameMatches = normalizedBusinessName ? existingBusinessName === normalizedBusinessName : true;
    const mechanicNameMatches = normalizedMechanicName ? existingMechanicName === normalizedMechanicName : true;
    const cityMatches = normalizedCity ? existingCity === normalizedCity : true;

    const existingPhones = normalizePhoneNumbers(mechanic.dataValues.phone);
    const phoneMatches = newPhones.length > 0 && existingPhones.length > 0 
      ? newPhones.some((p: string) => existingPhones.includes(p))
      : (newPhones.length === 0 && existingPhones.length === 0);

    const existingEmails = normalizeEmails(mechanic.dataValues.emails);
    const emailMatches = newEmails.length > 0 && existingEmails.length > 0
      ? newEmails.some((e: string) => existingEmails.includes(e))
      : (newEmails.length === 0 && existingEmails.length === 0);

    if (businessNameMatches && mechanicNameMatches && cityMatches && phoneMatches && emailMatches) {
      return mechanic;
    }
  }
  return null;
};

const isDuplicateMechanic = async (data: any, excludeId?: number) => {
  const existingMechanic = await findDuplicateMechanic(data, excludeId);
  return Boolean(existingMechanic);
};

const findDuplicateInMemory = (data: any, existingMechanics: any[]) => {
  const normalizedBusinessName = normalizeText(data.businessName || data.name);
  const normalizedMechanicName = normalizeText(data.mechanicName);
  const normalizedCity = normalizeText(data.city);
  const newPhones = normalizePhoneNumbers(data.phone);
  const newEmails = normalizeEmails(data.emails);

  if (!normalizedBusinessName && !normalizedMechanicName && !normalizedCity && newPhones.length === 0 && newEmails.length === 0) {
    return null;
  }

  for (const mechanic of existingMechanics) {
    const existingBusinessName = normalizeText(mechanic.businessName || mechanic.name);
    const existingMechanicName = normalizeText(mechanic.mechanicName);
    const existingCity = normalizeText(mechanic.city);

    const businessNameMatches = normalizedBusinessName ? existingBusinessName === normalizedBusinessName : true;
    const mechanicNameMatches = normalizedMechanicName ? existingMechanicName === normalizedMechanicName : true;
    const cityMatches = normalizedCity ? existingCity === normalizedCity : true;

    const existingPhones = normalizePhoneNumbers(mechanic.phone);
    const phoneMatches = newPhones.length > 0 && existingPhones.length > 0 
      ? newPhones.some((p: string) => existingPhones.includes(p))
      : (newPhones.length === 0 && existingPhones.length === 0);

    const existingEmails = normalizeEmails(mechanic.emails);
    const emailMatches = newEmails.length > 0 && existingEmails.length > 0
      ? newEmails.some((e: string) => existingEmails.includes(e))
      : (newEmails.length === 0 && existingEmails.length === 0);

    if (businessNameMatches && mechanicNameMatches && cityMatches && phoneMatches && emailMatches) {
      return mechanic;
    }
  }
  return null;
};

export const createMechanic = async (req: AuthRequest, res: Response) => {
  try {
    const mechanicData = req.body;

    const isDuplicate = await isDuplicateMechanic(mechanicData);
    if (isDuplicate) {
      return res.status(409).json({ error: 'A mechanic with this exact Business Name, Mechanic Name, Phone, Email, and City already exists.' });
    }

    const role = req.user?.role;
    const initialStatus = role === 'Super Admin' ? 'Approved' : 'Pending';

    const mechanic = await Mechanic.create({
      ...mechanicData,
      name: mechanicData.businessName || mechanicData.name, // Ensure name is populated as fallback
      status: initialStatus,
      createdById: req.user?.userId
    });

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Created Mechanic',
      details: `Mechanic ${mechanic.dataValues.businessName || mechanic.dataValues.name} created and pending approval.`
    });

    res.status(201).json({ 
      ...mechanic.toJSON(), 
      message: role === 'Super Admin' ? 'Mechanic created successfully' : 'Mechanic creation pending approval' 
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to create mechanic');
  }
};

export const bulkCreateMechanics = async (req: AuthRequest, res: Response) => {
  try {
    const mechanics = req.body.mechanics;
    const role = req.user?.role;
    const initialStatus = role === 'Super Admin' ? 'Approved' : 'Pending';
    const mechanicsPayload = [];
    const duplicates: Array<{ index: number; businessName: string; reason: string }> = [];
    const seenSignatures = new Set<string>();

    const allExistingMechanics = await Mechanic.findAll({
      attributes: ['id', 'businessName', 'name', 'mechanicName', 'city', 'phone', 'emails']
    });
    const existingMechanicsData = allExistingMechanics.map(m => m.dataValues);

    for (let index = 0; index < mechanics.length; index += 1) {
      const mechanicData = mechanics[index];
      const duplicateSignature = buildMechanicDuplicateSignature(mechanicData);

      if (duplicateSignature && seenSignatures.has(duplicateSignature)) {
        duplicates.push({
          index,
          businessName: mechanicData.businessName || mechanicData.name || mechanicData.mechanicName || `Row ${index + 1}`,
          reason: 'Duplicate record within this upload file'
        });
        continue;
      }

      const existingMechanic = findDuplicateInMemory(mechanicData, existingMechanicsData);
      if (existingMechanic) {
        duplicates.push({
          index,
          businessName: mechanicData.businessName || mechanicData.name || mechanicData.mechanicName || `Row ${index + 1}`,
          reason: 'A matching mechanic already exists'
        });
        continue;
      }

      if (duplicateSignature) {
        seenSignatures.add(duplicateSignature);
      }

      mechanicsPayload.push({
        ...mechanicData,
        name: mechanicData.businessName || mechanicData.name,
        status: initialStatus,
        createdById: req.user?.userId
      });
    }

    const createdMechanics = mechanicsPayload.length > 0 ? await Mechanic.bulkCreate(mechanicsPayload) : [];

    if (createdMechanics.length > 0) {
      await ActivityLog.create({
        userId: req.user?.userId,
        action: 'Bulk Created Mechanics',
        details: `${createdMechanics.length} mechanics created${duplicates.length > 0 ? `, ${duplicates.length} duplicates skipped` : ''}.`
      });
    }

    const createdCount = createdMechanics.length;
    const duplicateCount = duplicates.length;
    const message = createdCount > 0
      ? role === 'Super Admin'
        ? duplicateCount > 0
          ? `Saved ${createdCount} mechanic(s). Skipped ${duplicateCount} duplicate row(s).`
          : 'Bulk upload successful!'
        : duplicateCount > 0
          ? `Submitted ${createdCount} mechanic(s). Skipped ${duplicateCount} duplicate row(s).`
          : 'Bulk upload submitted as pending request'
      : duplicateCount > 0
        ? 'No mechanics were saved because all selected rows were duplicates.'
        : 'No mechanics were saved.';

    res.status(createdCount > 0 ? 201 : 200).json({
      message,
      count: createdCount,
      createdCount,
      duplicateCount,
      duplicates
    });
  } catch (error: any) {
    handleControllerError(req, res, error, 'Failed to bulk create mechanics');
  }
};

export const updateMechanic = async (req: AuthRequest, res: Response) => {
  try {
    const mechanicId = parseInt(req.params.id as string, 10);
    const updateData = req.body;
    const role = req.user?.role;

    const isDuplicate = await isDuplicateMechanic(updateData, mechanicId);
    if (isDuplicate) {
      return res.status(409).json({ error: 'Update failed: A mechanic with these identical details already exists.' });
    }

    if (role === 'Super Admin') {
      await Mechanic.update(updateData, { where: { id: mechanicId } });
      await ActivityLog.create({
        userId: req.user?.userId,
        action: 'Updated Mechanic',
        details: `Super Admin updated mechanic ID ${mechanicId}.`
      });
      return res.json({ message: 'Mechanic updated successfully' });
    } else {
      const request = await MechanicUpdateRequest.create({
        mechanicId,
        updatedData: updateData,
        status: 'Pending Update Approval',
        requestedById: req.user?.userId
      });
      await ActivityLog.create({
        userId: req.user?.userId,
        action: 'Created Update Request',
        details: `Admin requested update for mechanic ID ${mechanicId}.`
      });
      return res.status(201).json({ message: 'Update request submitted', request });
    }
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update mechanic');
  }
};

export const bulkUpdateMechanicsStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { ids, status, remarks } = req.body;
    
    await Mechanic.update({ status, remarks, approvedById: status === 'Approved' ? req.user?.userId : null }, { where: { id: ids } });
    
    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Bulk Updated Mechanics',
      details: `Super Admin updated ${ids.length} mechanics to status ${status}.`
    });

    res.json({ message: 'Mechanics updated successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to bulk update mechanics');
  }
};

export const deleteMechanic = async (req: AuthRequest, res: Response) => {
  try {
    const mechanicId = parseInt(req.params.id as string, 10);
    const mechanic = await Mechanic.findByPk(mechanicId);
    if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });
    await mechanic.destroy();
    
    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Deleted Mechanic',
      details: `Super Admin deleted mechanic ID ${mechanicId}.`
    });

    res.json({ message: 'Mechanic deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete mechanic');
  }
};

export const approveMechanic = async (req: AuthRequest, res: Response) => {
  try {
    const mechanicId = parseInt(req.params.id as string, 10);
    await Mechanic.update({ status: 'Approved', approvedById: req.user?.userId }, { where: { id: mechanicId } });
    
    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Approved Mechanic',
      details: `Mechanic ID ${mechanicId} was approved.`
    });
    
    res.json({ message: 'Mechanic approved' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to approve mechanic');
  }
};

export const getUpdateRequests = async (req: AuthRequest, res: Response) => {
  try {
    const role = req.user?.role;
    const whereClause = role === 'Admin' ? { requestedById: req.user?.userId } : {};

    const requests = await MechanicUpdateRequest.findAll({
      where: whereClause,
      include: [
        { model: Mechanic },
        { model: User, as: 'Requestor', attributes: ['username'] }
      ]
    });
    const serializedRequests = requests.map((request) => {
      const requestJson = request.toJSON() as any;
      const updatedData = requestJson.updatedData && typeof requestJson.updatedData === 'object' ? requestJson.updatedData : {};
      const requesterDisplayName =
        requestJson.Requestor?.username ||
        updatedData.mechanicName ||
        updatedData.businessName ||
        updatedData.name ||
        requestJson.Mechanic?.mechanicName ||
        requestJson.Mechanic?.businessName ||
        requestJson.Mechanic?.name ||
        'Public User';

      return {
        ...requestJson,
        requesterDisplayName
      };
    });

    res.json(serializedRequests);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch update requests');
  }
};

export const approveUpdateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.id as string, 10);
    const request = await MechanicUpdateRequest.findByPk(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.dataValues.status !== 'Pending Update Approval') return res.status(400).json({ error: 'Request already processed' });

    const isDuplicate = await isDuplicateMechanic(request.dataValues.updatedData || {}, request.dataValues.mechanicId);
    if (isDuplicate) {
      return res.status(409).json({ error: 'Cannot approve this request because a mechanic with these identical details already exists.' });
    }

    if (request.dataValues.mechanicId) {
      await Mechanic.update(request.dataValues.updatedData, { where: { id: request.dataValues.mechanicId } });
    } else {
      await Mechanic.create({
        ...request.dataValues.updatedData,
        name: request.dataValues.updatedData?.businessName || request.dataValues.updatedData?.name,
        status: 'Approved',
        createdById: null,
        approvedById: req.user?.userId
      });
    }
    
    await request.update({ status: 'Approved', reviewedById: req.user?.userId });

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Approved Update Request',
      details: request.dataValues.mechanicId
        ? `Update request ${requestId} approved and applied to mechanic ID ${request.dataValues.mechanicId}.`
        : `New mechanic request ${requestId} approved and created as a live mechanic record.`
    });

    res.json({ message: request.dataValues.mechanicId ? 'Update applied successfully' : 'Mechanic created successfully from request' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to approve update request');
  }
};

export const rejectUpdateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.id as string, 10);
    const { remarks } = req.body;
    
    await MechanicUpdateRequest.update(
      { status: 'Rejected', reviewedById: req.user?.userId, remarks }, 
      { where: { id: requestId } }
    );

    res.json({ message: 'Update request rejected' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to reject update request');
  }
};

export const deleteUpdateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.id as string, 10);
    const request = await MechanicUpdateRequest.findByPk(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    await request.destroy();

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Deleted Update Request',
      details: `Super Admin deleted update request ID ${requestId}.`
    });

    res.json({ message: 'Update request deleted successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to delete update request');
  }
};

export const getUpdateRequestById = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.id as string, 10);
    if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid Request ID' });

    const request = await MechanicUpdateRequest.findByPk(requestId, {
      include: [
        { model: Mechanic },
        { model: User, as: 'Requestor', attributes: ['username'] }
      ]
    });

    if (!request) return res.status(404).json({ error: 'Update request not found' });
    
    // Format similar to getUpdateRequests
    const requestJson = request.toJSON() as any;
    const updatedData = requestJson.updatedData && typeof requestJson.updatedData === 'object' ? requestJson.updatedData : {};
    const requesterDisplayName =
      requestJson.Requestor?.username ||
      updatedData.mechanicName ||
      updatedData.businessName ||
      updatedData.name ||
      requestJson.Mechanic?.mechanicName ||
      requestJson.Mechanic?.businessName ||
      requestJson.Mechanic?.name ||
      'Public User';
      
    res.json({
      ...requestJson,
      requesterDisplayName
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch update request');
  }
};

export const updateUpdateRequest = async (req: AuthRequest, res: Response) => {
  try {
    const requestId = parseInt(req.params.id as string, 10);
    if (isNaN(requestId)) return res.status(400).json({ error: 'Invalid Request ID' });

    const request = await MechanicUpdateRequest.findByPk(requestId);
    if (!request) return res.status(404).json({ error: 'Update request not found' });

    // Check ownership for normal admins
    if (req.user?.role !== 'Super Admin' && request.getDataValue('requestedById') !== req.user?.userId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own update requests' });
    }

    // Update the data
    request.set('updatedData', req.body);
    
    // If it was rejected, put it back to pending
    if (request.getDataValue('status') === 'Rejected') {
      request.set('status', 'Pending Update Approval');
    }

    await request.save();

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Modified Update Request',
      details: `Admin modified update request ID ${requestId}.`
    });

    res.json({ message: 'Update request modified successfully' });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to modify update request');
  }
};

export const fetchFromGMapsScraper = async (req: AuthRequest, res: Response) => {
  try {
    const { start, end, limit } = req.query;
    
    // Calling the GMapsScraper API running on localhost:8765
    let scraperUrl = process.env.GMAPS_SCRAPER_URL || 'http://localhost:8765/api/records';
    
    const params = new URLSearchParams();
    if (start) params.append('start', String(start));
    if (end) params.append('end', String(end));
    if (limit) params.append('limit', String(limit));
    
    const queryString = params.toString();
    if (queryString) {
      scraperUrl += `?${queryString}`;
    }

    const response = await axios.get(scraperUrl);
    
    // The scraper API returns { records: [...], job: {...} }
    const records = response.data.records || response.data;
    res.json(records);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch data from GMapsScraper');
  }
};

export const updateVerification = async (req: AuthRequest, res: Response) => {
  try {
    const mechanicId = parseInt(req.params.id as string, 10);
    if (isNaN(mechanicId)) return res.status(400).json({ error: 'Invalid Mechanic ID' });

    const mechanic = await Mechanic.findByPk(mechanicId);
    if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });

    const { verificationLevel, verificationChecklist } = req.body;

    await mechanic.update({
      verificationLevel: verificationLevel !== undefined ? verificationLevel : mechanic.getDataValue('verificationLevel'),
      verificationChecklist: verificationChecklist !== undefined ? verificationChecklist : mechanic.getDataValue('verificationChecklist')
    });

    await ActivityLog.create({
      userId: req.user?.userId,
      action: 'Updated Verification',
      details: `Admin updated verification level to ${verificationLevel} for mechanic ID ${mechanicId}.`
    });

    res.json({ message: 'Mechanic verification updated successfully', mechanic });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update verification');
  }
};
