import { describe, expect, it } from 'vitest';
import { ERAS, LANES } from '../src/data/eras';
import { layoutLane } from '../src/lib/layout';
import { MAX_YEAR, MIN_YEAR, formatSpan, xToYear, yearToX } from '../src/lib/timeScale';

describe('timeScale', () => {
  it('is monotonic and continuous across segments', () => {
    let prev = -1;
    for (let y = MIN_YEAR; y <= MAX_YEAR; y += 7) {
      const x = yearToX(y);
      expect(x).toBeGreaterThan(prev);
      prev = x;
    }
  });

  it('scales with zoom and inverts', () => {
    expect(yearToX(1950, 2)).toBeCloseTo(yearToX(1950) * 2);
    for (const y of [1600, 1720, 1850, 1977]) expect(xToYear(yearToX(y, 1.5), 1.5)).toBeCloseTo(y, 3);
  });

  it('formats spans', () => {
    expect(formatSpan(1600, 1750)).toBe('1600 – 1750');
    expect(formatSpan(1300, 2026)).toBe('1300 – today');
  });
});

describe('layout', () => {
  it('never overlaps cards within a row', () => {
    for (const zoom of [0.6, 1, 2.5]) {
      for (const lane of LANES) {
        const { items } = layoutLane(lane.id, ERAS, zoom);
        for (const a of items)
          for (const b of items)
            if (a !== b && a.row === b.row) expect(a.x + a.width <= b.x || b.x + b.width <= a.x).toBe(true);
      }
    }
  });
});
