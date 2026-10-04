import { Play, RotateCcw } from 'lucide-react';
import type { Scenario, UnassignedDemand } from '../engine/GuaranteeEngine';
import { extraCount, fmtTime } from '../engine/GuaranteeEngine';

interface Props {
  scenario: Scenario;
  onChange: (s: Scenario) => void;
  onRun: () => void;
  onReset: () => void;
  running: boolean;
  unassigned: UnassignedDemand[];
}

const PRESETS: { label: string; s: Scenario }[] = [
  { label: 'Normal operations', s: { metroDelay: 0, trafficTenths: 10, demandSpikePct: 0, broken: [] } },
  { label: 'Moderate disruption', s: { metroDelay: 5, trafficTenths: 10, demandSpikePct: 0, broken: [] } },
  { label: 'Severe disruption', s: { metroDelay: 20, trafficTenths: 18, demandSpikePct: 0, broken: ['shA', 'shB'] } },
];

const same = (a: Scenario, b: Scenario) => JSON.stringify(a) === JSON.stringify(b);

function Slider(props: { label: string; value: string; min: number; max: number; step: number; v: number; onChange: (n: number) => void; ends: [string, string]; disabled: boolean }) {
  const p = ((props.v - props.min) / (props.max - props.min)) * 100;
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-baseline justify-between">
        <label className="text-[12px] font-medium" htmlFor={props.label}>
          {props.label}
        </label>
        <span className="text-[14px] font-semibold">{props.value}</span>
      </div>
      <input id={props.label} className="range" style={{ ['--p' as string]: `${p}%` }} type="range" min={props.min} max={props.max} step={props.step} value={props.v} disabled={props.disabled} onChange={(e) => props.onChange(Number(e.target.value))} />
      <div className="mt-1 flex justify-between text-[10px] text-sub">
        <span>{props.ends[0]}</span>
        <span>{props.ends[1]}</span>
      </div>
    </div>
  );
}

export function ScenarioControls({ scenario, onChange, onRun, onReset, running, unassigned }: Props) {
  const set = (p: Partial<Scenario>) => onChange({ ...scenario, ...p });
  return (
    <section className="panel p-4" aria-label="Scenario controls">
      <div className="label mb-3">Scenario controls</div>
      <div className="mb-4 flex flex-col gap-1" role="group" aria-label="Presets">
        {PRESETS.map((p) => {
          const active = same(p.s, scenario);
          return (
            <button
              key={p.label}
              disabled={running}
              aria-pressed={active}
              onClick={() => onChange({ ...p.s, broken: [...p.s.broken] })}
              className={`rounded border px-2.5 py-1.5 text-left text-[12px] transition-colors disabled:opacity-50 ${active ? 'border-pos bg-posbg font-semibold text-pos' : 'border-line hover:border-sub'}`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <Slider label="Metro delay" value={`${scenario.metroDelay} min`} min={0} max={20} step={1} v={scenario.metroDelay} onChange={(n) => set({ metroDelay: n })} ends={['0', '20']} disabled={running} />
      <Slider label="Traffic multiplier" value={`${(scenario.trafficTenths / 10).toFixed(1)}x`} min={10} max={18} step={1} v={scenario.trafficTenths} onChange={(n) => set({ trafficTenths: n })} ends={['1.0x', '1.8x']} disabled={running} />
      <Slider label="Demand spike" value={`+${scenario.demandSpikePct}%`} min={0} max={60} step={5} v={scenario.demandSpikePct} onChange={(n) => set({ demandSpikePct: n })} ends={['0%', '60%']} disabled={running} />
      <div className="-mt-2 mb-4 text-[11px] text-sub">{extraCount(scenario.demandSpikePct)} extra journeys requested</div>
      {unassigned.length > 0 && (
        <div className="mb-4 rounded border border-fail/30 bg-failbg p-2 text-[11px]" role="status">
          <div className="font-semibold text-fail">Unassigned demand: {unassigned.length}</div>
          <div className="text-sub">No seat on any operational departure. Not booked, excluded from hit rate.</div>
          <ul className="mt-1">
            {unassigned.map((u) => (
              <li key={u.id}>
                {u.name}, Stop {u.stop}, wanted {fmtTime(u.preferredDeparture)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={onRun} disabled={running} className="relative flex w-full items-center justify-center gap-1.5 overflow-hidden rounded bg-pos px-3 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-80">
        {running && <span className="sweep absolute inset-y-0 left-0 w-full bg-white/20" aria-hidden />}
        <Play size={14} aria-hidden />
        {running ? 'Processing...' : 'Run Guarantee Engine'}
      </button>
      <button onClick={onReset} disabled={running} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded border border-line px-3 py-2 text-[12px] hover:border-sub disabled:opacity-50">
        <RotateCcw size={13} aria-hidden />
        Reset Corridor
      </button>
    </section>
  );
}
