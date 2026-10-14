import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePlist, splitArtist, summarizeLibrary } from '../src/lib/appleLibrary';

const xml = readFileSync(new URL('./fixtures/Library.xml', import.meta.url), 'utf8');

describe('parsePlist', () => {
  it('parses nested dicts, arrays, scalars and entities', () => {
    const p = parsePlist(xml) as Record<string, any>;
    expect(p['Major Version']).toBe(1);
    expect(p.Tracks['1'].Loved).toBe(true);
    expect(p.Tracks['3'].Name).toBe('Love & Hate');
    expect(p.Playlists[0].Name).toBe('Library');
  });
});

describe('splitArtist', () => {
  it('splits featured credits but leaves band names alone', () => {
    expect(splitArtist('Michael Kiwanuka feat. Tom Misch & Loyle Carner')).toEqual({
      primary: 'Michael Kiwanuka',
      featured: ['Tom Misch', 'Loyle Carner'],
    });
    expect(splitArtist('Simon & Garfunkel')).toEqual({ primary: 'Simon & Garfunkel', featured: [] });
  });
});

describe('summarizeLibrary', () => {
  const s = summarizeLibrary(xml);
  it('aggregates artists by plays and skips podcasts and compilations', () => {
    expect(s.trackCount).toBe(3);
    expect(s.exportedAt).toBe('2026-10-14');
    expect(s.artists[0]).toMatchObject({
      name: 'Radiohead',
      plays: 50,
      tracks: 2,
      loved: 1,
      genres: ['Alternative'],
      albums: [{ title: 'OK Computer', year: 1997, tracks: 2, plays: 50 }],
      firstAdded: '2015-03-01',
    });
    expect(s.artists.map((a) => a.name)).not.toContain('A Podcast');
  });
  it('links featured artists both ways', () => {
    const k = s.artists.find((a) => a.name === 'Michael Kiwanuka')!;
    expect(k.featured).toEqual(['Loyle Carner', 'Tom Misch']);
    expect(s.artists.find((a) => a.name === 'Tom Misch')!.featured).toEqual(['Michael Kiwanuka']);
  });
  it('drops file paths', () => {
    expect(JSON.stringify(s)).not.toContain('file://');
  });
});
