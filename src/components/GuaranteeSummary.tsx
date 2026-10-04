import type { EngineResult } from '../engine/GuaranteeEngine';
import { HIT_RATE_THRESHOLD } from '../engine/GuaranteeEngine';
import { pct } from '../engine/format';
import { useCountUp } from '../hooks';

export function GuaranteeSummary({ result }: { result: EngineResult | null }) {
  const m = result?.metrics;
  const rate = useCountUp(m?.hitRate ?? 0);
  const ok = !!m && m.hitRate >= HIT_RATE_THRESHOLD;
  const succ = useCountUp(m?.successful ?? 0, 500);
  const miss = useCountUp(m?.missed ?? 0, 500);
  return (
    <section className="panel p-4" aria-label="Arrival window hit rate">
      <div className="label">Arrival-window hit rate</div>
      {!m || !result ? (
        <p className="py-6 text-[13px] text-sub">Run the simulation to evaluate the corridor.</p>
      ) : (
        <>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div className={`text-[48px] font-bold leading-none tracking-tight ${ok ? 'text-pos' : 'text-fail'}`} style={{ transition: 'color 0.25s' }}>
              {pct(rate)}
            </div>
            <div className="flex gap-4 pb-1 text-right">
              <div>
                <div className="text-[18px] font-semibold text-pos">{Math.round(succ)}</div>
                <div className="text-[10.5px] text-sub">Successful</div>
              </div>
              <div>
                <div className={`text-[18px] font-semibold ${m.missed > 0 ? 'text-fail' : ''}`}>{Math.round(miss)}</div>
                <div className="text-[10.5px] text-sub">Missed</div>
              </div>
            </div>
          </div>
          <div className="relative mt-3 h-1.5 rounded bg-line" aria-hidden>
            <div className={`h-1.5 rounded ${ok ? 'bg-pos' : 'bg-fail'}`} style={{ width: `${m.hitRate}%`, transition: 'width 0.6s ease, background-color 0.25s' }} />
            <div className="absolute -top-1 h-3.5 w-px bg-ink" style={{ left: `${HIT_RATE_THRESHOLD}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-sub">
            <span>
              {m.successful} of {m.total} booked ({result.counts.onTime} on time + {result.counts.recovered} recovered)
            </span>
            <span>Target {HIT_RATE_THRESHOLD}%</span>
          </div>
        </>
      )}
    </section>
  );
}
