/**
 * Builds the connection graph for the library's most-played artists from MusicBrainz.
 *
 *   npm run build-graph -- [--top 600] [--credits]
 *
 * Phase 1 (always): resolve each library artist to a MusicBrainz artist, fetch its
 * relationships and discography. Phase 2 (--credits): personnel for each album in
 * the library. Responses are cached in .mbcache/, so re-runs are cheap and an
 * interrupted run resumes where it stopped. Writes public/data/graph.json and
 * public/data/credits.json.
 */
import { createHash } from 'node:crypto';
import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { LibrarySummary } from '../src/lib/appleLibrary.ts';
import {
  MB_ROOT,
  albumFromGroup,
  albumOverlap,
  artistLinks,
  creditsFromReleases,
  matchAlbums,
  nameMatches,
  normalize,
  splitArtistNames,
  yearOf,
  type MbArtist,
  type MbRelease,
  type MbReleaseGroup,
} from '../src/lib/mb.ts';
import type { GraphArtist, GraphData, CreditsData } from '../src/data/graphTypes.ts';

const args = process.argv.slice(2);
const TOP = Number(args[args.indexOf('--top') + 1]) || 600;
const WITH_CREDITS = args.includes('--credits');
const ROOT = new URL('..', import.meta.url);
const CACHE = new URL('.mbcache/', ROOT);
// Periodic saves go to a gitignored staging dir; only a completed run publishes to --out.
const OUT = args.includes('--out')
  ? pathToFileURL(resolvePath(args[args.indexOf('--out') + 1]) + '/')
  : new URL('public/data/', ROOT);
const STAGE = new URL('out/', CACHE);
mkdirSync(CACHE, { recursive: true });
mkdirSync(STAGE, { recursive: true });

/** Keep only what creditsFromReleases reads: release-browse pages can be ~1 MB each. */
const slimReleases = (page: { releases?: any[]; 'release-count'?: number }) => {
  const rel = (r: any) => (r['target-type'] === 'artist' ? { type: r.type, direction: r.direction, 'target-type': r['target-type'], attributes: r.attributes?.length ? r.attributes : undefined, artist: ref(r.artist) } : null);
  const ref = (a: any) => a && { id: a.id, name: a.name, type: a.type ?? undefined };
  const ac = (list: any[] | undefined) => list?.map((c) => ({ name: c.name, joinphrase: c.joinphrase || undefined, artist: ref(c.artist) }));
  return {
    'release-count': page['release-count'],
    releases: (page.releases ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      'artist-credit': ac(r['artist-credit']),
      relations: (r.relations ?? []).map(rel).filter(Boolean),
      media: (r.media ?? []).map((m: any) => ({
        tracks: (m.tracks ?? []).map((t: any) => ({
          title: t.title,
          recording: {
            id: t.recording?.id,
            title: t.recording?.title,
            relations: (t.recording?.relations ?? []).map(rel).filter(Boolean),
            'artist-credit': ac(t.recording?.['artist-credit']),
          },
          'artist-credit': ac(t['artist-credit']),
        })),
      })),
    })),
  };
};

const UA = 'Musicology/0.1 (https://graemegengras.github.io/Musicology/)';
let last = 0;
let requests = 0;

