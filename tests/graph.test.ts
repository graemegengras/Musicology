import { describe, expect, it } from 'vitest';
import type { GraphData } from '../src/data/graphTypes';
import { buildIndex, connectionsOf, describeOther, inverseLabel, pathBetween, suggestions } from '../src/lib/graph';

const data: GraphData = {
  builtAt: '2026-10-14',
  library: { 'J Dilla': 'dilla', 'Slum Village': 'sv', Common: 'common' },
  artists: {
    dilla: { name: 'J Dilla', lib: 'J Dilla', plays: 1269 },
    sv: { name: 'Slum Village', lib: 'Slum Village', plays: 975 },
    common: { name: 'Common', lib: 'Common', plays: 300 },
    karriem: { name: 'Karriem Riggins' },
    frank: { name: 'Frank Nitt' },
    elevado: { name: 'Russell Elevado' },
  },
  links: [
    ['dilla', 'sv', 'member', 'member of', 1996, 2001],
    ['karriem', 'common', 'support', 'drums (drum set) for', null, null],
    ['frank', 'dilla', 'collab', 'collaboration with', null, null],
  ],
  discographies: { common: [['like-water', 'Like Water for Chocolate', 2000, 'Album', null]] },
  libraryAlbums: { 'like-water': 120 },
};
const credits = {
  'like-water': [
    ['karriem', 'drums', 3],
    ['elevado', 'mix', 10],
  ] as [string, string, number][],
};

describe('labels', () => {
  it('inverts and describes the other side of a link', () => {
    expect(inverseLabel('member of')).toBe('member');
    expect(describeOther('member of')).toBe('band');
    expect(describeOther('member (drums)')).toBe('member · drums');
    expect(describeOther('drums (drum set) for')).toBe('played drums (drum set) for');
    expect(describeOther(inverseLabel('drums (drum set) for'))).toBe('drums (drum set)');
  });
});

describe('graph index', () => {
  const ix = buildIndex(data, credits);

  it('connects both directions with role labels and years', () => {
    expect(connectionsOf(ix, 'dilla').find((c) => c.id === 'sv')?.labels).toEqual(['band (1996–2001)']);
    expect(connectionsOf(ix, 'sv').find((c) => c.id === 'dilla')?.labels).toEqual(['member (1996–2001)']);
  });

  it('merges a support link and an album credit into one connection, keeping the stronger kind', () => {
    const c = connectionsOf(ix, 'common').find((x) => x.id === 'karriem')!;
    expect(c.kind).toBe('support');
    expect(c.labels).toContain('drums on Like Water for Chocolate');
  });

  it('hides engineering-only connections by default', () => {
    expect(connectionsOf(ix, 'common').map((c) => c.id)).not.toContain('elevado');
    expect(connectionsOf(ix, 'common', { technical: true }).map((c) => c.id)).toContain('elevado');
  });

  it('suggests new artists connected to the library, best-connected first', () => {
    const s = suggestions(ix);
    expect(s.map((x) => x.id)).toEqual(['karriem', 'frank']);
    expect(s.every((x) => !data.artists[x.id].lib)).toBe(true);
  });

  it('finds paths between artists', () => {
    expect(pathBetween(ix, 'frank', 'sv')).toEqual(['frank', 'dilla', 'sv']);
    expect(pathBetween(ix, 'sv', 'karriem')).toBeNull();
  });
});
