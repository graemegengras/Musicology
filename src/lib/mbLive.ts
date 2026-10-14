/**
 * Live MusicBrainz lookups from the browser, for artists and albums outside the
 * prebuilt graph. One request per ~1.1 s (MusicBrainz's limit), cached per session.
 */
import type { CreditsData, DiscographyEntry, GraphArtist, GraphLink } from '../data/graphTypes';
import {
  MB_ROOT,
  albumFromGroup,
  artistLinks,
  creditsFromReleases,
  yearOf,
  type MbArtist,
  type MbRelease,
  type MbReleaseGroup,
} from './mb';

const memo = new Map<string, Promise<unknown>>();
let chain: Promise<unknown> = Promise.resolve();
let last = 0;

function get<T>(path: string): Promise<T> {
  const url = `${MB_ROOT}${path}${path.includes('?') ? '&' : '?'}fmt=json`;
  const hit = memo.get(url);
  if (hit) return hit as Promise<T>;
  const run = chain.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) return (await res.json()) as T;
      if (res.status !== 503 && res.status !== 429) throw new Error(`MusicBrainz ${res.status}`);
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    throw new Error('MusicBrainz is busy. Try again in a moment.');
  });
  // Keep the queue moving even if one request fails.
  chain = run.catch(() => undefined);
  memo.set(url, run);
  run.catch(() => memo.delete(url));
  return run;
}

export interface LiveArtist {
  id: string;
  artist: GraphArtist;
  links: GraphLink[];
  others: Record<string, GraphArtist>;
}

export async function fetchArtist(id: string): Promise<LiveArtist> {
  const a = await get<MbArtist & { genres?: { name: string; count: number }[] }>(
    `/artist/${id}?inc=artist-rels+url-rels+genres`,
  );
  const artist: GraphArtist = {
    name: a.name,
    type: a.type ?? undefined,
    area: a.area?.name,
    begin: yearOf(a['life-span']?.begin),
    end: yearOf(a['life-span']?.end),
    disambiguation: a.disambiguation || undefined,
    genres: (a.genres ?? [])
      .sort((x, y) => y.count - x.count)
      .slice(0, 4)
      .map((g) => g.name),
  };
  for (const r of a.relations ?? []) {
    const u = r.url?.resource;
    if (u?.includes('open.spotify.com/artist/')) artist.spotify = u.split('/artist/')[1]?.split(/[?/]/)[0];
    if (r.type === 'wikidata' && u) artist.wikidata = u.split('/').pop();
  }
  const others: Record<string, GraphArtist> = {};
  const links: GraphLink[] = artistLinks(a).map((l) => {
    others[l.other.id] = { name: l.other.name, type: l.other.type ?? undefined };
    return [id, l.other.id, l.kind, l.label, l.begin ?? null, l.end ?? null];
  });
  return { id, artist, links, others };
}

export async function fetchDiscography(id: string): Promise<DiscographyEntry[]> {
  const page = await get<{ 'release-groups'?: MbReleaseGroup[] }>(
    `/release-group?artist=${id}&type=album|ep&inc=artist-credits&limit=100`,
  );
  return (page['release-groups'] ?? []).map((g) => {
    const al = albumFromGroup(g);
    const solo = al.by.length === 1 && al.by[0].id === id;
    return [al.id, al.title, al.year ?? null, al.type, solo ? null : al.by.map((b) => b.name).join(', ')];
  });
}

export async function fetchCredits(
  releaseGroupId: string,
): Promise<{ list: CreditsData[string]; people: Record<string, GraphArtist> }> {
  const page = await get<{ releases?: MbRelease[] }>(
    `/release?release-group=${releaseGroupId}&inc=artist-rels+recordings+recording-level-rels+artist-credits&status=official&limit=25`,
  );
  const people: Record<string, GraphArtist> = {};
  const list = creditsFromReleases(page.releases ?? []).map((c): [string, string, number] => {
    people[c.artist.id] = { name: c.artist.name, type: c.artist.type ?? undefined };
    return [c.artist.id, c.roles.join(', '), c.tracks];
  });
  return { list, people };
}

export async function searchArtists(q: string): Promise<{ id: string; name: string; disambiguation?: string; type?: string }[]> {
  const page = await get<{ artists?: MbArtist[] }>(`/artist?query=${encodeURIComponent(q)}&limit=8`);
  return (page.artists ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    disambiguation: a.disambiguation || undefined,
    type: a.type ?? undefined,
  }));
}
