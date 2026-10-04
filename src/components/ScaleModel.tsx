import { useState } from 'react';
import { computeScale } from '../engine/scaleModel';
import type { ScaleInputs } from '../engine/scaleModel';
import { useCountUp } from '../hooks';

const n0 = (n: number) => Math.round(n).toLocaleString('en-US');

function NumField(props: { label: string; value: number; suffix?: string; onChange: (n: number) => void; max?: number }) {
  const [text, setText] = useState(props.value.toLocaleString('en-US'));
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-sub">{props.label}</span>
      <span className="flex items-center rounded border border-line bg-white focus-within:border-pos">
        <input
          inputMode="numeric"
          className="w-full bg-transparent px-2.5 py-2 text-[13px] outline-none"
          value={text}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '');
            let v = digits === '' ? 0 : Number(digits);
            if (props.max !== undefined) v = Math.min(v, props.max);
            setText(digits === '' ? '' : v.toLocaleString('en-US'));
            props.onChange(v);
          }}
        />
        {props.suffix && <span className="pr-2.5 text-[12px] text-sub">{props.suffix}</span>}
      </span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5 text-[12.5px]">
      <span className="text-sub">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function Scenario(props: { title: string; dot: string; legs: string; feeder: string; cap: string; fleet: number; tone: string; tint?: boolean }) {
  const f = useCountUp(props.fleet, 700);
  return (
    <section className={`panel p-5 ${props.tint ? 'bg-posbg/50' : ''}`} aria-label={props.title}>
      <div className="mb-3 flex items-center gap-2">
        <i className={`inline-block h-2.5 w-2.5 rounded-full ${props.dot}`} />
        <h2 className="text-[14px] font-semibold">{props.title}</h2>
      </div>
      <Row label="Daily passenger legs" value={props.legs} />
      <Row label="Legs carried by Ola feeders" value={props.feeder} />
      <Row label="Effective capacity per vehicle per day" value={props.cap} />
      <div className="mt-3 border-t border-line pt-3">
        <div className="label">Required fleet</div>
        <div className={`mt-1 text-[38px] font-bold leading-none tracking-tight ${props.tone}`}>
          {n0(f)} <span className="text-[13px] font-normal text-sub">vehicles</span>
        </div>
      </div>
    </section>
  );
}

export function ScaleModel({ inp, onChange }: { inp: ScaleInputs; onChange: (i: ScaleInputs) => void }) {
  const set = (p: Partial<ScaleInputs>) => onChange({ ...inp, ...p });
  const o = computeScale(inp);
  const cap = o.legCapacityPerVehiclePerDay.toLocaleString('en-US', { maximumFractionDigits: 1 });
  const red = useCountUp(o.reduction, 700);
  const full = o.fleetIfLinkCarriesEverything;
  const wPct = full > 0 ? (o.fleetWithTrunk / full) * 100 : 0;
  return (
    <div className="space-y-5">
      <div className="fade-up">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Can the network reach 100 million commuters?</h1>
        <p className="mt-1.5 text-[14px] text-sub">Illustrative arithmetic. Inputs are planning assumptions, not forecasts.</p>
      </div>

      <section className="panel fade-up p-5" aria-label="Planning assumptions">
        <div className="label mb-3">Planning assumptions</div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <NumField label="Commuters" value={inp.commuters} onChange={(v) => set({ commuters: v })} />
          <NumField label="Legs per commuter per day" value={inp.legsPerDay} onChange={(v) => set({ legsPerDay: v })} />
          <NumField label="Seats per vehicle" value={inp.seats} onChange={(v) => set({ seats: v })} />
          <NumField label="Vehicle trips per day" value={inp.tripsPerDay} onChange={(v) => set({ tripsPerDay: v })} />
          <NumField label="Average occupancy" suffix="%" max={100} value={inp.occupancyPct} onChange={(v) => set({ occupancyPct: v })} />
          <NumField label="Transit trunk share" suffix="%" max={100} value={inp.trunkSharePct} onChange={(v) => set({ trunkSharePct: v })} />
        </div>
      </section>

      <div className="fade-up grid grid-cols-1 gap-5 md:grid-cols-2">
        <Scenario title="If Link carried every leg" dot="bg-fail" legs={n0(o.dailyLegs)} feeder={n0(o.dailyLegs)} cap={cap} fleet={o.fleetIfLinkCarriesEverything} tone="" />
        <Scenario title="With transit carrying the trunk" dot="bg-pos" legs={n0(o.dailyLegs)} feeder={n0(o.feederLegs)} cap={cap} fleet={o.fleetWithTrunk} tone="text-pos" tint />
      </div>

      <section className="panel fade-up p-5" aria-label="Fleet reduction">
        <div className="label mb-1">Transit participation effect</div>
        <div className="mb-4 text-[30px] font-bold tracking-tight text-pos">
          {red.toFixed(1)}% <span className="text-[15px] font-medium text-ink">fewer vehicles</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-[11.5px] text-sub">
              <span>All legs via Link</span>
              <span className="font-medium text-ink">{n0(full)}</span>
            </div>
            <div className="h-5 rounded-sm bg-line">
              <div className="h-5 rounded-sm bg-fail" style={{ width: full > 0 ? '100%' : '0%', transition: 'width 0.7s ease' }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-[11.5px] text-sub">
              <span>With transit carrying the trunk</span>
              <span className="font-medium text-ink">{n0(o.fleetWithTrunk)}</span>
            </div>
            <div className="h-5 rounded-sm bg-line">
              <div className="h-5 rounded-sm bg-pos" style={{ width: `${wPct}%`, transition: 'width 0.7s ease' }} />
            </div>
          </div>
        </div>
        <details className="mt-4 text-[12px]">
          <summary className="cursor-pointer font-medium text-pos">Show the arithmetic</summary>
          <ul className="mt-2 space-y-0.5 text-sub">
            <li>Daily legs = commuters x legs per day = {n0(o.dailyLegs)}</li>
            <li>Feeder legs = daily legs x (1 - trunk share) = {n0(o.feederLegs)}</li>
            <li>Effective passengers per trip = seats x occupancy = {o.effectivePaxPerTrip.toLocaleString('en-US', { maximumFractionDigits: 2 })}</li>
            <li>Capacity per vehicle per day = passengers per trip x trips per day = {cap}</li>
            <li>Fleet, every leg = ceil(daily legs / capacity) = {n0(o.fleetIfLinkCarriesEverything)}</li>
            <li>Fleet, with trunk = ceil(feeder legs / capacity) = {n0(o.fleetWithTrunk)}</li>
            <li>Reduction = (1 - fleet with trunk / fleet every leg) x 100 = {o.reduction.toFixed(1)}%</li>
          </ul>
        </details>
      </section>

      <p className="max-w-3xl text-[12px] text-sub">
        The model assumes transit absorbs the trunk journey while Ola Link operates feeder connections. These are capacity calculations, not demand or financial forecasts.
      </p>
    </div>
  );
}
