/**
 * MusicBrainz response shapes and the pure functions that turn them into
 * Musicology's graph pieces. Shared by scripts/build-graph.ts (Node) and the
 * browser's live lookups, so keep it free of imports and platform APIs.
 */

export const MB_ROOT = 'https://musicbrainz.org/ws/2';

export interface MbArtistRef {
  id: string;
  name: string;
  type?: string | null;
  disambiguation?: string;
}

export interface MbRelation {
  type: string;
  direction: 'forward' | 'backward';
  'target-type': string;
  attributes?: string[];
  begin?: string | null;
  end?: string | null;
  ended?: boolean;
  artist?: MbArtistRef;
  url?: { resource: string };
}

export interface MbArtist extends MbArtistRef {
  'sort-name'?: string;
  country?: string;
  area?: { name: string } | null;
  'begin-area'?: { name: string } | null;
  'life-span'?: { begin?: string | null; end?: string | null; ended?: boolean };
  aliases?: { name: string }[];
  relations?: MbRelation[];
  score?: number;
  tags?: { name: string; count: number }[];
}

export interface MbArtistCredit {
  name: string;
  joinphrase?: string;
  artist: MbArtistRef;
}

export interface MbReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string | null;
  'secondary-types'?: string[];
  'first-release-date'?: string;
  'artist-credit'?: MbArtistCredit[];
}

export interface MbRelease {
  id: string;
  title: string;
  date?: string;
  status?: string;
  relations?: MbRelation[];
  media?: {
    tracks?: {
      title: string;
      recording: { id: string; title: string; relations?: MbRelation[]; 'artist-credit'?: MbArtistCredit[] };
      'artist-credit'?: MbArtistCredit[];
    }[];
  }[];
}

// ───────────────────────── Names & titles ─────────────────────────

