/**
 * In-memory index over the prebuilt graph (public/data/graph.json + credits.json),
 * plus whatever gets fetched live while browsing. Pure: no fetching here.
 */
import type { CreditsData, DiscographyEntry, GraphArtist, GraphData } from '../data/graphTypes';
import { isTechnicalRole, normalize, type EdgeKind } from './mb';

export interface Connection {
  id: string;
  kind: EdgeKind;
  /** Labels from the viewed artist's point of view, e.g. "member of", "bass guitar on Black Messiah". */
  labels: string[];
  /** Release groups the connection comes from (for credits). */
  albums: Set<string>;
  /** True when the only shared credits are engineering/mastering. */
  technical: boolean;
  begin?: number;
  end?: number;
}

export interface AlbumInfo {
  id: string;
  title: string;
  year?: number;
  type: string;
  owner: string;
  by?: string;
}

export interface GraphIndex {
  artists: Record<string, GraphArtist>;
  adj: Map<string, Map<string, Connection>>;
  albums: Map<string, AlbumInfo>;
  discographies: Record<string, DiscographyEntry[]>;
  libraryAlbums: Record<string, number>;
  credits: CreditsData;
  /** normalized name → artist id, for library artists and everyone else in the graph */
  byName: Map<string, string>;
}

const KIND_RANK: Record<EdgeKind, number> = { member: 0, collab: 1, family: 2, support: 3, feat: 4, credit: 5 };
export const KIND_LABEL: Record<EdgeKind, string> = {
  member: 'Bands & members',
  collab: 'Collaborations',
  family: 'Family & teachers',
  support: 'Played for',
  feat: 'Featured with',
  credit: 'On the records',
};

const INVERSE: [RegExp, string][] = [
  [/^member of\b/, 'member'],
  [/^member\b/, 'member of'],
  [/^part of$/, 'includes'],
  [/^includes$/, 'part of'],
  [/^collaboration with$/, 'part of'],
  [/^backed by \((.+)\)$/, '$1 for'],
  [/^backed by$/, 'played for'],
  [/^played for$/, 'backed by'],
  [/^(.+) for$/, 'backed by ($1)'],
  [/^parent of$/, 'child of'],
  [/^child of$/, 'parent of'],
  [/^teacher of$/, 'student of'],
  [/^student of$/, 'teacher of'],
  [/^also known as$/, 'performs as'],
  [/^performs as$/, 'also known as'],
];

export function inverseLabel(label: string): string {
  for (const [re, rep] of INVERSE) if (re.test(label)) return label.replace(re, rep);
  return label;
}

/**
 * Turn a raw link label ("A <label> B", from MusicBrainz's direction) into a short
 * description of B's role, shown under B's name on A's page.
 */
export function describeOther(raw: string): string {
  const m = raw.match(/^(.+?)(?: \((.+)\))?$/)!;
  const [, base, attrs] = m;
  const withAttrs = (word: string) => (attrs ? `${word} · ${attrs}` : word);
  switch (base) {
    case 'member of':
      return attrs ? `band · played ${attrs}` : 'band';
    case 'member':
      return withAttrs('member');
    case 'part of':
      return 'project';
    case 'includes':
    case 'collaboration with':
      return 'collaborator';
    case 'backed by':
      return attrs ?? 'backing musician';
    case 'parent of':
      return 'child';
    case 'child of':
      return 'parent';
    case 'teacher of':
      return 'student';
    case 'student of':
      return 'teacher';
    case 'also known as':
    case 'performs as':
      return 'same person, other name';
    default:
      return base.endsWith(' for') ? `played ${base.replace(/^played /, '')}` : raw;
  }
}

export function emptyIndex(): GraphIndex {
  return { artists: {}, adj: new Map(), albums: new Map(), discographies: {}, libraryAlbums: {}, credits: {}, byName: new Map() };
}

function connect(
  ix: GraphIndex,
  a: string,
  b: string,
  kind: EdgeKind,
  label: string,
  opts: { album?: string; technical?: boolean; begin?: number | null; end?: number | null } = {},
) {
  if (a === b) return;
  const m = ix.adj.get(a) ?? new Map<string, Connection>();
  ix.adj.set(a, m);
  const c = m.get(b);
  const technical = opts.technical ?? false;
  if (!c) {
    m.set(b, {
      id: b,
      kind,
      labels: [label],
      albums: new Set(opts.album ? [opts.album] : []),
      technical,
      begin: opts.begin ?? undefined,
      end: opts.end ?? undefined,
    });
    return;
  }
  // Keep the strongest kind (membership beats a credit) and collect every label.
  if (KIND_RANK[kind] < KIND_RANK[c.kind]) c.kind = kind;
  if (!c.labels.includes(label)) c.labels.push(label);
  if (opts.album) c.albums.add(opts.album);
  c.technical = c.technical && technical;
}

export function addLinks(ix: GraphIndex, links: GraphData['links']) {
  for (const [from, to, kind, label, begin, end] of links) {
    const years = begin ? ` (${begin}${end && end !== begin ? `–${end}` : ''})` : '';
    connect(ix, from, to, kind, describeOther(label) + years, { begin, end });
    connect(ix, to, from, kind, describeOther(inverseLabel(label)) + years, { begin, end });
  }
}

