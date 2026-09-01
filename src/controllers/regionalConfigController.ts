import { Response } from 'express';
import { Op } from 'sequelize';
import {
  CityConfig,
  MarketplaceLaunchState,
  Mechanic,
  RegionalPricingRule,
  ServiceAvailabilityRule,
  ServiceType,
  ZoneConfig,
} from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import { handleControllerError } from '../utils/controller';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const normalizeText = (value: unknown) => String(value || '').trim();

const toNumberOrNull = (value: unknown) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ensureCityConfigInventory = async () => {
  const mechanics = await Mechanic.findAll({
    where: {
      city: { [Op.ne]: null }
    } as any,
    attributes: ['city', 'state', 'country']
  });

  const inventory = new Map<string, { cityName: string; slug: string; stateName: string; countryName: string }>();

  mechanics.forEach((mechanic) => {
    const cityName = normalizeText(mechanic.getDataValue('city'));
    if (!cityName) return;

    const slug = slugify(cityName);
    const existing = inventory.get(slug);
    inventory.set(slug, {
      cityName,
      slug,
      stateName: existing?.stateName || normalizeText(mechanic.getDataValue('state')),
      countryName: existing?.countryName || normalizeText(mechanic.getDataValue('country')) || 'India'
    });
  });

  if (inventory.size === 0) {
    return;
  }

  const slugs = Array.from(inventory.keys());
  const existingConfigs = await CityConfig.findAll({
    where: {
      slug: {
        [Op.in]: slugs
      }
    } as any
  });
  const existingBySlug = new Map(existingConfigs.map((config) => [String(config.getDataValue('slug')), config]));

  const missingConfigs = Array.from(inventory.values())
    .filter((item) => !existingBySlug.has(item.slug))
    .map((item) => ({
      cityName: item.cityName,
      slug: item.slug,
      stateName: item.stateName || null,
      countryName: item.countryName || 'India',
      launchState: 'PLANNED',
      rules: {}
    }));

  if (missingConfigs.length > 0) {
    await CityConfig.bulkCreate(missingConfigs as any[]);
    const refreshedConfigs = await CityConfig.findAll({
      where: {
        slug: {
          [Op.in]: slugs
        }
      } as any
    });
    refreshedConfigs.forEach((config) => {
      existingBySlug.set(String(config.getDataValue('slug')), config);
    });
  }

  for (const [slug, item] of inventory.entries()) {
    const cityConfig = existingBySlug.get(slug);
    if (!cityConfig) continue;

    const updates: Record<string, unknown> = {};
    if (!cityConfig.getDataValue('stateName') && item.stateName) updates.stateName = item.stateName;
    if (!cityConfig.getDataValue('countryName') && item.countryName) updates.countryName = item.countryName;
    if (Object.keys(updates).length > 0) {
      await cityConfig.update(updates);
    }
  }
};

const getLaunchStateFor = async (scopeType: 'CITY' | 'ZONE', scopeSlug: string, fallbackState?: string) => {
  const record = await MarketplaceLaunchState.findOne({
    where: { scopeType, scopeSlug },
    order: [['updatedAt', 'DESC']]
  });
  return record || { launchState: fallbackState || 'PLANNED', supportMessage: null, pauseReason: null };
};

