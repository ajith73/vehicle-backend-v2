import { Request, Response } from 'express';
import { State, City } from 'country-state-city';

export const getStates = (req: Request, res: Response) => {
  try {
    const states = State.getStatesOfCountry('IN'); // Assuming India based on existing logic
    res.json(states);
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
};

export const getCitiesByState = (req: Request, res: Response) => {
  try {
    const { stateCode } = req.params;
    if (!stateCode) {
      return res.status(400).json({ error: 'State code is required' });
    }
    const cities = City.getCitiesOfState('IN', stateCode as string);
    res.json(cities);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
};
