import { runEngine, DEFAULT_SCENARIO, Scenario, fmtTime, displayArrival } from '../src/engine/GuaranteeEngine';

function show(label: string, s: Scenario, verbose = false) {
  const on = runEngine(s, 'ON');
  const off = runEngine(s, 'OFF');
  const m = on.metrics, o = off.metrics;
  console.log(`\n== ${label}: booked ${m.total} unassigned ${on.unassigned.length}`);
  console.log(` OFF hit ${o.hitRate.toFixed(1)} missed ${o.missed} | ON hit ${m.hitRate.toFixed(1)} missed ${m.missed} cost ${m.cost} cps ${m.costPerSuccess.toFixed(1)} breached ${m.breached}`);
  console.log(` rungs`, JSON.stringify(on.counts.byRung), 'r5', on.counts.rung5Credits, 'r2refused', on.counts.rung2Refused, 'budget rem', on.budget.remaining);
  if (verbose) for (const e of [...on.log].reverse()) { console.log(` #${e.seq} ${fmtTime(e.time)} ${e.name} S${e.stop} ${e.head}`); e.steps.forEach(st => console.log('    ' + st.text)); }
  return on;
}
show('default', DEFAULT_SCENARIO);
for (const d of [3,5,7,9,12]) show(`delay ${d}`, { ...DEFAULT_SCENARIO, metroDelay: d });
for (const t of [12,14,16,18]) show(`traffic ${t}`, { ...DEFAULT_SCENARIO, trafficTenths: t });
show('shA broken', { ...DEFAULT_SCENARIO, broken: ['shA'] });
show('delay6+traffic13+spike30', { ...DEFAULT_SCENARIO, metroDelay: 6, trafficTenths: 13, demandSpikePct: 30 });
show('max', { metroDelay: 20, trafficTenths: 18, demandSpikePct: 0, broken: ['shA','shB'] }, false);
show('max+spike', { metroDelay: 20, trafficTenths: 18, demandSpikePct: 60, broken: ['shA','shB'] });
void displayArrival;