/** Loose key for comparing names and titles across sources. */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const EDITION =
  /\s*[([](?:[^)\]]*\b(?:deluxe|remaster(?:ed)?|expanded|edition|anniversary|bonus|version|reissue|mono|stereo|explicit|clean|special|collector'?s?|instrumentals?)\b[^)\]]*)[)\]]\s*/gi;

/** Album titles as streaming services mangle them: "Foo (Deluxe Edition) - EP" → "foo". */
export function normalizeTitle(title: string): string {
  return normalize(
    title
      .replace(EDITION, ' ')
      .replace(/\s+-\s+(?:EP|Single)$/i, '')
      .replace(/\s+-\s+.*\b(?:remaster(?:ed)?|edition|version)\b.*$/i, ''),
  );
}

export function yearOf(date?: string | null): number | undefined {
  const y = date ? Number(date.slice(0, 4)) : NaN;
  return Number.isFinite(y) && y > 0 ? y : undefined;
}

// ───────────────────────── Artist matching ─────────────────────────

/** Search candidates whose name (or an alias) matches the library name. */
export function nameMatches(candidates: MbArtist[], libraryName: string): MbArtist[] {
  const want = normalize(libraryName);
  return candidates.filter(
    (c) => (c.score ?? 100) >= 80 && (normalize(c.name) === want || c.aliases?.some((a) => normalize(a.name) === want)),
  );
}

/** How many of the library's album titles appear in this discography. */
export function albumOverlap(libraryAlbums: string[], groups: MbReleaseGroup[]): number {
  const titles = new Set(groups.map((g) => normalizeTitle(g.title)));
  return libraryAlbums.filter((t) => titles.has(normalizeTitle(t))).length;
}

// ───────────────────────── Graph pieces ─────────────────────────

export type EdgeKind = 'member' | 'collab' | 'support' | 'family' | 'credit' | 'feat';

export interface ArtistLink {
  /** The other artist. */
  other: MbArtistRef;
  kind: EdgeKind;
  /** Human label from this artist's point of view: "member of", "drums for", … */
  label: string;
  begin?: number;
  end?: number;
}

const FAMILY = new Set(['parent', 'sibling', 'married', 'involved with']);

/** Artist-to-artist relationships from an artist lookup (inc=artist-rels). */
export function artistLinks(artist: MbArtist): ArtistLink[] {
  const out: ArtistLink[] = [];
  for (const r of artist.relations ?? []) {
    if (r['target-type'] !== 'artist' || !r.artist) continue;
    const fwd = r.direction === 'forward';
    const attrs = (r.attributes ?? []).filter((a) => !['original', 'founder', 'additional', 'guest', 'minor'].includes(a));
    const begin = yearOf(r.begin);
    const end = yearOf(r.end);
    let kind: EdgeKind;
    let label: string;
    switch (r.type) {
      case 'member of band':
        kind = 'member';
        label = fwd ? 'member of' : 'member';
        if (attrs.length) label += ` (${attrs.join(', ')})`;
        break;
      case 'collaboration':
        kind = 'collab';
        label = fwd ? 'part of' : 'collaboration with';
        break;
      case 'instrumental supporting musician':
      case 'vocal supporting musician':
      case 'supporting musician':
        kind = 'support';
        label = fwd ? `${attrs.length ? attrs.join(', ') : 'played'} for` : `backed by${attrs.length ? ` (${attrs.join(', ')})` : ''}`;
        break;
      case 'is person':
        kind = 'collab';
        label = fwd ? 'also known as' : 'performs as';
        break;
      case 'teacher':
        kind = 'family';
        label = fwd ? 'teacher of' : 'student of';
        break;
      default:
        if (!FAMILY.has(r.type)) continue;
        kind = 'family';
        label = r.type === 'parent' ? (fwd ? 'parent of' : 'child of') : r.type;
    }
    out.push({ other: r.artist, kind, label, begin, end });
  }
  return out;
}

export interface Credit {
  artist: MbArtistRef;
  /** Role names, e.g. ["drums", "producer"]. */
  roles: string[];
  /** Number of tracks with this person (0 = album-wide credit). */
  tracks: number;
}

const ROLE_TYPES = new Set([
  'instrument',
  'vocal',
  'performer',
  'performing orchestra',
  'conductor',
  'producer',
  'programming',
  'instrument arranger',
  'vocal arranger',
  'arranger',
  'orchestrator',
  'mix',
  'recording',
  'engineer',
  'audio',
  'sound',
  'mastering',
  'remixer',
  'misc',
]);
const TECHNICAL = new Set(['mix', 'recording', 'engineer', 'audio', 'sound', 'mastering']);

function roleName(r: MbRelation): string | null {
  const raw = r.attributes ?? [];
  // Assistants and executive producers add noise without telling you who made the music.
  if (raw.includes('assistant') || raw.includes('executive')) return null;
  const attrs = raw.filter((a) => !['additional', 'guest', 'solo', 'co'].includes(a));
  switch (r.type) {
    case 'instrument':
      return attrs.join(', ') || 'instruments';
    case 'vocal':
      return attrs.join(', ') || 'vocals';
    case 'performer':
      return attrs.join(', ') || 'performer';
    case 'programming':
      return attrs.length ? `${attrs.join(', ')} programming` : 'programming';
    case 'instrument arranger':
      return attrs.length ? `${attrs.join(', ')} arrangement` : 'arrangement';
    case 'vocal arranger':
      return 'vocal arrangement';
    case 'performing orchestra':
      return 'orchestra';
    case 'audio':
    case 'sound':
    case 'engineer':
      return 'engineer';
    default:
      return r.type;
  }
}

export function isTechnicalRole(role: string): boolean {
  return TECHNICAL.has(role) || role === 'engineer';
}

/**
 * Personnel for a release group, merged across its releases
 * (browse /release?release-group=…&inc=artist-rels+recordings+recording-level-rels+artist-credits).
 * Different releases carry different credits, so take the union.
 */
export function creditsFromReleases(releases: MbRelease[]): Credit[] {
  const byArtist = new Map<string, { artist: MbArtistRef; roles: Set<string>; tracks: Set<string> }>();
  const add = (artist: MbArtistRef, role: string | null, trackKey?: string) => {
    if (!role) return;
    const e = byArtist.get(artist.id) ?? { artist, roles: new Set(), tracks: new Set() };
    e.roles.add(role);
    if (trackKey) e.tracks.add(trackKey);
    byArtist.set(artist.id, e);
  };
  for (const rel of releases) {
    for (const r of rel.relations ?? []) {
      if (r['target-type'] === 'artist' && r.artist && ROLE_TYPES.has(r.type)) add(r.artist, roleName(r));
    }
    for (const m of rel.media ?? []) {
      for (const t of m.tracks ?? []) {
        const key = normalize(t.recording.title || t.title);
        for (const r of t.recording.relations ?? []) {
          if (r['target-type'] === 'artist' && r.artist && ROLE_TYPES.has(r.type)) add(r.artist, roleName(r), key);
        }
        // Featured artists on individual tracks.
        const ac = t.recording['artist-credit'] ?? t['artist-credit'] ?? [];
        ac.slice(1).forEach((c) => add(c.artist, 'featured', key));
      }
    }
  }
  return [...byArtist.values()]
    .map((e) => ({ artist: e.artist, roles: [...e.roles], tracks: e.tracks.size }))
    .sort((a, b) => b.tracks - a.tracks || a.artist.name.localeCompare(b.artist.name));
}

export interface Album {
  id: string;
  title: string;
  year?: number;
  type: string;
  /** Credited artists (the "by" line). */
  by: MbArtistRef[];
}

/** Studio albums and EPs first-class; compilations, live, etc. flagged in type. */
export function albumFromGroup(g: MbReleaseGroup): Album {
  const secondary = g['secondary-types'] ?? [];
  const primary = g['primary-type'] ?? 'Other';
  return {
    id: g.id,
    title: g.title,
    year: yearOf(g['first-release-date']),
    type: secondary.length ? secondary.join(' · ') : primary,
    by: (g['artist-credit'] ?? []).map((c) => c.artist),
  };
}

export const coverUrl = (releaseGroupId: string, size: 250 | 500 = 250) =>
  `https://coverartarchive.org/release-group/${releaseGroupId}/front-${size}`;