async function mb<T>(path: string, slim?: (json: any) => unknown): Promise<T> {
  const url = `${MB_ROOT}${path}${path.includes('?') ? '&' : '?'}fmt=json`;
  const file = new URL(createHash('sha1').update(url).digest('hex') + '.json', CACHE);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')) as T;
  for (let attempt = 0; ; attempt++) {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    requests++;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (res.ok) {
        let json = await res.json();
        if (slim) json = slim(json);
        writeFileSync(file, JSON.stringify(json));
        return json as T;
      }
      if (res.status === 404) {
        writeFileSync(file, '{}');
        return {} as T;
      }
      if (attempt >= 5) throw new Error(`${res.status} for ${url}`);
    } catch (e) {
      if (attempt >= 5) throw e;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

async function allReleaseGroups(artistId: string): Promise<MbReleaseGroup[]> {
  const out: MbReleaseGroup[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await mb<{ 'release-groups'?: MbReleaseGroup[]; 'release-group-count'?: number }>(
      `/release-group?artist=${artistId}&inc=artist-credits&limit=100&offset=${offset}`,
    );
    out.push(...(page['release-groups'] ?? []));
    if (out.length >= (page['release-group-count'] ?? 0)) break;
  }
  return out;
}

const library = JSON.parse(readFileSync(new URL('src/data/library.json', ROOT), 'utf8')) as LibrarySummary;
const targets = library.artists.filter((a) => a.tracks > 0).slice(0, TOP);

const graph: GraphData = { builtAt: new Date().toISOString().slice(0, 10), library: {}, artists: {}, links: [], discographies: {}, libraryAlbums: {} };
const credits: CreditsData = {};

const touch = (id: string, name: string, type?: string | null): GraphArtist => {
  const a = (graph.artists[id] ??= { name });
  if (type && !a.type) a.type = type;
  return a;
};

const albumWork: { artistId: string; groupId: string; plays: number }[] = [];
const save = (dir: URL = STAGE) => {
  writeFileSync(new URL('graph.json', dir), JSON.stringify(graph));
  if (WITH_CREDITS) writeFileSync(new URL('credits.json', dir), JSON.stringify(credits));
};

interface Resolution {
  artist: MbArtist;
  groups: MbReleaseGroup[];
  score: number;
}

/** Find the MusicBrainz artist for a library name, using album overlap to pick among namesakes. */
async function resolve(name: string, titles: string[]): Promise<Resolution | null> {
  const clean = name.replace(/["\\]/g, '');
  const queries = [`artist:"${clean}"`];
  // "The Red Hot Chili Peppers": the phrase search misses "Red Hot Chili Peppers".
  if (/^the\s/i.test(clean)) queries.push(`artist:"${clean.replace(/^the\s+/i, '')}"`);
  // "Mos Def" is Yasiin Bey; the artist field doesn't search aliases.
  queries.push(`alias:"${clean}"`);
  const tried = new Set<string>();
  for (const query of queries) {
    const search = await mb<{ artists?: MbArtist[] }>(`/artist?query=${encodeURIComponent(query)}&limit=15`);
    const candidates = nameMatches(search.artists ?? [], name).filter((c) => !tried.has(c.id)).slice(0, 5);
    if (!candidates.length) continue;
    let best: Resolution | null = null;
    for (const c of candidates) {
      tried.add(c.id);
      const groups = await allReleaseGroups(c.id);
      const score = albumOverlap(titles, groups, name);
      if (!best || score > best.score) best = { artist: c, groups, score };
      if (candidates.length === 1 || score >= Math.min(3, titles.length)) break;
    }
    // With several same-named artists and no album in common, we can't tell which one this is.
    // Alias hits are looser, so they always need an album in common.
    if ((candidates.length > 1 || query.startsWith('alias:')) && best!.score === 0 && titles.length > 0) continue;
    return best;
  }
  return null;
}

const linkSeen = new Set<string>();
let phase1Requests = 0;

console.log(`Phase 1: ${targets.length} artists`);
for (const [i, lib] of targets.entries()) {
  const titles = lib.albums.map((a) => a.title);
  let found = await resolve(lib.name, titles);
  // "Freddie Gibbs & Madlib": no such artist, but each part's discography holds the joint albums.
  if (!found) {
    for (const part of splitArtistNames(lib.name)) {
      const r = await resolve(part, titles);
      if (r && (!found || r.score > found.score)) found = r;
    }
    if (found && found.score === 0) found = null;
  }
  if (!found) {
    graph.library[lib.name] = null;
    continue;
  }
  const { artist: best, groups } = found;
  graph.library[lib.name] = best.id;
  const known = graph.artists[best.id]?.plays !== undefined;
  const full = await mb<MbArtist>(`/artist/${best.id}?inc=artist-rels+url-rels+genres`);
  const a = touch(best.id, full.name ?? best.name, full.type);
  if (known) {
    // A second library name for the same artist ("Mndsgn." / "Mndsgn", or a joint billing).
    a.plays = (a.plays ?? 0) + lib.plays;
  } else {
    a.lib = lib.name;
    a.plays = lib.plays;
    a.area = full.area?.name ?? undefined;
    a.begin = yearOf(full['life-span']?.begin);
    a.end = yearOf(full['life-span']?.end);
    a.disambiguation = full.disambiguation || undefined;
    const genres = ((full as MbArtist & { genres?: { name: string; count: number }[] }).genres ?? [])
      .sort((x, y) => y.count - x.count)
      .slice(0, 4)
      .map((g) => g.name);
    if (genres.length) a.genres = genres;
    for (const r of full.relations ?? []) {
      const u = r.url?.resource;
      if (!u) continue;
      if (r.type === 'wikidata') a.wikidata = u.split('/').pop();
      if (u.includes('open.spotify.com/artist/')) a.spotify = u.split('/artist/')[1]?.split(/[?/]/)[0];
    }
    for (const l of artistLinks(full)) {
      // Both ends of a relationship list it; keep the first copy.
      const pair = (x: string, y: string) => `${x}|${y}|${l.kind}|${l.begin ?? ''}`;
      if (linkSeen.has(pair(l.other.id, best.id)) || linkSeen.has(`${pair(best.id, l.other.id)}|${l.label}`)) continue;
      linkSeen.add(pair(best.id, l.other.id));
      linkSeen.add(`${pair(best.id, l.other.id)}|${l.label}`);
      touch(l.other.id, l.other.name, l.other.type);
      graph.links.push([best.id, l.other.id, l.kind, l.label, l.begin ?? null, l.end ?? null]);
    }
    const albums = groups.filter((g) => g['primary-type'] === 'Album' || g['primary-type'] === 'EP');
    graph.discographies[best.id] = albums.map((g) => {
      const al = albumFromGroup(g);
      return [al.id, al.title, al.year ?? null, al.type, al.by.length > 1 || al.by[0]?.id !== best.id ? al.by.map((b) => b.name).join(', ') : null];
    });
  }
  const matched = matchAlbums(titles, groups, best.name);
  // Albums billed to the artist's own band ("Miles Smiles" is by the Miles Davis Quintet).
  const left = () => titles.filter((t) => !matched.has(t));
  if (left().length) {
    const own = artistLinks(full)
      .filter((l) => l.kind === 'member' && l.label.startsWith('member of') && normalize(l.other.name).includes(normalize(best.name)))
      .slice(0, 4);
    for (const band of own) {
      if (!left().length) break;
      for (const [t, g] of matchAlbums(left(), await allReleaseGroups(band.other.id), band.other.name)) matched.set(t, g);
    }
  }
  // Library singles and band albums aren't in the artist's album list yet; add them so they can be shown.
  const disc = (graph.discographies[best.id] ??= []);
  const inDisc = new Set(disc.map((d) => d[0]));
  for (const g of new Set(matched.values())) {
    if (inDisc.has(g.id)) continue;
    const al = albumFromGroup(g);
    disc.push([al.id, al.title, al.year ?? null, al.type, al.by.length > 1 || al.by[0]?.id !== best.id ? al.by.map((b) => b.name).join(', ') : null]);
    inDisc.add(g.id);
  }
  for (const la of lib.albums) {
    const g = matched.get(la.title);
    if (!g) continue;
    graph.libraryAlbums[g.id] = (graph.libraryAlbums[g.id] ?? 0) + la.plays;
    albumWork.push({ artistId: best.id, groupId: g.id, plays: la.plays });
  }
  if (i % 25 === 0) {
    save();
    console.log(`  ${i + 1}/${targets.length} ${lib.name} (${requests} requests)`);
  }
}
phase1Requests = requests;
save();
const resolved = Object.values(graph.library).filter(Boolean).length;
console.log(`Resolved ${resolved}/${targets.length} artists, ${graph.links.length} links, ${albumWork.length} library albums matched (of ${targets.reduce((s, t) => s + t.albums.length, 0)}), ${phase1Requests} requests`);

if (WITH_CREDITS) {
  // Most-played albums first, so an interrupted run still covers what matters.
  const seen = new Set<string>();
  const work = albumWork.sort((a, b) => b.plays - a.plays).filter((w) => !seen.has(w.groupId) && seen.add(w.groupId));
  console.log(`Phase 2: personnel for ${work.length} albums`);
  for (const [i, w] of work.entries()) {
    const inc = 'inc=artist-rels+recordings+recording-level-rels+artist-credits';
    let page = await mb<{ releases?: MbRelease[] }>(`/release?release-group=${w.groupId}&${inc}&status=official&limit=25`, slimReleases);
    // Self-released and promo-only records have no "official" release.
    if (!page.releases?.length) page = await mb<{ releases?: MbRelease[] }>(`/release?release-group=${w.groupId}&${inc}&limit=25`, slimReleases);
    const list = creditsFromReleases(page.releases ?? []);
    credits[w.groupId] = list.map((c) => {
      touch(c.artist.id, c.artist.name, c.artist.type);
      return [c.artist.id, c.roles.join(', '), c.tracks];
    });
    if (i % 50 === 0) {
      save();
      console.log(`  ${i + 1}/${work.length} (${requests} requests)`);
    }
  }
  save();
  const withCredits = Object.values(credits).filter((c) => c.length).length;
  console.log(`Credits for ${withCredits}/${work.length} albums, ${requests - phase1Requests} requests`);
}
mkdirSync(OUT, { recursive: true });
save(OUT);
console.log(`Wrote ${OUT.pathname}graph.json${WITH_CREDITS ? ' and credits.json' : ''}`);
console.log(`Done. ${Object.keys(graph.artists).length} artists in graph, ${requests} network requests.`);
