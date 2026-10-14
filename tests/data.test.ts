import { describe, expect, it } from 'vitest';
import { ERAS, ERA_BY_ID, LANES } from '../src/data/eras';
import { TOURS } from '../src/data/tours';

describe('era data', () => {
  it('has unique ids', () => {
    expect(new Set(ERAS.map((e) => e.id)).size).toBe(ERAS.length);
  });

  it('uses known lanes and sane date ranges', () => {
    const lanes = new Set(LANES.map((l) => l.id));
    for (const e of ERAS) {
      expect(lanes.has(e.lane), e.id).toBe(true);
      expect(e.start, e.id).toBeLessThan(e.end);
    }
  });

  it('only references existing eras as influences, and parents start no later than children', () => {
    for (const e of ERAS) {
      for (const p of e.influences) {
        expect(ERA_BY_ID[p], `${e.id} -> ${p}`).toBeDefined();
        expect(ERA_BY_ID[p].start, `${p} should start before ${e.id}`).toBeLessThanOrEqual(e.start);
      }
    }
  });

  it('has well-formed Spotify ids', () => {
    for (const e of ERAS) {
      for (const l of e.listen) {
        if (l.spotify) expect(l.spotify.id, `${e.id}: ${l.title}`).toMatch(/^[0-9A-Za-z]{22}$/);
        expect(!(l.spotify && l.notOnSpotify), `${e.id}: ${l.title} can't be both`).toBe(true);
      }
    }
  });

  it('explains every era that is not fully on Spotify', () => {
    for (const e of ERAS.filter((x) => x.availability !== 'spotify')) {
      expect(e.availabilityNote, e.id).toBeTruthy();
    }
    for (const e of ERAS.filter((x) => x.availability === 'unavailable')) {
      expect(e.listen.every((l) => !l.spotify), `${e.id} is unavailable but has a Spotify item`).toBe(true);
    }
  });
});

describe('tours', () => {
  it('only visit existing eras', () => {
    for (const t of TOURS) for (const s of t.steps) expect(ERA_BY_ID[s.eraId], `${t.id}: ${s.eraId}`).toBeDefined();
  });
});