export const getCityPublicConfig = async (req: AuthRequest, res: Response) => {
  try {
    const slug = normalizeText(req.params.slug);
    const cityConfig = await CityConfig.findOne({ where: { slug } });
    if (!cityConfig) {
      return res.status(404).json({ error: 'City config not found' });
    }

    const zones = await ZoneConfig.findAll({
      where: {
        [Op.or]: [
          { cityConfigId: cityConfig.getDataValue('id') },
          { cityName: cityConfig.getDataValue('cityName') }
        ]
      } as any,
      order: [['zoneName', 'ASC']]
    });
    const launchState = await getLaunchStateFor('CITY', slug, cityConfig.getDataValue('launchState'));
    const serviceRules = await ServiceAvailabilityRule.findAll({
      where: {
        [Op.or]: [
          { cityConfigId: cityConfig.getDataValue('id') },
          { citySlug: slug }
        ]
      } as any,
      include: [{ model: ServiceType, attributes: ['id', 'name'] }],
      order: [['updatedAt', 'DESC']]
    });
    const pricingRules = await RegionalPricingRule.findAll({
      where: {
        [Op.or]: [
          { cityConfigId: cityConfig.getDataValue('id') },
          { citySlug: slug }
        ]
      } as any,
      include: [{ model: ServiceType, attributes: ['id', 'name'] }],
      order: [['updatedAt', 'DESC']]
    });

    res.json({
      city: cityConfig,
      launchState,
      zones,
      serviceRules,
      pricingRules
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch city config');
  }
};

export const getZonePublicAvailability = async (req: AuthRequest, res: Response) => {
  try {
    const slug = normalizeText(req.params.slug);
    const zone = await ZoneConfig.findOne({ where: { slug } });
    if (!zone) {
      return res.status(404).json({ error: 'Zone config not found' });
    }

    const launchState = await getLaunchStateFor('ZONE', slug, zone.getDataValue('launchState'));
    const serviceRules = await ServiceAvailabilityRule.findAll({
      where: {
        [Op.or]: [
          { zoneConfigId: zone.getDataValue('id') },
          { zoneSlug: slug }
        ]
      } as any,
      include: [{ model: ServiceType, attributes: ['id', 'name'] }]
    });
    const pricingRules = await RegionalPricingRule.findAll({
      where: {
        [Op.or]: [
          { zoneConfigId: zone.getDataValue('id') },
          { zoneSlug: slug }
        ]
      } as any,
      include: [{ model: ServiceType, attributes: ['id', 'name'] }]
    });

    res.json({
      zone,
      launchState,
      serviceRules,
      pricingRules
    });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch zone availability');
  }
};

export const listAdminCities = async (req: AuthRequest, res: Response) => {
  try {
    await ensureCityConfigInventory();
    const cities = await CityConfig.findAll({ order: [['cityName', 'ASC']] });
    const zones = await ZoneConfig.findAll();
    const serviceRules = await ServiceAvailabilityRule.findAll({ include: [{ model: ServiceType, attributes: ['id', 'name'] }] });
    const pricingRules = await RegionalPricingRule.findAll({ include: [{ model: ServiceType, attributes: ['id', 'name'] }] });
    const launchStates = await MarketplaceLaunchState.findAll({ where: { scopeType: 'CITY' } });

    const response = cities.map((city) => {
      const cityId = city.getDataValue('id');
      const slug = city.getDataValue('slug');
      return {
        ...city.toJSON(),
        launchStateRecord: launchStates.find((item) => item.getDataValue('scopeSlug') === slug) || null,
        zones: zones.filter((zone) => zone.getDataValue('cityConfigId') === cityId || normalizeText(zone.getDataValue('cityName')) === normalizeText(city.getDataValue('cityName'))),
        serviceRules: serviceRules.filter((rule) => rule.getDataValue('cityConfigId') === cityId || normalizeText(rule.getDataValue('citySlug')) === slug),
        pricingRules: pricingRules.filter((rule) => rule.getDataValue('cityConfigId') === cityId || normalizeText(rule.getDataValue('citySlug')) === slug)
      };
    });

    res.json(response);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch admin cities');
  }
};

export const updateAdminCityConfig = async (req: AuthRequest, res: Response) => {
  try {
    const cityId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(cityId) || cityId <= 0) {
      return res.status(400).json({ error: 'Invalid city id' });
    }

    const city = await CityConfig.findByPk(cityId);
    if (!city) {
      return res.status(404).json({ error: 'City config not found' });
    }

    const slug = normalizeText(req.body.slug) || slugify(normalizeText(req.body.cityName || city.getDataValue('cityName')));
    await city.update({
      cityName: normalizeText(req.body.cityName || city.getDataValue('cityName')),
      slug,
      stateName: normalizeText(req.body.stateName) || city.getDataValue('stateName'),
      countryName: normalizeText(req.body.countryName) || city.getDataValue('countryName') || 'India',
      launchState: normalizeText(req.body.launchState) || city.getDataValue('launchState'),
      cityTier: normalizeText(req.body.cityTier) || city.getDataValue('cityTier'),
      defaultLanguage: normalizeText(req.body.defaultLanguage) || city.getDataValue('defaultLanguage'),
      membershipBenefitsEnabled: req.body.membershipBenefitsEnabled ?? city.getDataValue('membershipBenefitsEnabled'),
      trustedSupplyThreshold: req.body.trustedSupplyThreshold ?? city.getDataValue('trustedSupplyThreshold'),
      rapidResponseEnabled: req.body.rapidResponseEnabled ?? city.getDataValue('rapidResponseEnabled'),
      seoIntro: req.body.seoIntro ?? city.getDataValue('seoIntro'),
      operationalNotes: req.body.operationalNotes ?? city.getDataValue('operationalNotes'),
      rules: req.body.rules ?? city.getDataValue('rules') ?? {}
    });

    const existingLaunch = await MarketplaceLaunchState.findOne({ where: { scopeType: 'CITY', scopeSlug: slug } });
    if (existingLaunch) {
      await existingLaunch.update({
        launchState: city.getDataValue('launchState'),
        supportMessage: req.body.operationalNotes || existingLaunch.getDataValue('supportMessage'),
        metadata: {
          cityConfigId: cityId,
          updatedByUserId: req.user?.userId || null
        }
      });
    } else {
      await MarketplaceLaunchState.create({
        scopeType: 'CITY',
        scopeSlug: slug,
        launchState: city.getDataValue('launchState'),
        supportMessage: req.body.operationalNotes || null,
        metadata: {
          cityConfigId: cityId,
          updatedByUserId: req.user?.userId || null
        }
      });
    }

    res.json({ message: 'City config updated', city });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update city config');
  }
};

export const listAdminZones = async (req: AuthRequest, res: Response) => {
  try {
    const zones = await ZoneConfig.findAll({
      include: [{ model: CityConfig }],
      order: [['cityName', 'ASC'], ['zoneName', 'ASC']]
    });
    res.json(zones);
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to fetch admin zones');
  }
};

export const updateAdminZoneConfig = async (req: AuthRequest, res: Response) => {
  try {
    const zoneId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(zoneId) || zoneId <= 0) {
      return res.status(400).json({ error: 'Invalid zone id' });
    }

    const zone = await ZoneConfig.findByPk(zoneId);
    if (!zone) {
      return res.status(404).json({ error: 'Zone config not found' });
    }

    const slug = normalizeText(req.body.slug) || slugify(`${normalizeText(req.body.cityName || zone.getDataValue('cityName'))}-${normalizeText(req.body.zoneName || zone.getDataValue('zoneName'))}`);
    await zone.update({
      cityConfigId: req.body.cityConfigId ?? zone.getDataValue('cityConfigId'),
      cityName: normalizeText(req.body.cityName || zone.getDataValue('cityName')),
      zoneName: normalizeText(req.body.zoneName || zone.getDataValue('zoneName')),
      slug,
      launchState: normalizeText(req.body.launchState) || zone.getDataValue('launchState'),
      rapidResponseEnabled: req.body.rapidResponseEnabled ?? zone.getDataValue('rapidResponseEnabled'),
      standbySupplyTarget: req.body.standbySupplyTarget ?? zone.getDataValue('standbySupplyTarget'),
      etaExpectationMinutes: req.body.etaExpectationMinutes ?? zone.getDataValue('etaExpectationMinutes'),
      pricingMultiplier: req.body.pricingMultiplier ?? zone.getDataValue('pricingMultiplier'),
      serviceAvailabilityMode: normalizeText(req.body.serviceAvailabilityMode) || zone.getDataValue('serviceAvailabilityMode'),
      operationalNotes: req.body.operationalNotes ?? zone.getDataValue('operationalNotes'),
      rules: req.body.rules ?? zone.getDataValue('rules') ?? {}
    });

    const existingLaunch = await MarketplaceLaunchState.findOne({ where: { scopeType: 'ZONE', scopeSlug: slug } });
    if (existingLaunch) {
      await existingLaunch.update({
        launchState: zone.getDataValue('launchState'),
        supportMessage: req.body.operationalNotes || existingLaunch.getDataValue('supportMessage'),
        metadata: {
          zoneConfigId: zoneId,
          updatedByUserId: req.user?.userId || null
        }
      });
    } else {
      await MarketplaceLaunchState.create({
        scopeType: 'ZONE',
        scopeSlug: slug,
        launchState: zone.getDataValue('launchState'),
        supportMessage: req.body.operationalNotes || null,
        metadata: {
          zoneConfigId: zoneId,
          updatedByUserId: req.user?.userId || null
        }
      });
    }

    res.json({ message: 'Zone config updated', zone });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update zone config');
  }
};

