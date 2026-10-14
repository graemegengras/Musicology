/**
 * App-wide data store: the prebuilt graph, the library, and live additions.
 * Components read it through useStore(); live fetches bump `version` so
 * everything re-renders with the bigger graph.
 */
import { useSyncExternalStore } from 'react';
import type { CreditsData, GraphData } from '../data/graphTypes';
import type { LibrarySummary } from './appleLibrary';
import { addArtist, addCredits, addDiscography, addLinks, buildIndex, emptyIndex, type GraphIndex } from './graph';
import { normalize } from './mb';
import { fetchArtist, fetchCredits, fetchDiscography } from './mbLive';

export interface StoreState {
  status: 'loading' | 'ready' | 'error';
  error?: string;
  index: GraphIndex;
  library: LibrarySummary | null;
  /** Library artist name → MusicBrainz id (null = couldn't be matched). */
  resolved: Record<string, string | null>;
  builtAt?: string;
  /** Ids/albums currently being fetched live. */
  pending: Set<string>;
  failed: Set<string>;
  version: number;
}

let state: StoreState = {
  status: 'loading',
  index: emptyIndex(),
  library: null,
  resolved: {},
  pending: new Set(),
  failed: new Set(),
  version: 0,
};
const listeners = new Set<() => void>();
const emit = (patch: Partial<StoreState> = {}) => {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
};

export function useStore(): StoreState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

async function json<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

let started = false;
export function loadData() {
  if (started) return;
  started = true;
  const base = import.meta.env.BASE_URL;
  Promise.all([
    json<GraphData>(`${base}data/graph.json`),
    import('../data/library.json').then((m) => m.default as unknown as LibrarySummary),
  ])
    .then(([graph, library]) => {
      const featured: [string, string][] = [];
      for (const a of library.artists) for (const f of a.featured) if (a.name < f) featured.push([a.name, f]);
      const index = graph ? buildIndex(graph, {}, featured) : emptyIndex();
      markLibraryByName(index, library, graph?.library ?? {});
      emit({ status: 'ready', index, library, resolved: graph?.library ?? {}, builtAt: graph?.builtAt });
      // Personnel is the biggest file; load it after first paint.
      json<CreditsData>(`${base}data/credits.json`).then((credits) => {
        if (!credits) return;
        for (const [album, list] of Object.entries(credits)) addCredits(state.index, album, list);
        emit();
      });
    })
    .catch((e: unknown) => emit({ status: 'error', error: e instanceof Error ? e.message : String(e) }));
}

/**
 * Artists who are in the library but weren't matched by the graph build (or only
 * appear as someone's credit) still count as yours if the name matches exactly.
 */
function markLibraryByName(ix: GraphIndex, library: LibrarySummary, resolved: Record<string, string | null>) {
  const taken = new Set(Object.values(resolved).filter(Boolean));
  const byName = new Map(library.artists.filter((a) => a.tracks > 0).map((a) => [normalize(a.name), a]));
  for (const [id, a] of Object.entries(ix.artists)) {
    if (a.lib || taken.has(id)) continue;
    const hit = byName.get(normalize(a.name));
    if (hit && resolved[hit.name] == null) {
      a.lib = hit.name;
      a.plays = hit.plays;
    }
  }
}

function track(key: string, job: () => Promise<void>) {
  if (state.pending.has(key) || state.failed.has(key)) return;
  state.pending.add(key);
  emit();
  job()
    .catch(() => state.failed.add(key))
    .finally(() => {
      state.pending.delete(key);
      if (state.library) markLibraryByName(state.index, state.library, state.resolved);
      emit();
    });
}

/** Fetch relationships and discography for an artist that isn't fully in the prebuilt graph. */
export function ensureArtist(id: string) {
  const ix = state.index;
  const known = ix.discographies[id] !== undefined;
  if (known) return;
  track(id, async () => {
    const live = await fetchArtist(id);
    for (const [oid, a] of Object.entries(live.others)) if (!ix.artists[oid]) addArtist(ix, oid, a);
    addArtist(ix, id, live.artist);
    addLinks(ix, live.links);
    addDiscography(ix, id, await fetchDiscography(id));
  });
}

export function ensureCredits(albumId: string) {
  if (state.index.credits[albumId]) return;
  track(`credits:${albumId}`, async () => {
    const { list, people } = await fetchCredits(albumId);
    for (const [pid, a] of Object.entries(people)) if (!state.index.artists[pid]) addArtist(state.index, pid, a);
    addCredits(state.index, albumId, list);
  });
}

export function retry(key: string) {
  state.failed.delete(key);
}
