import { Bus, Car } from 'lucide-react';
import type { Journey, Scenario, VehicleId } from '../engine/GuaranteeEngine';
import { VEHICLES } from '../engine/GuaranteeEngine';

interface Props {
  scenario: Scenario;
  planned: Journey[];
  onToggle: (id: VehicleId) => void;
  disabled: boolean;
}

export function VehicleList({ scenario, planned, onToggle, disabled }: Props) {
  return (
    <section className="panel p-4" aria-label="Fleet status">
      <div className="label mb-1">Fleet status</div>
      <p className="mb-2 text-[11px] text-sub">Click a vehicle to toggle BROKEN DOWN.</p>
      <ul className="divide-y divide-line">
        {VEHICLES.map((v) => {
          const broken = scenario.broken.includes(v.id);
          const n = planned.filter((j) => j.origVehicleId === v.id).length;
          const Icon = v.type === 'Pod' ? Car : Bus;
          return (
            <li key={v.id}>
              <button
                disabled={disabled}
                onClick={() => onToggle(v.id)}
                aria-pressed={broken}
                className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded px-2 py-2 text-left transition-colors disabled:opacity-60 ${broken ? 'bg-failbg' : 'hover:bg-canvas'}`}
              >
                <Icon size={16} className={broken ? 'text-fail' : 'text-pos'} aria-hidden />
                <span className="flex-1">
                  <span className="block text-[12.5px] font-medium">{v.name}</span>
                  <span className="block text-[10.5px] text-sub">
                    {v.seats} seats, {n} journeys
                  </span>
                </span>
                <span className={`flex items-center gap-1 text-[11px] font-medium ${broken ? 'text-fail' : 'text-pos'}`}>
                  <i className={`inline-block h-1.5 w-1.5 rounded-full ${broken ? 'bg-fail' : 'bg-pos'}`} />
                  {broken ? 'Broken down' : 'Operational'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