export const createAdminZoneConfig = async (req: AuthRequest, res: Response) => {
  try {
    const slug = normalizeText(req.body.slug) || slugify(`${normalizeText(req.body.cityName)}-${normalizeText(req.body.zoneName)}`);
    const zone = await ZoneConfig.create({
      cityConfigId: req.body.cityConfigId ?? null,
      cityName: normalizeText(req.body.cityName),
      zoneName: normalizeText(req.body.zoneName),
      slug,
      launchState: normalizeText(req.body.launchState) || 'PLANNED',
      rapidResponseEnabled: Boolean(req.body.rapidResponseEnabled),
      standbySupplyTarget: req.body.standbySupplyTarget ?? null,
      etaExpectationMinutes: req.body.etaExpectationMinutes ?? null,
      pricingMultiplier: req.body.pricingMultiplier ?? null,
      serviceAvailabilityMode: normalizeText(req.body.serviceAvailabilityMode) || 'NORMAL',
      operationalNotes: req.body.operationalNotes || null,
      rules: req.body.rules || {}
    });

    await MarketplaceLaunchState.create({
      scopeType: 'ZONE',
      scopeSlug: slug,
      launchState: zone.getDataValue('launchState'),
      supportMessage: req.body.operationalNotes || null,
      metadata: {
        zoneConfigId: zone.getDataValue('id'),
        updatedByUserId: req.user?.userId || null
      }
    });

    res.status(201).json({ message: 'Zone config created', zone });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to create zone config');
  }
};

