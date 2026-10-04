import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import type { EngineResult, Journey, Scenario, VehicleId } from '../engine/GuaranteeEngine';
import { ANCHOR_NAME, STOPS, VEHICLES, fmtTime, roadLeg, vehicleById } from '../engine/GuaranteeEngine';
import { prefersReducedMotion } from '../hooks';

interface Props {
  journeys: Journey[];
  scenario: Scenario; // live controls
  result: EngineResult | null;
  runId: number;
  selectedJourney: string | null;
  selectedStop: number | null;
  onSelectStop: (s: number | null) => void;
  onToggleVehicle: (v: VehicleId) => void;
  disabled: boolean;
}

type Pt = [number, number];
const A: Pt = [470, 170];
const TEAL = '#0B7357';
const RUST = '#B4441C';
const GREY = '#737A76';
const IDLE: Record<VehicleId, number> = { podA: 0.02, shA: 0.12, podB: 0.02, shB: 0.12 };
const SHORT: Record<VehicleId, string> = { podA: 'PA', shA: 'SA', podB: 'PB', shB: 'SB' };
const GROUP: Record<VehicleId, number> = { podA: 0, shA: 0, podB: 1, shB: 1 };
const RUN_MS = 1500;
const STEP_MS = 700;

function ctrl(p: Pt): Pt {
  return [(p[0] + A[0]) / 2, (p[1] + A[1]) / 2 + (p[1] > A[1] ? 20 : -20)];
}

