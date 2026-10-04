import { useMemo, useState } from 'react';
import type { Journey, Scenario, UnassignedDemand } from '../engine/GuaranteeEngine';
import { displayArrival, fmtTime, vehicleById } from '../engine/GuaranteeEngine';
import { statusLabel } from '../engine/format';

interface Props {
  journeys: Journey[];
  unassigned: UnassignedDemand[];
  scenario: Scenario;
  selectedJourney: string | null;
  onSelect: (id: string | null, stop: number | null) => void;
}

type SortMode = 'attention' | 'window' | 'departure';
const RANK = { MISSED: 0, PENDING: 1, RECOVERED: 2, ON_TIME: 3 } as const;
const VISIBLE = 6;

const pill: Record<string, string> = {
  PENDING: 'text-sub bg-canvas border border-line',
  ON_TIME: 'text-pos',
  RECOVERED: 'text-pos bg-posbg',
  MISSED: 'text-fail bg-failbg',
};

export function JourneyTable({ journeys, unassigned, scenario, selectedJourney, onSelect }: Props) {
  const [mode, setMode] = useState<SortMode>('attention');
  const [all, setAll] = useState(false);

  const rows = useMemo(() => {
    const s = [...journeys];
    if (mode === 'attention') s.sort((a, b) => RANK[a.status] - RANK[b.status] || a.windowHi - b.windowHi || a.id.localeCompare(b.id));
    else if (mode === 'window') s.sort((a, b) => a.windowHi - b.windowHi || a.id.localeCompare(b.id));
    else s.sort((a, b) => a.departure - b.departure || a.id.localeCompare(b.id));
    return s;
  }, [journeys, mode]);

  const total = rows.length + unassigned.length;
  const shownJ = all ? rows : rows.slice(0, VISIBLE);
  const shownU = all ? unassigned : unassigned.slice(0, Math.max(0, VISIBLE - shownJ.length));

  return (
    <section className="panel" aria-label="Journeys">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div className="label" title="The engine processes journeys in ascending order of promised arrival window close, ties broken by journey id.">
          Journeys ({journeys.length} booked)
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-sub">
          Sort
          <select value={mode} onChange={(e) => setMode(e.target.value as SortMode)} className="rounded border border-line bg-white px-1.5 py-1 text-[11px] text-ink">
            <option value="attention">Needs attention first</option>
            <option value="window">Processing order (promised arrival)</option>
            <option value="departure">Departure time</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[640px] text-[11.5px]">
          <thead>
            <tr className="border-b border-line text-left text-sub">
              {['Commuter', 'Pickup', 'Vehicle', 'Departure', 'Promised window', 'Projected arrival', 'Status'].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownJ.map((j, i) => {
              const arr = displayArrival(j, scenario);
              const sel = j.id === selectedJourney;
              return (
                <tr
                  key={j.id}
                  style={{ animation: `fade-up 0.3s ease-out ${Math.min(i, 10) * 35}ms both` }}
                  tabIndex={0}
                  onClick={() => onSelect(sel ? null : j.id, sel ? null : j.origStop)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(sel ? null : j.id, sel ? null : j.origStop)}
                  aria-selected={sel}
                  className={`cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-canvas ${sel ? 'bg-posbg' : ''}`}
                >
                  <td className={`whitespace-nowrap px-4 py-2 font-medium ${j.status === 'MISSED' ? 'text-fail' : ''}`}>{j.name}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    Stop {j.stop}
                    {j.stop !== j.origStop && <span className="text-sub"> (was {j.origStop})</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {vehicleById(j.vehicleId).name}
                    {j.vehicleId !== j.origVehicleId && <span className="text-sub"> (was {vehicleById(j.origVehicleId).name})</span>}
                  </td>
                  <td className="px-4 py-2">{fmtTime(j.departure)}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {fmtTime(j.windowLo)} to {fmtTime(j.windowHi)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">{arr === null ? <span title="Assigned vehicle is broken down">no feeder</span> : fmtTime(arr)}</td>
                  <td className="px-4 py-2">
                    <span key={j.status} className={`pop inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${pill[j.status]}`}>{statusLabel[j.status]}</span>
                  </td>
                </tr>
              );
            })}
            {shownU.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-fail">{u.name}</td>
                <td className="px-4 py-2">Stop {u.stop}</td>
                <td className="px-4 py-2 text-sub" colSpan={4}>
                  No seat on any operational departure (wanted {fmtTime(u.preferredDeparture)})
                </td>
                <td className="px-4 py-2">
                  <span className="inline-block whitespace-nowrap rounded bg-failbg px-1.5 py-0.5 text-[10px] font-semibold text-fail">MISSED (unassigned)</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > VISIBLE && (
        <button onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-4 py-2.5 text-left text-[12px] font-medium text-pos hover:bg-canvas">
          {all ? 'Show fewer journeys' : `View all journeys (${total})`}
        </button>
      )}
    </section>
  );
}
