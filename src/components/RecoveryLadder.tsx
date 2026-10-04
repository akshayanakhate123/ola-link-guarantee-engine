import type { EngineResult } from '../engine/GuaranteeEngine';
import { FARE_CREDIT, PARTNER_RIDE_COST } from '../engine/GuaranteeEngine';
import { pct, rs } from '../engine/format';

export function RecoveryLadder({ result }: { result: EngineResult | null }) {
  const c = result?.counts;
  const b = result?.budget;
  const total = c?.total ?? 0;
  const creditCost = b ? b.spent - b.partnerRides * PARTNER_RIDE_COST : 0;
  const rows = [
    { n: 1, name: 'Re-dispatch', count: c?.byRung[1] ?? 0, cost: 'Rs 0', bad: false },
    { n: 2, name: 'Connection hold', count: c?.byRung[2] ?? 0, cost: 'Rs 0', bad: false },
    { n: 3, name: 'Alternate pickup', count: c?.byRung[3] ?? 0, cost: 'Rs 0', bad: false },
    { n: 4, name: 'Partner ride', count: c?.byRung[4] ?? 0, cost: `${rs((c?.byRung[4] ?? 0) * PARTNER_RIDE_COST)} (Rs ${PARTNER_RIDE_COST} each)`, bad: false },
    { n: 5, name: 'Fare credit', count: c?.rung5Credits ?? 0, cost: `${rs(creditCost)} (Rs ${FARE_CREDIT} each)`, bad: true },
  ];
  const noLadder = c && result.mode === 'OFF' ? c.missed : 0;
  return (
    <section className="panel p-4" aria-label="Recovery ladder">
      <div className="label mb-3">Recovery ladder</div>
      {!c && <p className="text-[12px] text-sub">No actions yet.</p>}
      {c && (
        <ol className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.n}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span>
                  <span className="mr-1.5 text-sub">{r.n}</span>
                  {r.name}
                  {r.bad && <span className="ml-1 text-[10.5px] text-fail">(counted as missed)</span>}
                </span>
                <span className="font-semibold">
                  {r.count} <span className="font-normal text-sub">({total ? pct((r.count / total) * 100) : '0.0%'})</span>
                </span>
              </div>
              <div className="mt-1 h-1 rounded bg-line">
                <div className={`h-1 rounded ${r.bad ? 'bg-fail' : 'bg-pos'}`} style={{ width: `${total ? (r.count / total) * 100 : 0}%`, transition: 'width 0.5s ease' }} />
              </div>
              <div className="mt-0.5 text-[10.5px] text-sub">{r.cost}</div>
            </li>
          ))}
        </ol>
      )}
      {c && (
        <div className="mt-3 space-y-0.5 border-t border-line pt-2 text-[11px] text-sub">
          <div className="flex justify-between">
            <span>On time, no action</span>
            <span className="font-medium text-ink">{c.onTime}</span>
          </div>
          <div className="flex justify-between" title="Holds rejected because they would have pushed other commuters past their windows">
            <span>Rung 2 refused (protected other commuters)</span>
            <span className="font-medium text-warn">{c.rung2Refused}</span>
          </div>
          {noLadder > 0 && (
            <div className="flex justify-between">
              <span>Missed with no ladder (engine OFF)</span>
              <span className="font-medium text-fail">{noLadder}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
