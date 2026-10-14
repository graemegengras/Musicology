/**
 * Apple Music / iTunes "Library.xml" (a property list) → compact listening summary.
 * Self-contained (no imports) so scripts/import-library.ts can run it with Node.
 */

export interface LibraryAlbum {
  title: string;
  year?: number;
  tracks: number;
  plays: number;
}

export interface LibraryArtist {
  name: string;
  plays: number;
  tracks: number;
  loved: number;
  /** Most common genres on this artist's tracks, most frequent first. */
  genres: string[];
  albums: LibraryAlbum[];
  /** Artists credited with "feat." on this artist's tracks, or vice versa. */
  featured: string[];
  /** Earliest "Date Added" (ISO date). */
  firstAdded?: string;
}

export interface LibrarySummary {
  source: 'Apple Music';
  exportedAt?: string;
  trackCount: number;
  artists: LibraryArtist[];
}

type PlistValue = string | number | boolean | PlistValue[] | { [k: string]: PlistValue };

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e] ?? m;
  });
}

/** Minimal plist parser: dict, array, key, string, integer, real, date, data, true, false. */
export function parsePlist(xml: string): PlistValue {
  const tag = /<(\/?)([a-z]+)\s*(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>/gi;
  const stack: { kind: 'dict' | 'array'; value: PlistValue[] | Record<string, PlistValue>; key?: string }[] = [];
  let root: PlistValue | undefined;
  let textStart = 0;
  let openLeaf: string | null = null;

  const push = (v: PlistValue) => {
    const top = stack[stack.length - 1];
    if (!top) root = v;
    else if (top.kind === 'array') (top.value as PlistValue[]).push(v);
    else if (top.key !== undefined) {
      (top.value as Record<string, PlistValue>)[top.key] = v;
      top.key = undefined;
    }
  };

  for (let m = tag.exec(xml); m; m = tag.exec(xml)) {
    const [, closing, nameRaw, selfClosing] = m;
    if (!nameRaw) continue; // comment, prolog, doctype
    const name = nameRaw.toLowerCase();
    if (name === 'plist') continue;
    if (selfClosing) {
      if (name === 'true' || name === 'false') push(name === 'true');
      else if (name === 'dict') push({});
      else if (name === 'array') push([]);
      else if (name === 'string') push('');
      continue;
    }
    if (!closing) {
      if (name === 'dict') stack.push({ kind: 'dict', value: {} });
      else if (name === 'array') stack.push({ kind: 'array', value: [] });
      else {
        openLeaf = name;
        textStart = tag.lastIndex;
      }
      continue;
    }
    if (name === 'dict' || name === 'array') {
      const done = stack.pop()!;
      push(done.value);
      continue;
    }
    if (openLeaf !== name) continue;
    const text = decode(xml.slice(textStart, m.index));
    openLeaf = null;
    if (name === 'key') {
      const top = stack[stack.length - 1];
      if (top?.kind === 'dict') top.key = text;
    } else if (name === 'integer' || name === 'real') push(Number(text));
    else if (name === 'data') push(text.replace(/\s+/g, ''));
    else push(text); // string, date
  }
  if (root === undefined) throw new Error('Not a property list');
  return root;
}

const FEAT = /\s+(?:feat\.?|ft\.?|featuring)\s+/i;

/** "A feat. B & C" → { primary: "A", featured: ["B", "C"] } */
export function splitArtist(raw: string): { primary: string; featured: string[] } {
  const [primary, rest] = raw.split(FEAT, 2);
  const featured = rest ? rest.split(/\s*(?:,|&| and )\s*/i).map((s) => s.trim()).filter(Boolean) : [];
  return { primary: primary.trim(), featured };
}

interface Track {
  Name?: string;
  Artist?: string;
  'Album Artist'?: string;
  Album?: string;
  Year?: number;
  Genre?: string;
  'Play Count'?: number;
  Loved?: boolean;
  Favorited?: boolean;
  'Date Added'?: string;
  Podcast?: boolean;
  Movie?: boolean;
  'TV Show'?: boolean;
  'Has Video'?: boolean;
  'Music Video'?: boolean;
  Kind?: string;
}

const SKIP_ARTISTS = new Set(['', 'various artists', 'unknown artist', 'various']);

export function summarizeLibrary(xml: string): LibrarySummary {
  const plist = parsePlist(xml) as Record<string, PlistValue>;
  const tracks = Object.values((plist.Tracks ?? {}) as Record<string, Track>);

  interface Acc {
    name: string;
    plays: number;
    tracks: number;
    loved: number;
    genres: Map<string, number>;
    albums: Map<string, LibraryAlbum>;
    featured: Set<string>;
    firstAdded?: string;
  }
  const byKey = new Map<string, Acc>();
  const get = (name: string): Acc => {
    const key = name.toLowerCase();
    let a = byKey.get(key);
    if (!a) {
      a = { name, plays: 0, tracks: 0, loved: 0, genres: new Map(), albums: new Map(), featured: new Set() };
      byKey.set(key, a);
    }
    return a;
  };

  let trackCount = 0;
  for (const t of tracks) {
    if (t.Podcast || t.Movie || t['TV Show'] || t['Has Video'] || t['Music Video']) continue;
    if (t.Kind && /audiobook|book|video/i.test(t.Kind)) continue;
    const raw = (t.Artist ?? t['Album Artist'] ?? '').trim();
    if (SKIP_ARTISTS.has(raw.toLowerCase())) continue;
    trackCount++;

    const { primary, featured } = splitArtist(raw);
    const a = get(primary);
    const plays = t['Play Count'] ?? 0;
    a.plays += plays;
    a.tracks += 1;
    if (t.Loved || t.Favorited) a.loved += 1;
    if (t.Genre) a.genres.set(t.Genre, (a.genres.get(t.Genre) ?? 0) + 1);
    if (t['Date Added'] && (!a.firstAdded || t['Date Added'] < a.firstAdded)) a.firstAdded = t['Date Added'];
    if (t.Album) {
      const key = t.Album.toLowerCase();
      const al = a.albums.get(key) ?? { title: t.Album, year: t.Year, tracks: 0, plays: 0 };
      al.tracks += 1;
      al.plays += plays;
      if (t.Year && (!al.year || t.Year < al.year)) al.year = t.Year;
      a.albums.set(key, al);
    }
    for (const f of featured) {
      a.featured.add(f);
      get(f).featured.add(primary);
    }
  }

  const artists: LibraryArtist[] = [...byKey.values()]
    .filter((a) => a.tracks > 0 || a.featured.size > 0)
    .map((a) => ({
      name: a.name,
      plays: a.plays,
      tracks: a.tracks,
      loved: a.loved,
      genres: [...a.genres.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([g]) => g),
      albums: [...a.albums.values()].sort((x, y) => (x.year ?? 9999) - (y.year ?? 9999)),
      featured: [...a.featured].sort(),
      firstAdded: a.firstAdded?.slice(0, 10),
    }))
    .sort((x, y) => y.plays - x.plays || y.tracks - x.tracks || x.name.localeCompare(y.name));

  return {
    source: 'Apple Music',
    exportedAt: typeof plist.Date === 'string' ? plist.Date.slice(0, 10) : undefined,
    trackCount,
    artists,
  };
}