export const upsertServiceAvailabilityRule = async (req: AuthRequest, res: Response) => {
  try {
    const serviceTypeId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(serviceTypeId) || serviceTypeId <= 0) {
      return res.status(400).json({ error: 'Invalid service id' });
    }

    const service = await ServiceType.findByPk(serviceTypeId);
    if (!service) {
      return res.status(404).json({ error: 'Service type not found' });
    }

    const citySlug = normalizeText(req.body.citySlug) || null;
    const zoneSlug = normalizeText(req.body.zoneSlug) || null;
    let rule = await ServiceAvailabilityRule.findOne({
      where: {
        serviceTypeId,
        citySlug,
        zoneSlug
      } as any
    });

    const payload = {
      serviceTypeId,
      cityConfigId: req.body.cityConfigId ?? null,
      zoneConfigId: req.body.zoneConfigId ?? null,
      citySlug,
      zoneSlug,
      availabilityState: normalizeText(req.body.availabilityState) || 'ENABLED',
      customerMessage: req.body.customerMessage || null,
      minTrustedPartners: req.body.minTrustedPartners ?? null,
      rapidResponseOnly: Boolean(req.body.rapidResponseOnly),
      rules: req.body.rules || {}
    };

    if (rule) {
      await rule.update(payload);
    } else {
      rule = await ServiceAvailabilityRule.create(payload);
    }

    res.json({ message: 'Service availability rule updated', rule, service });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update service availability rule');
  }
};

export const upsertRegionalPricingRule = async (req: AuthRequest, res: Response) => {
  try {
    const pricingRuleId = Number.parseInt(String(req.params.id), 10);
    if (!Number.isInteger(pricingRuleId) || pricingRuleId <= 0) {
      return res.status(400).json({ error: 'Invalid pricing rule id' });
    }

    const citySlug = normalizeText(req.body.citySlug) || null;
    const zoneSlug = normalizeText(req.body.zoneSlug) || null;
    let rule = await RegionalPricingRule.findByPk(pricingRuleId);

    const payload = {
      cityConfigId: req.body.cityConfigId ?? null,
      zoneConfigId: req.body.zoneConfigId ?? null,
      serviceTypeId: req.body.serviceTypeId ?? null,
      citySlug,
      zoneSlug,
      ruleName: normalizeText(req.body.ruleName),
      pricingMode: normalizeText(req.body.pricingMode) || 'MULTIPLIER',
      multiplier: toNumberOrNull(req.body.multiplier),
      flatFee: toNumberOrNull(req.body.flatFee),
      taxPercent: toNumberOrNull(req.body.taxPercent),
      memberDiscountPercent: toNumberOrNull(req.body.memberDiscountPercent),
      rules: req.body.rules || {}
    };

    if (rule) {
      await rule.update(payload);
    } else {
      rule = await RegionalPricingRule.create({
        id: pricingRuleId,
        ...payload
      } as any);
    }

    res.json({ message: 'Regional pricing rule updated', rule });
  } catch (error) {
    handleControllerError(req, res, error, 'Failed to update regional pricing rule');
  }
};
