import type { EngineMode, EngineResult } from '../engine/GuaranteeEngine';
import { HIT_RATE_THRESHOLD } from '../engine/GuaranteeEngine';
import { pct, rs } from '../engine/format';

export function ModeToggle({ mode, onMode }: { mode: EngineMode; onMode: (m: EngineMode) => void }) {
  const base = 'flex-1 px-2 py-1.5 text-[11.5px] font-medium transition-colors';
  return (
    <div className="flex overflow-hidden rounded border border-line bg-white" role="group" aria-label="Engine mode">
      <button aria-pressed={mode === 'ON'} onClick={() => onMode('ON')} className={`${base} ${mode === 'ON' ? 'bg-pos text-white' : 'text-sub hover:text-ink'}`}>
        Engine ON
      </button>
      <button aria-pressed={mode === 'OFF'} onClick={() => onMode('OFF')} className={`${base} ${mode === 'OFF' ? 'bg-ink text-white' : 'text-sub hover:text-ink'}`}>
        Engine OFF (baseline)
      </button>
    </div>
  );
}

interface Props {
  on: EngineResult | null;
  off: EngineResult | null;
  mode: EngineMode;
}

export function BaselineComparison({ on, off, mode }: Props) {
  const rows = [
    { label: 'On-time rate', a: off ? pct(off.metrics.hitRate) : '-', b: on ? pct(on.metrics.hitRate) : '-', badA: !!off && off.metrics.hitRate < HIT_RATE_THRESHOLD, badB: !!on && on.metrics.hitRate < HIT_RATE_THRESHOLD, big: true },
    { label: 'Journeys missed', a: off ? String(off.metrics.missed) : '-', b: on ? String(on.metrics.missed) : '-' },
    { label: 'Recovery cost', a: off ? rs(off.metrics.cost) : '-', b: on ? rs(on.metrics.cost) : '-' },
    { label: 'Cost per successful commute', a: off ? rs(off.metrics.costPerSuccess) : '-', b: on ? rs(on.metrics.costPerSuccess) : '-' },
  ];
  return (
    <section className="panel p-4" aria-label="Baseline comparison">
      <div className="label mb-2">Engine OFF vs ON, same scenario</div>
      <table className="w-full">
        <thead>
          <tr className="text-[11px] text-sub">
            <th className="w-[40%]"></th>
            <th className={`pb-1 text-right font-medium ${mode === 'OFF' ? 'text-ink' : ''}`}>Engine OFF</th>
            <th className={`pb-1 text-right font-medium ${mode === 'ON' ? 'text-ink' : ''}`}>Engine ON</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-line">
              <th scope="row" className="py-1.5 pr-2 text-left text-[11px] font-normal text-sub">{r.label}</th>
              <td className={`py-1.5 text-right ${r.big ? 'text-[17px]' : 'text-[13px]'} font-semibold ${r.badA ? 'text-fail' : ''}`}>{r.a}</td>
              <td className={`py-1.5 text-right ${r.big ? 'text-[17px]' : 'text-[13px]'} font-semibold ${r.badB ? 'text-fail' : r.big && on ? 'text-pos' : ''}`}>{r.b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!on && <p className="mt-2 text-[11px] text-sub">Both passes compute from the same inputs when you run.</p>}
    </section>
  );
}
