import type { EngineResult } from '../engine/GuaranteeEngine';
import { PARTNER_RIDE_COST, RECOVERY_BUDGET } from '../engine/GuaranteeEngine';
import { rs } from '../engine/format';
import { useCountUp } from '../hooks';

export function RecoveryBudget({ result }: { result: EngineResult | null }) {
  const b = result?.budget;
  const m = result?.metrics;
  const spent = useCountUp(b?.spent ?? 0);
  const remaining = b?.remaining ?? RECOVERY_BUDGET;
  const exhausted = remaining <= 0;
  const low = remaining < RECOVERY_BUDGET * 0.2;
  const maxRides = Math.floor(RECOVERY_BUDGET / PARTNER_RIDE_COST);
  return (
    <section className="panel p-4" aria-label="Recovery budget">
      <div className="label mb-2">Recovery budget: {rs(RECOVERY_BUDGET)}</div>
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-[24px] font-bold">{rs(spent)}</span> <span className="text-[11px] text-sub">spent</span>
        </div>
        <div className="text-right">
          <span className={`text-[15px] font-semibold ${low ? 'text-fail' : ''}`}>{rs(remaining)}</span> <span className="text-[11px] text-sub">remaining</span>
        </div>
      </div>
      <div className="mt-2 h-2 rounded bg-line" aria-label="Budget remaining">
        <div className={`h-2 rounded ${low ? 'bg-fail' : 'bg-pos'}`} style={{ width: `${(remaining / RECOVERY_BUDGET) * 100}%`, transition: 'width 0.6s ease, background-color 0.25s' }} />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-sub">
        <span>
          Partner rides dispatched{' '}
          <b className="font-semibold text-ink">
            {b?.partnerRides ?? 0} / {maxRides}
          </b>
        </span>
        <span>
          Fare credits issued <b className="font-semibold text-ink">{b?.creditsIssued ?? 0}</b>
          {b && b.creditShortfalls > 0 ? ` (${b.creditShortfalls} short)` : ''}
        </span>
      </div>
      {exhausted && (
        <div className="fade-up mt-2 rounded bg-failbg px-2 py-1 text-[11.5px] font-medium text-fail" role="status">
          Budget exhausted. No further partner rides or full credits possible.
        </div>
      )}
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-2">
        <span className="text-[11px] text-sub">Net cost per successful commute</span>
        <span className="text-[18px] font-bold">{m ? rs(m.costPerSuccess) : '-'}</span>
      </div>
      {m && (
        <div className="text-right text-[10.5px] text-sub">
          {rs(m.cost)} / {m.successful} successful
        </div>
      )}
    </section>
  );
}
