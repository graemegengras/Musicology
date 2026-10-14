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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { LibrarySummary } from '../src/lib/appleLibrary.ts';
import {
  MB_ROOT,
  albumFromGroup,
  albumOverlap,
  artistLinks,
  creditsFromReleases,
  nameMatches,
  normalizeTitle,
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
const OUT = new URL('public/data/', ROOT);
mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const UA = 'Musicology/0.1 (https://graemegengras.github.io/Musicology/)';
let last = 0;
let requests = 0;

async function mb<T>(path: string): Promise<T> {
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
        const text = await res.text();
        writeFileSync(file, text);
        return JSON.parse(text) as T;
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
  for (let offset = 0; offset < 400; offset += 100) {
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
const save = () => {
  writeFileSync(new URL('graph.json', OUT), JSON.stringify(graph));
  if (WITH_CREDITS) writeFileSync(new URL('credits.json', OUT), JSON.stringify(credits));
};

console.log(`Phase 1: ${targets.length} artists`);
for (const [i, lib] of targets.entries()) {
  const q = encodeURIComponent(`artist:"${lib.name.replace(/"/g, '')}"`);
  const search = await mb<{ artists?: MbArtist[] }>(`/artist?query=${q}&limit=8`);
  const candidates = nameMatches(search.artists ?? [], lib.name).slice(0, 3);
  if (!candidates.length) {
    graph.library[lib.name] = null;
    continue;
  }
  const titles = lib.albums.map((a) => a.title);
  let best = candidates[0];
  let bestGroups: MbReleaseGroup[] | null = null;
  let bestScore = -1;
  for (const c of candidates) {
    const groups = await allReleaseGroups(c.id);
    const score = albumOverlap(titles, groups);
    if (score > bestScore) [best, bestGroups, bestScore] = [c, groups, score];
    if (candidates.length === 1 || score >= Math.min(3, titles.length)) break;
  }
  // With several same-named artists and no album in common, we can't tell which one this is.
  if (candidates.length > 1 && bestScore === 0 && titles.length > 0) {
    graph.library[lib.name] = null;
    continue;
  }
  const full = await mb<MbArtist>(`/artist/${best.id}?inc=artist-rels+url-rels+genres`);
  const a = touch(best.id, full.name ?? best.name, full.type);
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
  graph.library[lib.name] = best.id;

  for (const l of artistLinks(full)) {
    touch(l.other.id, l.other.name, l.other.type);
    graph.links.push([best.id, l.other.id, l.kind, l.label, l.begin ?? null, l.end ?? null]);
  }

  const groups = bestGroups ?? (await allReleaseGroups(best.id));
  const albums = groups.filter((g) => g['primary-type'] === 'Album' || g['primary-type'] === 'EP');
  graph.discographies[best.id] = albums.map((g) => {
    const al = albumFromGroup(g);
    return [al.id, al.title, al.year ?? null, al.type, al.by.length > 1 || al.by[0]?.id !== best.id ? al.by.map((b) => b.name).join(', ') : null];
  });
  const byTitle = new Map(groups.map((g) => [normalizeTitle(g.title), g]));
  for (const la of lib.albums) {
    const g = byTitle.get(normalizeTitle(la.title));
    if (!g) continue;
    graph.libraryAlbums[g.id] = (graph.libraryAlbums[g.id] ?? 0) + la.plays;
    albumWork.push({ artistId: best.id, groupId: g.id, plays: la.plays });
  }
  if (i % 25 === 0) {
    save();
    console.log(`  ${i + 1}/${targets.length} ${lib.name} (${requests} requests)`);
  }
}
save();
const resolved = Object.values(graph.library).filter(Boolean).length;
console.log(`Resolved ${resolved}/${targets.length} artists, ${graph.links.length} links, ${albumWork.length} library albums matched`);

if (WITH_CREDITS) {
  // Most-played albums first, so an interrupted run still covers what matters.
  const seen = new Set<string>();
  const work = albumWork.sort((a, b) => b.plays - a.plays).filter((w) => !seen.has(w.groupId) && seen.add(w.groupId));
  console.log(`Phase 2: personnel for ${work.length} albums`);
  for (const [i, w] of work.entries()) {
    const page = await mb<{ releases?: MbRelease[] }>(
      `/release?release-group=${w.groupId}&inc=artist-rels+recordings+recording-level-rels+artist-credits&status=official&limit=25`,
    );
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
}
console.log(`Done. ${Object.keys(graph.artists).length} artists in graph, ${requests} network requests.`);
