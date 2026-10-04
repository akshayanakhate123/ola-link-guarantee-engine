import type { Status } from './GuaranteeEngine';

export const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-IN')}`;

/** One decimal, but never lets a failing 94.97 display as a passing 95.0 (or 99.97 as 100.0). */
export const pct = (n: number) => {
  let r = Math.round(n * 10) / 10;
  if (n < 95 && r >= 95) r = 94.9;
  if (n < 100 && r >= 100) r = 99.9;
  return `${r.toFixed(1)}%`;
};

export const statusLabel: Record<Status, string> = {
  PENDING: 'PENDING',
  ON_TIME: 'ON TIME',
  RECOVERED: 'RECOVERED',
  MISSED: 'MISSED',
};
