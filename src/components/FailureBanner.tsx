import { AlertTriangle } from 'lucide-react';
import type { EngineResult } from '../engine/GuaranteeEngine';
import { HIT_RATE_THRESHOLD, RECOVERY_BUDGET } from '../engine/GuaranteeEngine';
import { pct, rs } from '../engine/format';

/** Persistent once breached. Remounts (and so animates once) each time the breach state is entered. */
export function FailureBanner({ result }: { result: EngineResult | null }) {
  if (!result) return null;
  const m = result.metrics;
  if (!m.breached) {
    return (
      <div key="ok" className="fade-up flex items-center gap-2 text-[12px] font-medium text-pos" role="status">
        <i className="inline-block h-1.5 w-1.5 rounded-full bg-pos" />
        Corridor operating within its service guarantee.
      </div>
    );
  }
  return (
    <div key="breach" className="banner-in rounded-md border border-fail/40 bg-failbg p-3.5" role="alert">
      <div className="flex gap-2.5">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-fail" aria-hidden />
        <div>
          <div className="text-[14px] font-semibold leading-snug text-fail">This corridor breaches its service guarantee.</div>
          <div className="mt-0.5 text-[12.5px] text-ink">Under the Ola Link release policy it would be paused, not scaled.</div>
          <ul className="mt-2 space-y-0.5 text-[11.5px] text-sub">
            {m.breachHitRate && <li>Breached: hit rate {pct(m.hitRate)} is below {HIT_RATE_THRESHOLD}%.</li>}
            {m.breachBudget && <li>Breached: recovery budget fully spent.</li>}
            <li>
              Actual hit rate {pct(m.hitRate)}, remaining budget {rs(result.budget.remaining)} of {rs(RECOVERY_BUDGET)}.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
