export interface ScaleInputs {
  commuters: number;
  legsPerDay: number;
  seats: number;
  tripsPerDay: number;
  occupancyPct: number;
  trunkSharePct: number;
}

export const DEFAULT_SCALE: ScaleInputs = {
  commuters: 100_000_000,
  legsPerDay: 2,
  seats: 15,
  tripsPerDay: 14,
  occupancyPct: 80,
  trunkSharePct: 55,
};

export interface ScaleOutputs {
  dailyLegs: number;
  feederLegs: number;
  effectivePaxPerTrip: number;
  legCapacityPerVehiclePerDay: number;
  fleetIfLinkCarriesEverything: number;
  fleetWithTrunk: number;
  reduction: number;
}

export function computeScale(i: ScaleInputs): ScaleOutputs {
  const dailyLegs = i.commuters * i.legsPerDay;
  const feederLegs = dailyLegs * (1 - i.trunkSharePct / 100);
  const effectivePaxPerTrip = i.seats * (i.occupancyPct / 100);
  const cap = effectivePaxPerTrip * i.tripsPerDay;
  const fleetAll = cap > 0 ? Math.ceil(dailyLegs / cap) : 0;
  const fleetTrunk = cap > 0 ? Math.ceil(feederLegs / cap) : 0;
  const reduction = fleetAll > 0 ? (1 - fleetTrunk / fleetAll) * 100 : 0;
  return {
    dailyLegs,
    feederLegs,
    effectivePaxPerTrip,
    legCapacityPerVehiclePerDay: cap,
    fleetIfLinkCarriesEverything: fleetAll,
    fleetWithTrunk: fleetTrunk,
    reduction,
  };
}
