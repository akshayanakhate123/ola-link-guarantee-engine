import type { EngineResult } from '../engine/GuaranteeEngine';
import { minutesLate, vehicleById } from '../engine/GuaranteeEngine';

interface Props {
  result: EngineResult | null;
  selectedJourney: string | null;
  onPick: (stop: number, id: string) => void;
}

export function MissedList({ result, selectedJourney, onPick }: Props) {
  if (!result) return null;
  const missed = result.journeys.filter((j) => j.status === 'MISSED');
  return (
    <section className="panel p-4" aria-label="Missed commuters">
      <div className="label mb-2">Missed commuters ({missed.length})</div>
      {missed.length === 0 ? (
        <p className="text-[12px] text-pos">No missed commuters.</p>
      ) : (
        <ul className="max-h-60 divide-y divide-line overflow-auto">
          {missed.map((j) => {
            const late = minutesLate(j, result.scenario);
            return (
              <li key={j.id}>
                <button
                  onClick={() => onPick(j.origStop, j.id)}
                  className={`flex w-full items-baseline justify-between gap-2 px-1 py-1.5 text-left text-[11.5px] transition-colors hover:bg-failbg ${selectedJourney === j.id ? 'bg-failbg' : ''}`}
                >
                  <span className="font-medium text-fail">{j.name}</span>
                  <span className="text-sub">Stop {j.origStop}</span>
                  <span className="text-sub">{late !== null ? `${late} min late` : `no feeder (${vehicleById(j.vehicleId).name})`}</span>
                  <span className="text-sub">{j.rung === 0 ? 'no ladder' : `rung ${j.rung}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
