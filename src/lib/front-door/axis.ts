// VicData 0.8 front door (Guy, 13 Nov): a walk chart's value axis on round numbers. Steps are 1, 2, 2.5
// or 5 x 10^n; the axis starts at zero when the lowest value is no more than half the highest (counts,
// entries), otherwise at the step just below the lowest value (indexed lines, points), so ticks read
// 0, 50, 100, 150 rather than 7, 46, 85, 123, 162. Places (1st, 2nd ...) run from 1 on whole numbers.

export type Axis = { lo: number; hi: number; ticks: number[]; digits: number };

const STEPS = [1, 2, 2.5, 5, 10];

/** The smallest nice step (1, 2, 2.5, 5 x 10^n) at or above `raw`. 2.5 only where it stays whole for whole data. */
export function niceStep(raw: number, whole = false): number {
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const e = Math.floor(Math.log10(raw));
  const base = 10 ** e;
  for (const s of STEPS) {
    const step = s * base;
    if (s === 2.5 && whole && step < 25) continue;
    if (whole && step < 1) continue;
    if (step >= raw - 1e-9) return round(step);
  }
  return round(10 * base);
}

const round = (v: number) => Number(v.toPrecision(12));

/** Decimal places a tick at this step needs (0.25 -> 2, 2.5 -> 1, 50 -> 0). */
export function stepDigits(step: number): number {
  for (let d = 0; d <= 6; d++) if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d;
  return 6;
}

/**
 * The axis for these values. `place`: a rank axis (whole numbers from 1). About four to six ticks; the
 * range always holds every value, with the lowest and highest ticks at or beyond them.
 */
export function niceAxis(values: number[], opts: { place?: boolean; target?: number } = {}): Axis {
  const vals = values.filter((v) => Number.isFinite(v));
  const target = opts.target ?? 4;
  if (!vals.length) return { lo: 0, hi: 1, ticks: [0, 1], digits: 0 };
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  if (opts.place) {
    const top = Math.max(2, Math.ceil(rawMax));
    const step = top - 1 <= 6 ? 1 : niceStep((top - 1) / target, true);
    const hi = Math.ceil(top / step) * step;
    const ticks = [1];
    for (let t = step; t <= hi; t += step) if (t > 1) ticks.push(t);
    return { lo: 0.5, hi: hi + 0.5, ticks, digits: 0 };
  }
  const whole = vals.every((v) => Number.isInteger(v));
  const fromZero = rawMin >= 0 && rawMin <= rawMax * 0.5;
  const base = fromZero ? 0 : rawMin;
  let span = rawMax - base;
  if (span <= 0) span = Math.abs(rawMax) || 1;
  let step = niceStep(span / target, whole);
  let lo = fromZero ? 0 : Math.floor(rawMin / step) * step;
  let hi = Math.ceil(rawMax / step) * step;
  if (hi === lo) hi = lo + step;
  // Too many ticks after flooring and ceiling: one step up.
  while ((hi - lo) / step > target + 2) {
    step = niceStep(step * 1.01, whole);
    lo = fromZero ? 0 : Math.floor(rawMin / step) * step;
    hi = Math.ceil(rawMax / step) * step;
  }
  const ticks: number[] = [];
  for (let k = 0; lo + k * step <= hi + step * 1e-9; k++) ticks.push(round(lo + k * step));
  return { lo: round(lo), hi: round(hi), ticks, digits: stepDigits(step) };
}
