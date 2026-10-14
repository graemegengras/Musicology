import { describe, expect, it } from 'vitest';
import { ERAS, LANES } from '../src/data/eras';
import { layoutLane } from '../src/lib/layout';
import { makeQuestion, seeded } from '../src/lib/quiz';
import { MAX_YEAR, MIN_YEAR, formatSpan, formatYear, xToYear, yearToX } from '../src/lib/timeScale';

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
    for (const y of [-300, 900, 1600, 1977]) expect(xToYear(yearToX(y, 1.5), 1.5)).toBeCloseTo(y, 3);
  });

  it('formats years', () => {
    expect(formatYear(-600)).toBe('600 BCE');
    expect(formatYear(800)).toBe('800 CE');
    expect(formatYear(1959)).toBe('1959');
    expect(formatSpan(-600, 300)).toBe('600 BCE – 300 CE');
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

describe('quiz', () => {
  it('always produces a question whose answer is among the choices, with no duplicate choices', () => {
    const rng = seeded(42);
    for (let i = 0; i < 500; i++) {
      const q = makeQuestion(ERAS, rng);
      const ids = q.choices.map((c) => c.eraId);
      expect(ids).toContain(q.answerEraId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
