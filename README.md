# Ola Link | Guarantee Engine

An internal mobility operations simulator for an Ola Electric APM product assignment (India, 2035). It is a stress-testing tool, not a consumer app.

**Thesis:** Ola Link connects neighbourhoods to metro stations with coordinated electric feeder vehicles and commits to a promised arrival window. This tool lets you stress-test that promise until it breaks.

Everything runs client-side. There is no backend, database, auth, map API or network call. All values are simulated.

## What is in it

### Corridor Simulator
- **Scenario controls:** metro delay (0 to 20 min), traffic multiplier (1.0x to 1.8x), demand spike (0 to 60%), three presets, and a click-to-break-down fleet.
- **Corridor map:** a static SVG schematic of Indiranagar Metro, six pickup stops, four vehicles and the metro trunk. Vehicles drive their routes when the engine runs, then each recovered or missed commuter is replayed with an action label.
- **Guarantee outcome:** hit rate, failure banner, Engine OFF vs ON comparison, recovery ladder, budget, net cost per successful commute, and missed commuters.
- **Journey table and event timeline:** both generated from the engine's real decisions.

### Scale Model
Editable planning assumptions feeding a transparent fleet calculation, comparing "If Link carried every leg" with "With transit carrying the trunk", plus an animated fleet reduction chart.

## The recovery engine

The engine is a pure TypeScript module (`src/engine/GuaranteeEngine.ts`) with no rendering logic and no randomness beyond a fixed-seed generator, so identical inputs always give identical outputs.

```
projectedArrival = feederDeparture
                 + roadTime * trafficMultiplier
                 + transferBuffer
                 + metroDelay
                 + finalWalk
```

Journeys are processed in ascending order of promised arrival window close. A journey past its window climbs this ladder and stops at the first rung that lands it inside the window:

| Rung | Action | Cost |
|---|---|---|
| 1 | Re-dispatch to another operational vehicle with a free seat | Rs 0 |
| 2 | Hold the connecting metro (max 4 min). Refused if it would push any other commuter past their window | Rs 0 |
| 3 | Alternate pickup within 600 m, adding the walk time | Rs 0 |
| 4 | Capped partner ride, if budget allows | Rs 180 |
| 5 | Fare credit. The journey is still MISSED | Rs 40 |

Definitions used everywhere:

```
successfulJourneys          = ON_TIME + RECOVERED
hitRate                     = successfulJourneys / totalBookedJourneys * 100
netCostPerSuccessfulCommute = totalRecoveryCost / successfulJourneys
```

The corridor breaches its guarantee when the hit rate is below 95% or the Rs 2,400 recovery budget is fully spent.

### Modelling choices
- A Rung 2 hold rescues the late commuter and delays every other journey on that metro train by the hold. It is refused if any of them would then miss their own window. Holds on one train are capped at 4 minutes in total.
- A Rung 4 partner ride is committed to arrive at the window close, so it always counts as recovered.
- Demand-spike journeys with no free seat are shown as unassigned demand. They are not booked and are excluded from the hit rate.
- Metro trains leave on a 10-minute grid. Each vehicle serves a fixed set of stops.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS v4, Lucide icons, Inter (bundled via Fontsource). No animation library: transitions are CSS and `requestAnimationFrame`, and all motion respects `prefers-reduced-motion`.

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build    # type-check and production build into dist
npm run check    # run the engine on several scenarios and print results
```

`npm run check` is a quick way to verify the sanity requirements: defaults give 100% on time with zero spend, and maximum disruption (metro delay 20, traffic 1.8x, both shuttles down) breaches the guarantee.

## Project structure

```
src/
  engine/
    GuaranteeEngine.ts   pure simulation engine and seeded data
    scaleModel.ts        pure scale model arithmetic
    format.ts            display formatting
  components/            ScenarioControls, VehicleList, CorridorMap, JourneyTable,
                         EventTimeline, GuaranteeSummary, BaselineComparison,
                         RecoveryLadder, RecoveryBudget, MissedList, FailureBanner,
                         ScaleModel
  hooks.ts               count-up and reduced-motion helpers
scripts/check.ts         engine verification script
```

## Deploying

The app is a static Vite build, so it deploys to Vercel with zero configuration: import the repository, keep the Vite preset (build `npm run build`, output `dist`), and deploy.

---

Ola Link product strategy prototype. Illustrative operating assumptions, not forecasts.