export function addDiscography(ix: GraphIndex, artistId: string, entries: DiscographyEntry[]) {
  ix.discographies[artistId] = entries;
  for (const [id, title, year, type, by] of entries) {
    if (!ix.albums.has(id)) ix.albums.set(id, { id, title, year: year ?? undefined, type, owner: artistId, by: by ?? undefined });
  }
}

export function addCredits(ix: GraphIndex, albumId: string, list: CreditsData[string]) {
  ix.credits[albumId] = list;
  const album = ix.albums.get(albumId);
  if (!album) return;
  for (const [person, roles] of list) {
    const technical = roles.split(', ').every(isTechnicalRole);
    const label = `${roles} on ${album.title}`;
    connect(ix, album.owner, person, 'credit', label, { album: albumId, technical });
    connect(ix, person, album.owner, 'credit', label, { album: albumId, technical });
  }
}

export function addArtist(ix: GraphIndex, id: string, a: GraphArtist) {
  // Merge, so a live lookup can add detail without dropping library info.
  const defined = Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined));
  ix.artists[id] = { ...ix.artists[id], ...defined } as GraphArtist;
  const key = normalize(a.name);
  if (!ix.byName.has(key) || a.lib) ix.byName.set(key, id);
}

export function buildIndex(data: GraphData, credits: CreditsData = {}, featured: [string, string][] = []): GraphIndex {
  const ix = emptyIndex();
  for (const [id, a] of Object.entries(data.artists)) addArtist(ix, id, a);
  ix.libraryAlbums = data.libraryAlbums;
  addLinks(ix, data.links);
  for (const [id, entries] of Object.entries(data.discographies)) addDiscography(ix, id, entries);
  for (const [album, list] of Object.entries(credits)) addCredits(ix, album, list);
  // "feat." credits from the library, between artists we could resolve.
  for (const [a, b] of featured) {
    const ia = data.library[a];
    const ib = data.library[b];
    if (ia && ib) {
      connect(ix, ia, ib, 'feat', 'featured together');
      connect(ix, ib, ia, 'feat', 'featured together');
    }
  }
  return ix;
}

export function inLibrary(ix: GraphIndex, id: string): boolean {
  return Boolean(ix.artists[id]?.lib);
}

/** Connections of an artist, library artists first within each kind, strongest first. */
export function connectionsOf(ix: GraphIndex, id: string, opts: { technical?: boolean } = {}): Connection[] {
  const list = [...(ix.adj.get(id)?.values() ?? [])].filter((c) => opts.technical || !c.technical);
  return list.sort(
    (a, b) =>
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      Number(inLibrary(ix, b.id)) - Number(inLibrary(ix, a.id)) ||
      b.albums.size - a.albums.size ||
      (ix.artists[b.id]?.plays ?? 0) - (ix.artists[a.id]?.plays ?? 0) ||
      (ix.artists[a.id]?.name ?? '').localeCompare(ix.artists[b.id]?.name ?? ''),
  );
}

export interface Suggestion {
  id: string;
  score: number;
  /** Library artists this one connects to, strongest first. */
  via: { id: string; conn: Connection }[];
}

const KIND_WEIGHT: Record<EdgeKind, number> = { member: 3, collab: 2.5, family: 2, support: 2, feat: 2, credit: 1 };

/**
 * Artists you don't have that sit next to artists you do. Each library neighbour
 * counts by how much you play it and how close the tie is; reaching many of
 * your artists beats one strong tie.
 */
export function suggestions(ix: GraphIndex, opts: { limit?: number; from?: string } = {}): Suggestion[] {
  const scores = new Map<string, Suggestion>();
  const sources = opts.from ? [opts.from] : Object.keys(ix.artists).filter((id) => inLibrary(ix, id));
  for (const src of sources) {
    const plays = ix.artists[src]?.plays ?? 0;
    for (const conn of ix.adj.get(src)?.values() ?? []) {
      if (conn.technical || inLibrary(ix, conn.id)) continue;
      const s = scores.get(conn.id) ?? { id: conn.id, score: 0, via: [] };
      const strength = KIND_WEIGHT[conn.kind] * (1 + Math.log2(1 + conn.albums.size));
      s.score += strength * Math.log2(2 + plays);
      s.via.push({ id: src, conn });
      scores.set(conn.id, s);
    }
  }
  const out = [...scores.values()];
  for (const s of out) {
    s.score *= 1 + 0.5 * (s.via.length - 1);
    s.via.sort((a, b) => (ix.artists[b.id]?.plays ?? 0) - (ix.artists[a.id]?.plays ?? 0));
  }
  return out.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 100);
}

/** Shortest path between two artists (BFS, non-technical edges). */
export function pathBetween(ix: GraphIndex, from: string, to: string, maxDepth = 4): string[] | null {
  if (from === to) return [from];
  const prev = new Map<string, string>([[from, from]]);
  let frontier = [from];
  for (let d = 0; d < maxDepth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const c of ix.adj.get(id)?.values() ?? []) {
        if (c.technical || prev.has(c.id)) continue;
        prev.set(c.id, id);
        if (c.id === to) {
          const path = [to];
          while (path[0] !== from) path.unshift(prev.get(path[0])!);
          return path;
        }
        next.push(c.id);
      }
    }
    frontier = next;
  }
  return null;
}