function smooth(pts: Pt[]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

const stopPt = (id: number): Pt => [STOPS[id - 1].x, STOPS[id - 1].y];
const fan = (id: number) => {
  const p = stopPt(id);
  const c = ctrl(p);
  return `M ${p[0]} ${p[1]} Q ${c[0]} ${c[1]} ${A[0]} ${A[1]}`;
};
const RING = smooth(STOPS.map((s) => [s.x, s.y] as Pt));
const vehiclePath = (id: VehicleId) => {
  const stops = vehicleById(id).stops;
  const last = stopPt(stops[stops.length - 1]);
  const c = ctrl(last);
  return `${smooth(stops.map(stopPt))} Q ${c[0]} ${c[1]} ${A[0]} ${A[1]}`;
};

interface Focus {
  from: number;
  to: number;
  label: string;
  tone: 'pos' | 'fail' | 'neutral';
}

function focusOf(j: Journey): Focus {
  if (j.status === 'MISSED') return { from: j.origStop, to: j.stop, label: j.rung === 5 ? 'Missed, fare credit issued' : 'Missed, no recovery', tone: 'fail' };
  if (j.status === 'RECOVERED') {
    const label =
      j.rung === 1 ? `Re-dispatched to ${vehicleById(j.vehicleId).name} ${fmtTime(j.departure)}`
      : j.rung === 2 ? 'Connection held'
      : j.rung === 3 ? `Alternate pickup Stop ${j.stop}, +${j.extraWalk} min walk`
      : 'Partner ride dispatched';
    return { from: j.origStop, to: j.stop, label, tone: 'pos' };
  }
  return { from: j.origStop, to: j.stop, label: j.status === 'ON_TIME' ? 'On time' : 'Pending', tone: 'neutral' };
}

export function CorridorMap({ journeys, scenario, result, runId, selectedJourney, selectedStop, onSelectStop, onToggleVehicle, disabled }: Props) {
  const [prog, setProg] = useState<Record<VehicleId, number>>(IDLE);
  const [playId, setPlayId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const pathRefs = useRef<Partial<Record<VehicleId, SVGPathElement | null>>>({});
  const raf = useRef(0);
  const timers = useRef<number[]>([]);
  const latest = useRef({ result, journeys });
  latest.current = { result, journeys };

  useLayoutEffect(() => setReady(true), []);

  const cancel = () => {
    cancelAnimationFrame(raf.current);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const events = (): string[] => {
    const { result: r } = latest.current;
    if (!r) return [];
    const byId = new Map(r.journeys.map((j) => [j.id, j]));
    return [...r.log]
      .reverse()
      .map((e) => byId.get(e.journeyId))
      .filter((j): j is Journey => !!j && (j.status === 'RECOVERED' || j.status === 'MISSED'))
      .slice(0, 14)
      .map((j) => j.id);
  };

  const playback = () => {
    cancelAnimationFrame(raf.current);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    const ids = events();
    if (prefersReducedMotion()) {
      setPlayId(null);
      return;
    }
    ids.forEach((id, i) => timers.current.push(window.setTimeout(() => setPlayId(id), i * STEP_MS)));
    timers.current.push(window.setTimeout(() => setPlayId(null), ids.length * STEP_MS + 400));
  };

  useEffect(() => {
    cancel();
    setPlayId(null);
    setProg(IDLE);
    const r = latest.current.result;
    if (runId === 0 || !r) return cancel;
    if (prefersReducedMotion()) return cancel;
    const moving = VEHICLES.filter((v) => !r.scenario.broken.includes(v.id)).map((v) => v.id);
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = now - t0;
      const next = { ...IDLE };
      let done = true;
      for (const id of moving) {
        const p = Math.min(1, Math.max(0, (t - GROUP[id] * 800) / RUN_MS));
        if (p < 1) done = false;
        const e = 1 - Math.pow(1 - p, 2);
        next[id] = p <= 0 || p >= 1 ? IDLE[id] : IDLE[id] + (1 - IDLE[id]) * e;
        if (p > 0 && p < 1) next[id] = IDLE[id] + (1 - IDLE[id]) * e;
      }
      setProg(next);
      if (!done) raf.current = requestAnimationFrame(tick);
      else playback();
    };
    raf.current = requestAnimationFrame(tick);
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const brokenKey = scenario.broken.join(',');
  const focusJourney = journeys.find((j) => j.id === (playId ?? selectedJourney)) ?? null;
  const focus = focusJourney ? focusOf(focusJourney) : null;

  const info = useMemo(
    () =>
      STOPS.map((st) => {
        const booked = journeys.filter((j) => j.origStop === st.id);
        const missed = booked.filter((j) => j.status === 'MISSED').length;
        const servers = VEHICLES.filter((v) => v.stops.includes(st.id));
        const allDown = servers.every((v) => scenario.broken.includes(v.id));
        const affected = journeys.some((j) => j.origStop === st.id && scenario.broken.includes(j.origVehicleId));
        return { st, booked, missed, allDown, affected };
      }),
    [journeys, scenario.broken],
  );

  const posOf = (id: VehicleId): Pt => {
    const el = pathRefs.current[id];
    if (!ready || !el) return stopPt(vehicleById(id).stops[0]);
    const p = el.getPointAtLength(el.getTotalLength() * prog[id]);
    return [p.x, p.y];
  };

  const sel = info.find((i) => i.st.id === selectedStop);
  const hasEvents = !!result && result.journeys.some((j) => j.status === 'RECOVERED' || j.status === 'MISSED');

  return (
    <section className="panel p-4" aria-label="Corridor map">
      <div className="mb-2 flex items-center justify-between">
        <div className="label">Corridor</div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-sub sm:inline">Click a vehicle to break it down or restore it. Click a stop for detail.</span>
          <button
            onClick={playback}
            disabled={!hasEvents || disabled}
            className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[11px] font-medium hover:border-sub disabled:opacity-40"
          >
            <RotateCw size={11} aria-hidden />
            Replay recovery
          </button>
        </div>
      </div>
      <svg viewBox="0 0 640 340" className="h-auto w-full" role="img" aria-label="Stylised corridor: six pickup stops, four feeder vehicles, Indiranagar Metro and the metro trunk">
        {/* ring road */}
        <path d={RING} fill="none" stroke="#E8EBE9" strokeWidth={8} strokeLinecap="round" />
        {/* metro trunk */}
        <line x1={A[0]} y1={A[1]} x2={630} y2={A[1] - 70} stroke="#C9CECB" strokeWidth={5} strokeLinecap="round" />
        <line x1={A[0]} y1={A[1]} x2={630} y2={A[1] - 70} stroke="#fff" strokeWidth={1.5} strokeDasharray="5 6" />
        <text x={560} y={A[1] - 62} fontSize={10} fill={GREY} textAnchor="middle" transform="rotate(-24 560 98)">
          Metro trunk
        </text>

        {/* base routes */}
        {info.map(({ st, allDown, missed }) => {
          const bad = allDown || missed > 0;
          const isFocus = focus && (focus.to === st.id);
          const isSel = selectedStop === st.id;
          return (
            <path
              key={`${st.id}-${runId}`}
              className={bad ? undefined : 'draw'}
              pathLength={1}
              d={fan(st.id)}
              fill="none"
              stroke={bad ? RUST : TEAL}
              strokeWidth={isFocus || isSel ? 3.5 : 1.8}
              strokeDasharray={bad ? '6 4' : undefined}
              opacity={focus && !isFocus ? 0.25 : 0.85}
              style={{ transition: 'stroke 0.25s, opacity 0.25s, stroke-width 0.25s' }}
            />
          );
        })}

        {/* alternate pickup walk link */}
        {focus && focus.from !== focus.to && (
          <g>
            <line x1={stopPt(focus.from)[0]} y1={stopPt(focus.from)[1]} x2={stopPt(focus.to)[0]} y2={stopPt(focus.to)[1]} stroke={TEAL} strokeWidth={2.5} strokeDasharray="3 4" />
          </g>
        )}

        {/* hidden vehicle paths for measuring */}
        {VEHICLES.map((v) => (
          <path key={v.id} ref={(el) => { pathRefs.current[v.id] = el; }} d={vehiclePath(v.id)} fill="none" stroke="none" />
        ))}

        {/* anchor */}
        <circle cx={A[0]} cy={A[1]} r={17} fill="#171A19" />
        <text x={A[0]} y={A[1] + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">
          M
        </text>
        <text x={A[0]} y={A[1] + 34} textAnchor="middle" fontSize={11} fontWeight={600} fill="#171A19">
          {ANCHOR_NAME}
        </text>
        <text x={A[0]} y={A[1] + 47} textAnchor="middle" fontSize={9.5} fill={GREY}>
          Anchor station
        </text>
        <g opacity={scenario.metroDelay > 0 ? 1 : 0} style={{ transition: 'opacity 0.25s' }}>
          <rect x={A[0] - 36} y={A[1] - 44} width={72} height={18} rx={9} fill="#FAEEEA" stroke={RUST} strokeWidth={0.8} />
          <text x={A[0]} y={A[1] - 31.5} textAnchor="middle" fontSize={10} fontWeight={600} fill={RUST}>
            Metro +{scenario.metroDelay} min
          </text>
        </g>

        {/* stops */}
        {info.map(({ st, booked, missed, allDown, affected }) => {
          const bad = missed > 0 || allDown;
          const color = bad ? RUST : TEAL;
          const left = st.id === 4;
          const above = st.y < A[1];
          const lx = left ? st.x - 20 : st.x;
          const ly = left ? st.y - 2 : above ? st.y - 30 : st.y + 28;
          const anchor = left ? 'end' : 'middle';
          const isSel = selectedStop === st.id;
          return (
            <g
              key={st.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectStop(isSel ? null : st.id)}
              role="button"
              tabIndex={0}
              aria-label={`${st.name}, ${booked.length} commuters`}
              onKeyDown={(e) => e.key === 'Enter' && onSelectStop(isSel ? null : st.id)}
            >
              {affected && <circle key={`${st.id}-${brokenKey}`} className="pulse-ring" cx={st.x} cy={st.y} r={11} fill="none" stroke={RUST} strokeWidth={2} />}
              <circle cx={st.x} cy={st.y} r={isSel ? 11 : 9} fill="#fff" stroke={color} strokeWidth={isSel ? 3.5 : 2.5} style={{ transition: 'stroke 0.25s, r 0.15s' }} />
              <text x={lx} y={ly} textAnchor={anchor} fontSize={11} fontWeight={600} fill="#171A19">
                {st.name}
              </text>
              <text x={lx} y={ly + 12} textAnchor={anchor} fontSize={9.5} fill={missed > 0 ? RUST : GREY}>
                {booked.length} commuters{missed > 0 ? `, ${missed} missed` : ''}
              </text>
            </g>
          );
        })}

        {/* focus label */}
        {focus && focusJourney && (
          <g style={{ pointerEvents: 'none' }}>
            {(() => {
              const p = stopPt(focus.from);
              const text = focus.label;
              const w = Math.max(90, text.length * 5.6 + 16);
              const x = Math.min(Math.max(p[0] - w / 2, 4), 636 - w);
              const y = p[1] < A[1] ? p[1] + 16 : p[1] - 40;
              const fill = focus.tone === 'fail' ? '#FAEEEA' : focus.tone === 'pos' ? '#E8F3EF' : '#fff';
              const stroke = focus.tone === 'fail' ? RUST : focus.tone === 'pos' ? TEAL : '#E8EBE9';
              return (
                <g>
                  <rect x={x} y={y} width={w} height={34} rx={4} fill={fill} stroke={stroke} strokeWidth={1} />
                  <text x={x + 8} y={y + 14} fontSize={10} fontWeight={600} fill="#171A19">
                    {focusJourney.name}
                  </text>
                  <text x={x + 8} y={y + 27} fontSize={9.5} fill={stroke === '#E8EBE9' ? GREY : stroke}>
                    {text}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* vehicles */}
        {VEHICLES.map((v) => {
          const broken = scenario.broken.includes(v.id);
          const [x, y] = posOf(v.id);
          const c = broken ? RUST : TEAL;
          return (
            <g key={v.id} transform={`translate(${x} ${y})`} style={{ cursor: disabled ? 'default' : 'pointer' }} onClick={() => !disabled && onToggleVehicle(v.id)} role="button" tabIndex={0} aria-label={`${v.name}, ${broken ? 'broken down' : 'operational'}. Click to toggle.`} onKeyDown={(e) => e.key === 'Enter' && !disabled && onToggleVehicle(v.id)}>
              <title>{`${v.name} (${v.type}, ${v.seats} seats): ${broken ? 'BROKEN DOWN' : 'operational'}. Click to toggle.`}</title>
              <rect x={-11} y={-8} width={22} height={16} rx={4} fill={c} stroke="#fff" strokeWidth={1.5} style={{ transition: 'fill 0.25s' }} />
              <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">
                {SHORT[v.id]}
              </text>
              {broken && (
                <g>
                  <rect x={-34} y={-30} width={68} height={16} rx={3} fill="#FAEEEA" stroke={RUST} strokeWidth={0.8} />
                  <text y={-19} textAnchor="middle" fontSize={9} fontWeight={600} fill={RUST}>
                    {v.name} down
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-sub">
        <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-pos" /> Active route</span>
        <span className="flex items-center gap-1"><i className="inline-block h-0 w-4 border-t-2 border-dashed border-fail" /> Disrupted route</span>
        <span>PA, PB pods. SA, SB shuttles. Rust marker: broken down.</span>
      </div>

      {sel && (
        <div className="fade-up mt-3 rounded border border-line bg-canvas p-3 text-[12px]">
          <div className="font-semibold">
            {sel.st.name}: {sel.booked.length} commuters, {roadLeg(sel.st.roadMin, scenario.trafficTenths)} min road time at {(scenario.trafficTenths / 10).toFixed(1)}x
          </div>
          <div className="mt-0.5 text-sub">
            Served by {VEHICLES.filter((v) => v.stops.includes(sel.st.id)).map((v) => v.name + (scenario.broken.includes(v.id) ? ' (down)' : '')).join(', ')}.
            {' '}Affected:{' '}
            {sel.booked.filter((j) => j.status === 'MISSED' || j.status === 'RECOVERED' || scenario.broken.includes(j.origVehicleId)).map((j) => `${j.name} (${j.status === 'PENDING' ? 'vehicle down' : j.status.toLowerCase().replace('_', ' ')})`).join(', ') || 'none'}
          </div>
        </div>
      )}
    </section>
  );
}
