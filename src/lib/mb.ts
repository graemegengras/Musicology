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
  'artist-credit'?: MbArtistCredit[];
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
  /\s*[([](?:[^)\]]*\b(?:deluxe|remaster(?:ed)?|expanded|edition|anniversary|bonus|version|reissue|mono|stereo|explicit|clean|special|collector'?s?|instrumentals?|feat\.?|featuring)\b[^)\]]*)[)\]]\s*/gi;

/**
 * Album titles as streaming services mangle them: "Foo (Deluxe Edition) - EP" → "foo".
 * Also folds "Volume"/"Vol." and "Part"/"Pt."/"Prt." and drops a trailing "EP"/"LP" word.
 */
export function normalizeTitle(title: string): string {
  return normalize(
    title
      .replace(/∆/g, 'a')
      .replace(EDITION, ' ')
      .replace(/\s+-\s+(?:EP|Single)$/i, '')
      .replace(/\s+-\s+.*\b(?:remaster(?:ed)?|edition|version)\b.*$/i, ''),
  )
    .replace(/\bvolume\b/g, 'vol')
    .replace(/\b(?:part|prt)\b/g, 'pt')
    .replace(/\s+(?:ep|lp)$/, '');
}

/**
 * Looser key for a second matching pass: drops every bracketed part and any " - …" or ": …"
 * subtitle, and ignores spacing ("HexualSealings" = "Hexual Sealings").
 */
export function looseTitle(title: string): string {
  const stripped = title
    .replace(/\s*[([][^)\]]*[)\]]\s*/g, ' ')
    .replace(/\s+[-–—:]\s+.*$/, '')
    .replace(/:\s.*$/, '');
  return (normalizeTitle(stripped) || normalizeTitle(title)).replace(/\s+/g, '');
}

const TYPE_RANK: Record<string, number> = { Album: 0, EP: 1, Single: 2 };
const groupRank = (g: MbReleaseGroup) =>
  (TYPE_RANK[g['primary-type'] ?? ''] ?? 3) * 10 + (g['secondary-types']?.length ? 5 : 0);

/**
 * Pair library album titles with release groups: exact normalized title first, then the
 * loose key. When several groups share a title (album + single of the same name, or a
 * compilation), prefer the studio album, then EP, then single, then the earliest.
 */
export function matchAlbums(libraryAlbums: string[], groups: MbReleaseGroup[]): Map<string, MbReleaseGroup> {
  const ordered = [...groups].sort(
    (a, b) => groupRank(a) - groupRank(b) || (a['first-release-date'] || '9999').localeCompare(b['first-release-date'] || '9999'),
  );
  const strict = new Map<string, MbReleaseGroup>();
  const loose = new Map<string, MbReleaseGroup>();
  for (const g of ordered) {
    const k = normalizeTitle(g.title);
    if (k && !strict.has(k)) strict.set(k, g);
    const l = looseTitle(g.title);
    if (l && !loose.has(l)) loose.set(l, g);
  }
  const out = new Map<string, MbReleaseGroup>();
  for (const t of libraryAlbums) {
    const g = strict.get(normalizeTitle(t)) ?? (looseTitle(t).length >= 3 ? loose.get(looseTitle(t)) : undefined);
    if (g) out.set(t, g);
  }
  return out;
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
  return matchAlbums(libraryAlbums, groups).size;
}

/**
 * Parts of a library name that credits several artists ("Freddie Gibbs & Madlib",
 * "João Gilberto; Stan Getz"). Only for names that didn't resolve as a whole, since
 * plenty of real band names contain "&" or commas.
 */
export function splitArtistNames(name: string): string[] {
  const parts = name
    .split(/\s*(?:;|,|\s&\s|\sand\s|\sx\s|\swith\s|\sfeat\.?\s|\sft\.?\s|\s\+\s)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : [];
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
    const attrs = (r.attributes ?? [])
      .filter((a) => !['original', 'founder', 'additional', 'guest', 'minor', 'eponymous'].includes(a))
      .map(prettyInstrument);
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
        // forward: the person performs as the target name; backward: this is a stage name of the target.
        label = fwd ? 'performs as' : 'also known as';
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
]);
/** Role names (as produced by creditsFromReleases) that are studio work rather than music-making. */
const TECHNICAL = new Set(['mixing', 'recording', 'engineer', 'mastering', 'mix', 'sound', 'audio']);

const INSTRUMENT_NAMES: Record<string, string> = {
  'drums (drum set)': 'drums',
  membranophone: 'drums',
  'electric bass guitar': 'bass',
  'bass guitar': 'bass',
  'electric guitar': 'guitar',
  keyboard: 'keyboards',
  'other vocals': 'vocals',
  'Wurlitzer electric piano': 'Wurlitzer',
  'Fender Rhodes': 'Rhodes',
  'Rhodes piano': 'Rhodes',
};

/** MusicBrainz instrument names as people say them: "drums (drum set)" → "drums". */
export function prettyInstrument(name: string): string {
  return INSTRUMENT_NAMES[name] ?? name;
}

function roleName(r: MbRelation): string | null {
  const raw = r.attributes ?? [];
  // Assistants and executive producers add noise without telling you who made the music.
  if (raw.includes('assistant') || raw.includes('executive')) return null;
  const attrs = [...new Set(raw.filter((a) => !['additional', 'guest', 'solo', 'co', 'task'].includes(a)).map(prettyInstrument))];
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
    case 'arranger':
      return 'arrangement';
    case 'performing orchestra':
      return 'orchestra';
    case 'mix':
      return 'mixing';
    case 'audio':
    case 'sound':
    case 'engineer':
      return 'engineer';
    default:
      return r.type;
  }
}

export function isTechnicalRole(role: string): boolean {
  return TECHNICAL.has(role);
}

const FEAT_JOIN = /\b(?:feat|ft|featuring|with)\b/i;

/**
 * Personnel for a release group, merged across its releases
 * (browse /release?release-group=…&inc=artist-rels+recordings+recording-level-rels+artist-credits).
 * Different releases carry different credits, so take the union. Track artists who aren't
 * the album's own credited artists count as "featured".
 */
export function creditsFromReleases(releases: MbRelease[]): Credit[] {
  const byArtist = new Map<string, { artist: MbArtistRef; roles: Set<string>; tracks: Set<string> }>();
  const add = (artist: MbArtistRef, role: string | null, trackKey?: string) => {
    if (!role) return;
    const e = byArtist.get(artist.id) ?? { artist, roles: new Set(), tracks: new Set() };
    for (const r of role.split(', ')) e.roles.add(r);
    if (trackKey) e.tracks.add(trackKey);
    byArtist.set(artist.id, e);
  };
  const rel = (r: MbRelation) => r['target-type'] === 'artist' && r.artist && ROLE_TYPES.has(r.type);
  for (const release of releases) {
    const albumArtists = new Set((release['artist-credit'] ?? []).map((c) => c.artist.id));
    for (const r of release.relations ?? []) if (rel(r)) add(r.artist!, roleName(r));
    for (const m of release.media ?? []) {
      for (const t of m.tracks ?? []) {
        const key = normalize(t.recording.title || t.title);
        for (const r of t.recording.relations ?? []) if (rel(r)) add(r.artist!, roleName(r), key);
        const ac = t.recording['artist-credit'] ?? t['artist-credit'] ?? [];
        ac.forEach((c, i) => {
          if (albumArtists.has(c.artist.id) || (i === 0 && !albumArtists.size)) return;
          add(c.artist, i > 0 && FEAT_JOIN.test(ac[i - 1].joinphrase ?? '') ? 'featured' : 'track artist', key);
        });
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
