import { useEffect, useMemo, useRef, useState } from 'react';
import { ANCHOR_NAME, BASE_JOURNEYS, DEFAULT_SCENARIO, RECOVERY_BUDGET, TOTAL_SEAT_SLOTS, VEHICLES, WINDOW_CLOSE, WINDOW_OPEN, buildJourneys, fmtTime, runEngine } from './engine/GuaranteeEngine';
import type { EngineMode, EngineResult, Scenario, VehicleId } from './engine/GuaranteeEngine';
import { DEFAULT_SCALE } from './engine/scaleModel';
import type { ScaleInputs } from './engine/scaleModel';
import { rs } from './engine/format';
import { ScenarioControls } from './components/ScenarioControls';
import { VehicleList } from './components/VehicleList';
import { CorridorMap } from './components/CorridorMap';
import { JourneyTable } from './components/JourneyTable';
import { EventTimeline } from './components/EventTimeline';
import { BaselineComparison, ModeToggle } from './components/BaselineComparison';
import { FailureBanner } from './components/FailureBanner';
import { GuaranteeSummary } from './components/GuaranteeSummary';
import { RecoveryLadder } from './components/RecoveryLadder';
import { RecoveryBudget } from './components/RecoveryBudget';
import { MissedList } from './components/MissedList';
import { ScaleModel } from './components/ScaleModel';

interface Run {
  on: EngineResult;
  off: EngineResult;
}

const fresh = (): Scenario => ({ ...DEFAULT_SCENARIO, broken: [] });

export default function App() {
  const [tab, setTab] = useState<'corridor' | 'scale'>('corridor');
  const [scenario, setScenario] = useState<Scenario>(fresh);
  const [scale, setScale] = useState<ScaleInputs>(DEFAULT_SCALE);
  const [run, setRun] = useState<Run | null>(null);
  const [runId, setRunId] = useState(0);
  const [mode, setMode] = useState<EngineMode>('ON');
  const [running, setRunning] = useState(false);
  const [selStop, setSelStop] = useState<number | null>(null);
  const [selJourney, setSelJourney] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const planned = useMemo(() => buildJourneys(scenario), [scenario]);
  const result = run ? (mode === 'ON' ? run.on : run.off) : null;
  const stale = !!run && JSON.stringify(run.on.scenario) !== JSON.stringify(scenario);

  const journeys = result ? result.journeys : planned.journeys;
  const unassigned = result ? result.unassigned : planned.unassigned;
  const arrivalScenario = result ? result.scenario : scenario;

  const onRun = () => {
    setRunning(true);
    setSelJourney(null);
    const snap: Scenario = { ...scenario, broken: [...scenario.broken] };
    timer.current = window.setTimeout(() => {
      setRun({ on: runEngine(snap, 'ON'), off: runEngine(snap, 'OFF') });
      setRunId((n) => n + 1);
      setRunning(false);
    }, 450);
  };

  const onReset = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setScenario(fresh());
    setRun(null);
    setRunId(0);
    setMode('ON');
    setRunning(false);
    setSelStop(null);
    setSelJourney(null);
  };

  const toggleVehicle = (id: VehicleId) =>
    setScenario((s) => ({ ...s, broken: s.broken.includes(id) ? s.broken.filter((b) => b !== id) : [...s.broken, id] }));

  const pickJourney = (id: string | null, stop: number | null) => {
    setSelJourney(id);
    setSelStop(stop);
  };

  const facts: [string, string][] = [
    ['Corridor', ANCHOR_NAME],
    ['Window', `${fmtTime(WINDOW_OPEN)} to ${fmtTime(WINDOW_CLOSE)}`],
    ['Fleet', `${VEHICLES.length} vehicles, ${TOTAL_SEAT_SLOTS} seat-slots`],
    ['Booked journeys', String(journeys.length) + (journeys.length !== BASE_JOURNEYS ? ` (${BASE_JOURNEYS} seeded)` : '')],
    ['Recovery budget', rs(RECOVERY_BUDGET)],
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-1 px-4 sm:px-6">
          <div className="flex items-baseline gap-2 py-3">
            <span className="text-[14px] font-bold tracking-[0.14em]">OLA LINK</span>
            <span className="text-[14px] font-medium text-sub">|</span>
            <span className="text-[14px] font-medium">Guarantee Engine</span>
          </div>
          <nav className="flex gap-5" aria-label="Views">
            {(
              [
                ['corridor', 'Corridor Simulator'],
                ['scale', 'Scale Model'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                aria-current={tab === k ? 'page' : undefined}
                className={`-mb-px border-b-2 py-3 text-[13px] font-medium transition-colors ${tab === k ? 'border-pos text-ink' : 'border-transparent text-sub hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-[11px] text-sub">
            <span className="label">Simulation environment</span>
            <span className="hidden sm:inline">All values are simulated.</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">
        {tab === 'scale' ? (
          <div key="scale" className="fade-up">
            <ScaleModel inp={scale} onChange={setScale} />
          </div>
        ) : (
          <div key="corridor" className="fade-up">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Can this corridor keep its promise?</h1>
                <p className="mt-1.5 max-w-xl text-[14px] text-sub">Stress-test a peak-hour feeder network and watch the recovery engine protect, or fail to protect, arrival windows.</p>
              </div>
              <dl className="flex flex-wrap gap-x-6 gap-y-1">
                {facts.map(([k, v]) => (
                  <div key={k}>
                    <dt className="label">{k}</dt>
                    <dd className="text-[12.5px] font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
              <div className="col space-y-4 lg:col-start-1 lg:row-span-2 lg:row-start-1">
                <ScenarioControls scenario={scenario} onChange={setScenario} onRun={onRun} onReset={onReset} running={running} unassigned={unassigned} />
                <VehicleList scenario={scenario} planned={planned.journeys} onToggle={toggleVehicle} disabled={running} />
              </div>

              <div className="lg:col-start-2 lg:row-start-1">
                <CorridorMap
                  journeys={journeys}
                  scenario={scenario}
                  result={result}
                  runId={runId}
                  selectedJourney={selJourney}
                  selectedStop={selStop}
                  onSelectStop={setSelStop}
                  onToggleVehicle={toggleVehicle}
                  disabled={running}
                />
              </div>

              <div className="col space-y-4 lg:col-start-3 lg:row-span-2 lg:row-start-1">
                <ModeToggle mode={mode} onMode={setMode} />
                {stale && (
                  <div className="rounded border border-warn/30 bg-white px-3 py-2 text-[11.5px] text-warn" role="status">
                    Controls changed since the last run. Results shown are for the previous inputs. Run again to refresh.
                  </div>
                )}
                <FailureBanner result={result} />
                <GuaranteeSummary result={result} />
                <BaselineComparison on={run?.on ?? null} off={run?.off ?? null} mode={mode} />
                <RecoveryLadder result={result} />
                <RecoveryBudget result={result} />
                <MissedList result={result} selectedJourney={selJourney} onPick={(stop, id) => pickJourney(id, stop)} />
              </div>

              <div className="col space-y-4 lg:col-start-2 lg:row-start-2">
                <JourneyTable journeys={journeys} unassigned={unassigned} scenario={arrivalScenario} selectedJourney={selJourney} onSelect={pickJourney} />
                <EventTimeline result={result} selectedJourney={selJourney} onSelect={(id, stop) => pickJourney(id, stop)} />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-[1440px] border-t border-line px-4 py-4 text-[11px] text-sub sm:px-6">
        Ola Link product strategy prototype. Illustrative operating assumptions, not forecasts.
      </footer>
    </div>
  );
}
