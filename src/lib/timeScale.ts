/**
 * Piecewise-linear time scale. Music history is lopsided: two thousand years
 * of sparse evidence, then an explosion after recording arrives. Each segment
 * gets its own pixels-per-year so the 20th century has room to breathe.
 */
export interface Segment {
  from: number;
  to: number;
  pxPerYear: number;
  tickEvery: number;
}

export const SEGMENTS: Segment[] = [
  { from: -600, to: 1400, pxPerYear: 0.22, tickEvery: 400 },
  { from: 1400, to: 1850, pxPerYear: 1.5, tickEvery: 50 },
  { from: 1850, to: 2010, pxPerYear: 11, tickEvery: 10 },
];

export const MIN_YEAR = SEGMENTS[0].from;
export const MAX_YEAR = SEGMENTS[SEGMENTS.length - 1].to;

export function yearToX(year: number, zoom = 1): number {
  const y = Math.min(Math.max(year, MIN_YEAR), MAX_YEAR);
  let x = 0;
  for (const s of SEGMENTS) {
    if (y <= s.to) return (x + (y - s.from) * s.pxPerYear) * zoom;
    x += (s.to - s.from) * s.pxPerYear;
  }
  return x * zoom;
}

export function totalWidth(zoom = 1): number {
  return yearToX(MAX_YEAR, zoom);
}

export interface Tick {
  year: number;
  x: number;
  major: boolean;
}

export function ticks(zoom = 1): Tick[] {
  const out: Tick[] = [];
  for (const s of SEGMENTS) {
    // At high zoom, the dense segment can afford finer ticks.
    const step = zoom >= 2 && s.tickEvery === 10 ? 5 : s.tickEvery;
    const first = Math.ceil(s.from / step) * step;
    for (let y = first; y < s.to; y += step) {
      out.push({ year: y, x: yearToX(y, zoom), major: y % (step * 2) === 0 || step >= 50 });
    }
  }
  out.push({ year: MAX_YEAR, x: yearToX(MAX_YEAR, zoom), major: true });
  return out;
}

export function formatYear(y: number): string {
  if (y === 0) return '0';
  if (y < 0) return `${-y} BCE`;
  if (y < 1000) return `${y} CE`;
  return String(y);
}

export function formatSpan(start: number, end: number): string {
  if (start < 0 && end > 0) return `${-start} BCE – ${end} CE`;
  return `${formatYear(start)} – ${formatYear(end)}`;
}

/** Inverse of yearToX (bisection; the scale is monotonic). */
export function xToYear(x: number, zoom = 1): number {
  let lo = MIN_YEAR;
  let hi = MAX_YEAR;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (yearToX(mid, zoom) < x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
