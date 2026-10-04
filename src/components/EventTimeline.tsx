import { useState } from 'react';
import type { EngineResult, StepOutcome } from '../engine/GuaranteeEngine';
import { fmtTime } from '../engine/GuaranteeEngine';

const tone: Record<StepOutcome, string> = { applied: 'text-pos', refused: 'text-warn', unavailable: 'text-sub', failed: 'text-fail' };
const tag: Record<StepOutcome, string> = { applied: 'Applied', refused: 'Refused', unavailable: 'N/A', failed: 'Failed' };
const VISIBLE = 5;

interface Props {
  result: EngineResult | null;
  selectedJourney: string | null;
  onSelect: (id: string, stop: number) => void;
}

export function EventTimeline({ result, selectedJourney, onSelect }: Props) {
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const log = result?.log ?? [];
  const shown = all ? log : log.slice(0, VISIBLE);
  const toggle = (seq: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(seq)) n.delete(seq);
      else n.add(seq);
      return n;
    });
  return (
    <section className="panel p-4" aria-label="Engine event timeline">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="label">Engine event timeline</div>
        <span className="text-[11px] text-sub" title="Generated from the decisions the engine actually took">
          Latest first
        </span>
      </div>
      {!result && <p className="text-[12px] text-sub">No events yet. Run the engine.</p>}
      {result && log.length === 0 && <p className="text-[12px] text-pos">No disruptions. All {result.counts.total} journeys projected inside their windows, zero recovery actions, Rs 0 spent.</p>}
      <ol className="relative">
        {shown.map((e) => {
          const missed = e.finalStatus === 'MISSED';
          const applied = e.steps.find((s) => s.outcome === 'applied');
          const last = e.steps[e.steps.length - 1];
          const summary = (applied ?? last).text.split('. ')[0];
          const isOpen = open.has(e.seq);
          return (
            <li key={e.seq} className="fade-up relative border-l border-line pb-3 pl-4 last:pb-0">
              <i className={`absolute -left-[4px] top-1.5 h-2 w-2 rounded-full ${missed ? 'bg-fail' : 'bg-pos'}`} />
              <button
                onClick={() => {
                  toggle(e.seq);
                  onSelect(e.journeyId, e.stop);
                }}
                aria-expanded={isOpen}
                className={`-ml-1 w-full rounded px-1 py-0.5 text-left transition-colors hover:bg-canvas ${selectedJourney === e.journeyId ? 'bg-canvas' : ''}`}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                  <span className="text-sub">{fmtTime(e.time)}</span>
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-sub">Stop {e.stop}</span>
                  <span className={`ml-auto text-[10.5px] font-semibold ${missed ? 'text-fail' : 'text-pos'}`}>{missed ? 'MISSED' : 'RECOVERED'}</span>
                </div>
                <div className="text-[11.5px] text-sub">{summary}</div>
              </button>
              {isOpen && (
                <div className="fade-up ml-0 mt-1 space-y-1 rounded bg-canvas p-2">
                  <p className="text-[11px] text-sub">{e.head}</p>
                  {e.steps.map((s, i) => (
                    <p key={i} className={`text-[11px] ${tone[s.outcome]}`}>
                      <b className="mr-1 font-semibold">{tag[s.outcome]}</b>
                      {s.text}
                    </p>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {log.length > VISIBLE && (
        <button onClick={() => setAll((v) => !v)} className="mt-3 text-[12px] font-medium text-pos hover:underline">
          {all ? 'Show latest 5' : `Show full history (${log.length} events)`}
        </button>
      )}
    </section>
  );
}
