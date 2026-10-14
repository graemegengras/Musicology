/**
 * Piecewise-linear time scale. Starts at the Baroque. Before recording the
 * map is sparse, so 1600–1850 is compressed and the recording era gets room.
 */
export interface Segment {
  from: number;
  to: number;
  pxPerYear: number;
  tickEvery: number;
}

export const SEGMENTS: Segment[] = [
  { from: 1600, to: 1850, pxPerYear: 2.2, tickEvery: 50 },
  { from: 1850, to: 2026, pxPerYear: 11, tickEvery: 10 },
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
  return out;
}

export function formatSpan(start: number, end: number): string {
  return `${start} – ${end >= MAX_YEAR - 1 ? 'today' : end}`;
}
