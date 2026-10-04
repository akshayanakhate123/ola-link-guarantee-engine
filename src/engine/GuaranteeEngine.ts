/**
 * GuaranteeEngine: pure logic module. No JSX, no randomness outside the
 * seeded generator, no I/O. Times are integer minutes from midnight.
 */

// ---------------------------------------------------------------- constants

export const RECOVERY_BUDGET = 2400;
export const PARTNER_RIDE_COST = 180;
export const FARE_CREDIT = 40;
export const MAX_HOLD_MIN = 4;
export const ALT_PICKUP_MAX_M = 600;
export const WALK_M_PER_MIN = 80;
export const HIT_RATE_THRESHOLD = 95;
export const WINDOW_BAND = 10;
export const METRO_RIDE_MIN = 14;
export const READY_EARLY_MIN = 10;
export const SEED = 2035;
export const BASE_JOURNEYS = 38;
export const MAX_SPIKE_POOL = 23; // 60% of 38, rounded

export type VehicleId = 'podA' | 'podB' | 'shA' | 'shB';
export type Status = 'PENDING' | 'ON_TIME' | 'RECOVERED' | 'MISSED';
export type EngineMode = 'ON' | 'OFF';

export interface Vehicle {
  id: VehicleId;
  name: string;
  type: 'Pod' | 'Shuttle';
  seats: number;
  departures: number[];
  stops: number[]; // stop ids served
}

export const VEHICLES: Vehicle[] = [
  { id: 'podA', name: 'Pod A', type: 'Pod', seats: 4, departures: [455, 485, 515, 545], stops: [1, 2, 3] },
  { id: 'podB', name: 'Pod B', type: 'Pod', seats: 4, departures: [465, 495, 525, 555], stops: [4, 5, 6] },
  { id: 'shA', name: 'Shuttle A', type: 'Shuttle', seats: 12, departures: [460, 490, 520, 550], stops: [1, 2, 3, 4] },
  { id: 'shB', name: 'Shuttle B', type: 'Shuttle', seats: 12, departures: [470, 500, 530, 560], stops: [3, 4, 5, 6] },
];

export const TOTAL_SEAT_SLOTS = VEHICLES.reduce((s, v) => s + v.seats * v.departures.length, 0);

export interface Stop {
  id: number;
  name: string;
  distKm: number;
  roadMin: number; // road time to the anchor at 1.0x traffic
  x: number;
  y: number;
}

const STOP_DIST: [number, number][] = [
  [1, 1.6],
  [2, 2.0],
  [3, 2.4],
  [4, 2.8],
  [5, 2.2],
  [6, 1.8],
];
const STOP_XY: [number, number][] = [
  [395, 285],
  [290, 300],
  [185, 255],
  [110, 170],
  [165, 80],
  [285, 45],
];

export const STOPS: Stop[] = STOP_DIST.map(([id, km], i) => ({
  id,
  name: `Stop ${id}`,
  distKm: km,
  roadMin: Math.round(km * 5) + 3,
  x: STOP_XY[i][0],
  y: STOP_XY[i][1],
}));

/** Walking distance in metres between consecutive stops (Stop i to Stop i+1). */
const WALK_STEPS_M = [450, 540, 380, 590, 470];

export function walkMeters(a: number, b: number): number {
  if (a === b) return 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  let m = 0;
  for (let i = lo; i < hi; i++) m += WALK_STEPS_M[i - 1];
  return m;
}
export function walkMinutes(a: number, b: number): number {
  return Math.ceil(walkMeters(a, b) / WALK_M_PER_MIN);
}

export const ANCHOR_NAME = 'Indiranagar Metro';
export const WINDOW_OPEN = 450; // 07:30
export const WINDOW_CLOSE = 570; // 09:30

// ---------------------------------------------------------------- helpers

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = ((min % 60) + 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function vehicleById(id: VehicleId): Vehicle {
  return VEHICLES.find((v) => v.id === id)!;
}

/** The metro train that connects to a feeder departure: first 10 minute mark at least 20 min after departure. */
export function trainFor(departure: number): number {
  return Math.ceil((departure + 20) / 10) * 10;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- data model

export interface Journey {
  id: string;
  name: string;
  isExtra: boolean;
  stop: number;
  vehicleId: VehicleId;
  departure: number;
  roadMin: number; // base road time of current stop
  transferBuffer: number;
  metroTrain: number;
  finalWalk: number;
  windowLo: number;
  windowHi: number;
  fare: number;
  status: Status;
  // original assignment, kept for audit
  origStop: number;
  origVehicleId: VehicleId;
  origDeparture: number;
  readyTime: number;
  // engine adjustments
  extraWalk: number;
  holdAdj: number;
  rung: 0 | 1 | 2 | 3 | 4 | 5; // rung that resolved or last rung reached
  partnerArrival?: number;
}

export interface UnassignedDemand {
  id: string;
  name: string;
  stop: number;
  preferredDeparture: number;
}

export interface Scenario {
  metroDelay: number; // 0..20
  trafficTenths: number; // 10..18 (1.0x to 1.8x)
  demandSpikePct: number; // 0..60
  broken: VehicleId[];
}

export const DEFAULT_SCENARIO: Scenario = {
  metroDelay: 0,
  trafficTenths: 10,
  demandSpikePct: 0,
  broken: [],
};

const FIRST_NAMES = [
  'Priya', 'Arjun', 'Meera', 'Rohan', 'Ananya', 'Karthik', 'Divya', 'Vikram', 'Lakshmi', 'Suresh',
  'Neha', 'Aditya', 'Kavya', 'Rahul', 'Sneha', 'Manoj', 'Pooja', 'Naveen', 'Deepa', 'Harish',
  'Ishita', 'Varun', 'Shruti', 'Gautam', 'Nandini', 'Sanjay', 'Revathi', 'Tarun', 'Bhavna', 'Ramesh',
  'Aarti', 'Mohan', 'Sowmya', 'Pranav', 'Jaya', 'Dinesh', 'Tanvi', 'Abhishek', 'Geeta', 'Kiran',
  'Sunita', 'Yash', 'Padma', 'Nikhil', 'Rekha', 'Siddharth', 'Anjali', 'Ganesh', 'Swati', 'Mahesh',
];
const SURNAME_INITIALS = ['S', 'R', 'K', 'N', 'M', 'P', 'D', 'B', 'G', 'V'];

interface RawJourney {
  name: string;
  stop: number;
  vehicleIdx: number;
  depIdx: number;
  finalWalk: number;
  slack: number;
}

interface RawExtra {
  name: string;
  stop: number;
  preferredDeparture: number;
  finalWalk: number;
  slack: number;
}

interface Seed {
  base: RawJourney[];
  extras: RawExtra[];
}

function buildSeed(): Seed {
  const rng = mulberry32(SEED);
  const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const used = new Set<string>();
  const nextName = () => {
    for (;;) {
      const n = `${FIRST_NAMES[ri(0, FIRST_NAMES.length - 1)]} ${SURNAME_INITIALS[ri(0, SURNAME_INITIALS.length - 1)]}.`;
      if (!used.has(n)) {
        used.add(n);
        return n;
      }
    }
  };
  const load = new Map<string, number>();
  const base: RawJourney[] = [];
  for (let i = 0; i < BASE_JOURNEYS; i++) {
    const name = nextName();
    const stop = ri(1, 6);
    const serving = VEHICLES.map((v, idx) => ({ v, idx })).filter(({ v }) => v.stops.includes(stop));
    // shuttles are twice as likely as pods
    const weights = serving.map(({ v }) => (v.type === 'Shuttle' ? 2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    let pick = rng() * total;
    let chosen = serving[0];
    for (let k = 0; k < serving.length; k++) {
      pick -= weights[k];
      if (pick < 0) {
        chosen = serving[k];
        break;
      }
    }
    let depIdx = ri(0, 3);
    for (let tries = 0; tries < 4; tries++) {
      const key = `${chosen.v.id}:${depIdx}`;
      if ((load.get(key) ?? 0) < chosen.v.seats) break;
      depIdx = (depIdx + 1) % 4;
    }
    const key = `${chosen.v.id}:${depIdx}`;
    load.set(key, (load.get(key) ?? 0) + 1);
    base.push({ name, stop, vehicleIdx: chosen.idx, depIdx, finalWalk: ri(3, 6), slack: ri(3, 9) });
  }
  const extras: RawExtra[] = [];
  for (let i = 0; i < MAX_SPIKE_POOL; i++) {
    extras.push({
      name: nextName(),
      stop: ri(1, 6),
      preferredDeparture: 455 + ri(0, 105),
      finalWalk: ri(3, 6),
      slack: ri(3, 9),
    });
  }
  return { base, extras };
}

const SEED_DATA: Seed = buildSeed();

export function legsFor(stop: number, departure: number): { roadMin: number; transferBuffer: number; metroTrain: number } {
  const roadMin = STOPS[stop - 1].roadMin;
  const metroTrain = trainFor(departure);
  return { roadMin, transferBuffer: metroTrain - departure - roadMin + METRO_RIDE_MIN, metroTrain };
}

function makeJourney(
  id: string,
  name: string,
  isExtra: boolean,
  stop: number,
  vehicleId: VehicleId,
  departure: number,
  finalWalk: number,
  slack: number,
): Journey {
  const l = legsFor(stop, departure);
  const baseArrival = departure + l.roadMin + l.transferBuffer + finalWalk;
  const windowHi = baseArrival + slack;
  return {
    id,
    name,
    isExtra,
    stop,
    vehicleId,
    departure,
    roadMin: l.roadMin,
    transferBuffer: l.transferBuffer,
    metroTrain: l.metroTrain,
    finalWalk,
    windowLo: windowHi - WINDOW_BAND,
    windowHi,
    fare: 20 + Math.round(STOPS[stop - 1].distKm * 10),
    status: 'PENDING',
    origStop: stop,
    origVehicleId: vehicleId,
    origDeparture: departure,
    readyTime: departure - READY_EARLY_MIN,
    extraWalk: 0,
    holdAdj: 0,
    rung: 0,
  };
}

export function extraCount(pct: number): number {
  return Math.min(MAX_SPIKE_POOL, Math.round((BASE_JOURNEYS * pct) / 100));
}

export interface Built {
  journeys: Journey[];
  unassigned: UnassignedDemand[];
}

/** Deterministically builds the journey set for a scenario (seeded base plus demand spike). */
export function buildJourneys(scenario: Scenario): Built {
  const journeys: Journey[] = SEED_DATA.base.map((r, i) =>
    makeJourney(
      `J${String(i + 1).padStart(2, '0')}`,
      r.name,
      false,
      r.stop,
      VEHICLES[r.vehicleIdx].id,
      VEHICLES[r.vehicleIdx].departures[r.depIdx],
      r.finalWalk,
      r.slack,
    ),
  );
  const unassigned: UnassignedDemand[] = [];
  const occ = new Map<string, number>();
  for (const j of journeys) {
    const k = `${j.vehicleId}:${j.departure}`;
    occ.set(k, (occ.get(k) ?? 0) + 1);
  }
  const n = extraCount(scenario.demandSpikePct);
  for (let i = 0; i < n; i++) {
    const r = SEED_DATA.extras[i];
    const id = `X${String(i + 1).padStart(2, '0')}`;
    const options: { v: Vehicle; dep: number }[] = [];
    for (const v of VEHICLES) {
      if (!v.stops.includes(r.stop) || scenario.broken.includes(v.id)) continue;
      for (const dep of v.departures) {
        if ((occ.get(`${v.id}:${dep}`) ?? 0) < v.seats) options.push({ v, dep });
      }
    }
    options.sort(
      (a, b) =>
        Math.abs(a.dep - r.preferredDeparture) - Math.abs(b.dep - r.preferredDeparture) ||
        a.dep - b.dep ||
        VEHICLES.indexOf(a.v) - VEHICLES.indexOf(b.v),
    );
    if (options.length === 0) {
      unassigned.push({ id, name: r.name, stop: r.stop, preferredDeparture: r.preferredDeparture });
      continue;
    }
    const o = options[0];
    occ.set(`${o.v.id}:${o.dep}`, (occ.get(`${o.v.id}:${o.dep}`) ?? 0) + 1);
    journeys.push(makeJourney(id, r.name, true, r.stop, o.v.id, o.dep, r.finalWalk, r.slack));
  }
  return { journeys, unassigned };
}

// ---------------------------------------------------------------- arithmetic

/** projectedArrival, exactly as specified. Traffic is held in tenths so the arithmetic is exact. */
export function roadLeg(roadMin: number, trafficTenths: number): number {
  return Math.ceil((roadMin * trafficTenths) / 10);
}

export function projectedArrival(j: Journey, s: Scenario): number {
  return (
    j.departure +
    roadLeg(j.roadMin, s.trafficTenths) +
    j.transferBuffer +
    s.metroDelay +
    j.finalWalk +
    j.extraWalk +
    j.holdAdj
  );
}

// ---------------------------------------------------------------- results

export type StepOutcome = 'applied' | 'refused' | 'unavailable' | 'failed';

export interface LogStep {
  rung: 1 | 2 | 3 | 4 | 5;
  outcome: StepOutcome;
  text: string;
}

export interface LogEntry {
  seq: number;
  time: number;
  journeyId: string;
  name: string;
  stop: number;
  head: string;
  steps: LogStep[];
  finalStatus: Status;
}

export interface Budget {
  total: number;
  spent: number;
  remaining: number;
  partnerRides: number;
  creditsIssued: number;
  creditShortfalls: number;
}

export interface Counts {
  total: number;
  onTime: number;
  recovered: number;
  missed: number;
  byRung: { 1: number; 2: number; 3: number; 4: number };
  rung5Credits: number; // missed journeys that reached rung 5
  rung2Refused: number;
}

export interface Metrics {
  total: number;
  successful: number;
  hitRate: number;
  cost: number;
  costPerSuccess: number;
  missed: number;
  breachHitRate: boolean;
  breachBudget: boolean;
  breached: boolean;
}

export interface EngineResult {
  mode: EngineMode;
  scenario: Scenario;
  journeys: Journey[];
  unassigned: UnassignedDemand[];
  log: LogEntry[];
  budget: Budget;
  counts: Counts;
  metrics: Metrics;
  trainHolds: Record<number, number>;
}

export function computeMetrics(counts: Counts, budget: Budget): Metrics {
  const total = counts.total;
  const successful = counts.onTime + counts.recovered;
  const hitRate = total === 0 ? 0 : (successful / total) * 100;
  const cost = budget.spent;
  const costPerSuccess = successful === 0 ? 0 : cost / successful;
  const breachHitRate = total > 0 && hitRate < HIT_RATE_THRESHOLD;
  const breachBudget = budget.remaining <= 0;
  return {
    total,
    successful,
    hitRate,
    cost,
    costPerSuccess,
    missed: counts.missed,
    breachHitRate,
    breachBudget,
    breached: breachHitRate || breachBudget,
  };
}

function emptyCounts(total: number): Counts {
  return { total, onTime: 0, recovered: 0, missed: 0, byRung: { 1: 0, 2: 0, 3: 0, 4: 0 }, rung5Credits: 0, rung2Refused: 0 };
}

// ---------------------------------------------------------------- engine

const vname = (id: VehicleId) => vehicleById(id).name;
const depLabel = (id: VehicleId, dep: number) => `${vname(id)} ${fmtTime(dep)}`;

function occupancy(journeys: Journey[], skip: Journey): Map<string, number> {
  const occ = new Map<string, number>();
  for (const j of journeys) {
    if (j === skip) continue;
    const k = `${j.vehicleId}:${j.departure}`;
    occ.set(k, (occ.get(k) ?? 0) + 1);
  }
  return occ;
}

interface Candidate {
  stop: number;
  v: Vehicle;
  dep: number;
}

function arrivalFor(j: Journey, c: Candidate, s: Scenario, holds: Record<number, number>, extraWalk: number): number {
  const l = legsFor(c.stop, c.dep);
  return (
    c.dep + roadLeg(l.roadMin, s.trafficTenths) + l.transferBuffer + s.metroDelay + j.finalWalk + extraWalk + (holds[l.metroTrain] ?? 0)
  );
}

interface Rejections {
  broken: number;
  noSeat: number;
  unreachable: number;
  outside: number;
  checked: number;
}

function findCandidate(
  j: Journey,
  all: Journey[],
  s: Scenario,
  holds: Record<number, number>,
  stops: number[],
  walkOf: (stop: number) => number,
): { found: (Candidate & { arrival: number; walk: number }) | null; rej: Rejections } {
  const occ = occupancy(all, j);
  const rej: Rejections = { broken: 0, noSeat: 0, unreachable: 0, outside: 0, checked: 0 };
  for (const stop of stops) {
    const walk = walkOf(stop);
    for (const dep of [...new Set(VEHICLES.flatMap((v) => v.departures))].sort((a, b) => a - b)) {
      for (const v of VEHICLES) {
        if (!v.stops.includes(stop) || !v.departures.includes(dep)) continue;
        if (stop === j.stop && v.id === j.vehicleId && dep === j.departure) continue;
        rej.checked++;
        if (s.broken.includes(v.id)) {
          rej.broken++;
          continue;
        }
        if ((occ.get(`${v.id}:${dep}`) ?? 0) >= v.seats) {
          rej.noSeat++;
          continue;
        }
        if (dep < j.readyTime + walk) {
          rej.unreachable++;
          continue;
        }
        const arrival = arrivalFor(j, { stop, v, dep }, s, holds, walk);
        if (arrival < j.windowLo || arrival > j.windowHi) {
          rej.outside++;
          continue;
        }
        return { found: { stop, v, dep, arrival, walk }, rej };
      }
    }
  }
  return { found: null, rej };
}

function rejText(r: Rejections): string {
  const parts: string[] = [];
  if (r.broken) parts.push(`${r.broken} on broken vehicles`);
  if (r.noSeat) parts.push(`${r.noSeat} with no free seat`);
  if (r.unreachable) parts.push(`${r.unreachable} not reachable in time`);
  if (r.outside) parts.push(`${r.outside} landing outside the window`);
  return parts.length ? parts.join(', ') : 'none serve this pickup';
}

function reassign(j: Journey, stop: number, v: Vehicle, dep: number, holds: Record<number, number>, extraWalk: number) {
  const l = legsFor(stop, dep);
  j.stop = stop;
  j.vehicleId = v.id;
  j.departure = dep;
  j.roadMin = l.roadMin;
  j.transferBuffer = l.transferBuffer;
  j.metroTrain = l.metroTrain;
  j.extraWalk = extraWalk;
  j.holdAdj = holds[l.metroTrain] ?? 0;
}

export function runEngine(scenario: Scenario, mode: EngineMode): EngineResult {
  const built = buildJourneys(scenario);
  const journeys = built.journeys;
  const holds: Record<number, number> = {};
  const budget: Budget = { total: RECOVERY_BUDGET, spent: 0, remaining: RECOVERY_BUDGET, partnerRides: 0, creditsIssued: 0, creditShortfalls: 0 };
  const counts = emptyCounts(journeys.length);
  const log: LogEntry[] = [];
  const processed = new Set<string>();

  const order = [...journeys].sort((a, b) => a.windowHi - b.windowHi || a.id.localeCompare(b.id));
  let seq = 0;

  for (const j of order) {
    if (processed.has(j.id)) continue;
    processed.add(j.id);
    const broken = scenario.broken.includes(j.vehicleId);
    const arrival0 = projectedArrival(j, scenario);

    if (!broken && arrival0 <= j.windowHi) {
      j.status = 'ON_TIME';
      continue;
    }

    const steps: LogStep[] = [];
    const late0 = arrival0 - j.windowHi;
    const head = broken
      ? `${vname(j.vehicleId)} is broken down, journey has no feeder. Window ${fmtTime(j.windowLo)} to ${fmtTime(j.windowHi)}.`
      : `Metro connection at risk, +${late0} min past window close ${fmtTime(j.windowHi)}.`;
    seq++;
    const entry: LogEntry = { seq, time: j.origDeparture, journeyId: j.id, name: j.name, stop: j.origStop, head, steps, finalStatus: 'PENDING' };
    log.push(entry);

    if (mode === 'OFF') {
      j.status = 'MISSED';
      j.rung = 0;
      steps.push({ rung: 5, outcome: 'failed', text: 'Engine OFF: no recovery attempted, journey missed.' });
      entry.finalStatus = 'MISSED';
      continue;
    }

    const recovered = (rung: 1 | 2 | 3 | 4) => {
      j.status = 'RECOVERED';
      j.rung = rung;
      counts.byRung[rung]++;
      entry.finalStatus = 'RECOVERED';
    };

    // ---- Rung 1
    const sameStop = findCandidate(j, journeys, scenario, holds, [j.stop], () => 0);
    if (sameStop.found) {
      const f = sameStop.found;
      reassign(j, f.stop, f.v, f.dep, holds, 0);
      steps.push({
        rung: 1,
        outcome: 'applied',
        text: `Rung 1 applied, re-dispatched to ${depLabel(f.v.id, f.dep)}. Arrival ${fmtTime(f.arrival)}, inside promised window ${fmtTime(j.windowLo)} to ${fmtTime(j.windowHi)}.`,
      });
      recovered(1);
      continue;
    }
    steps.push({
      rung: 1,
      outcome: 'unavailable',
      text: `Rung 1 unavailable, ${sameStop.rej.checked} alternative departures checked (${rejText(sameStop.rej)}).`,
    });

    // ---- Rung 2
    let rung2Done = false;
    if (broken) {
      steps.push({ rung: 2, outcome: 'unavailable', text: 'Rung 2 unavailable, a metro hold cannot help a journey with no feeder.' });
    } else {
      const train = j.metroTrain;
      const used = holds[train] ?? 0;
      const need = late0;
      if (need > MAX_HOLD_MIN - used) {
        steps.push({
          rung: 2,
          outcome: 'unavailable',
          text:
            used > 0
              ? `Rung 2 unavailable, needs ${need} min but the ${fmtTime(train)} train already holds ${used} of ${MAX_HOLD_MIN} min.`
              : `Rung 2 unavailable, needs ${need} min, above the ${MAX_HOLD_MIN} min cap.`,
        });
      } else {
        const others = journeys.filter((k) => k !== j && k.metroTrain === train && !scenario.broken.includes(k.vehicleId));
        const pushed = others.filter((k) => {
          const a = projectedArrival(k, scenario);
          return a <= k.windowHi && a + need > k.windowHi;
        });
        if (pushed.length > 0) {
          counts.rung2Refused++;
          steps.push({
            rung: 2,
            outcome: 'refused',
            text: `Rung 2 refused, ${need} min hold on the ${fmtTime(train)} train would push ${pushed.length} other commuter${pushed.length === 1 ? '' : 's'} past ${pushed.length === 1 ? 'its' : 'their'} own window.`,
          });
        } else {
          for (const k of others) k.holdAdj += need;
          j.holdAdj -= need;
          holds[train] = used + need;
          const arr = projectedArrival(j, scenario);
          steps.push({
            rung: 2,
            outcome: 'applied',
            text: `Rung 2 applied, ${fmtTime(train)} train held ${need} min, ${others.length} other journey${others.length === 1 ? '' : 's'} on it recomputed and still inside their windows. Arrival ${fmtTime(arr)}, inside promised window ${fmtTime(j.windowLo)} to ${fmtTime(j.windowHi)}.`,
          });
          recovered(2);
          rung2Done = true;
        }
      }
    }
    if (rung2Done) continue;

    // ---- Rung 3
    const neighbours = STOPS.filter((st) => st.id !== j.stop && walkMeters(j.stop, st.id) <= ALT_PICKUP_MAX_M)
      .sort((a, b) => walkMeters(j.stop, a.id) - walkMeters(j.stop, b.id) || a.id - b.id)
      .map((st) => st.id);
    const alt = findCandidate(j, journeys, scenario, holds, neighbours, (st) => walkMinutes(j.stop, st));
    if (alt.found) {
      const f = alt.found;
      const from = j.stop;
      reassign(j, f.stop, f.v, f.dep, holds, f.walk);
      steps.push({
        rung: 3,
        outcome: 'applied',
        text: `Rung 3 applied, moved to Stop ${f.stop}, +${f.walk} min walk (${walkMeters(from, f.stop)} m from Stop ${from}), boarding ${depLabel(f.v.id, f.dep)}. Arrival ${fmtTime(f.arrival)}, inside promised window ${fmtTime(j.windowLo)} to ${fmtTime(j.windowHi)}.`,
      });
      recovered(3);
      continue;
    }
    steps.push({
      rung: 3,
      outcome: 'unavailable',
      text: `Rung 3 unavailable, ${neighbours.length} stop${neighbours.length === 1 ? '' : 's'} within ${ALT_PICKUP_MAX_M} m, ${alt.rej.checked} departures checked (${rejText(alt.rej)}).`,
    });

    // ---- Rung 4
    if (budget.remaining >= PARTNER_RIDE_COST) {
      budget.remaining -= PARTNER_RIDE_COST;
      budget.spent += PARTNER_RIDE_COST;
      budget.partnerRides++;
      j.holdAdj = 0;
      j.extraWalk = 0;
      // The partner ride is contracted to land the commuter at window close.
      j.status = 'RECOVERED';
      j.rung = 4;
      counts.byRung[4]++;
      entry.finalStatus = 'RECOVERED';
      steps.push({
        rung: 4,
        outcome: 'applied',
        text: `Rung 4 applied, partner ride dispatched, Rs ${PARTNER_RIDE_COST} deducted, Rs ${budget.remaining.toLocaleString('en-IN')} remaining. Arrival committed at window close ${fmtTime(j.windowHi)}.`,
      });
      j.partnerArrival = j.windowHi;
      continue;
    }
    steps.push({
      rung: 4,
      outcome: 'refused',
      text: `Rung 4 refused, Rs ${budget.remaining} remaining is below the Rs ${PARTNER_RIDE_COST} partner ride cap.`,
    });

    // ---- Rung 5
    const credit = Math.min(FARE_CREDIT, budget.remaining);
    budget.remaining -= credit;
    budget.spent += credit;
    if (credit > 0) budget.creditsIssued++;
    j.status = 'MISSED';
    j.rung = 5;
    counts.rung5Credits++;
    entry.finalStatus = 'MISSED';
    if (credit === FARE_CREDIT) {
      steps.push({ rung: 5, outcome: 'failed', text: `Rung 5, fare credit Rs ${FARE_CREDIT} issued. Journey MISSED, a credit is not a recovery.` });
    } else {
      budget.creditShortfalls++;
      steps.push({
        rung: 5,
        outcome: 'failed',
        text: `Rung 5, shortfall: Rs ${credit} issued of Rs ${FARE_CREDIT} (budget exhausted). Journey MISSED, a credit is not a recovery.`,
      });
    }
  }

  counts.onTime = journeys.filter((j) => j.status === 'ON_TIME').length;
  counts.recovered = journeys.filter((j) => j.status === 'RECOVERED').length;
  counts.missed = journeys.filter((j) => j.status === 'MISSED').length;

  const metrics = computeMetrics(counts, budget);
  return {
    mode,
    scenario,
    journeys,
    unassigned: built.unassigned,
    log: log.reverse(),
    budget,
    counts,
    metrics,
    trainHolds: holds,
  };
}

/** Final projected arrival for display. Partner rides land at window close. */
export function displayArrival(j: Journey, s: Scenario): number | null {
  if (j.partnerArrival !== undefined) return j.partnerArrival;
  if (s.broken.includes(j.vehicleId)) return null;
  return projectedArrival(j, s);
}

export function minutesLate(j: Journey, s: Scenario): number | null {
  const a = displayArrival(j, s);
  if (a === null) return null;
  const late = a - j.windowHi;
  return late > 0 ? late : null;
}

/** Pre-run view: statuses PENDING, arrivals from the formula, nothing recovered. */
export function previewScenario(scenario: Scenario): Built {
  return buildJourneys(scenario);
}
