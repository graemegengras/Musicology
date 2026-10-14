import { useEffect, useMemo, useState } from 'react';
import { normalize } from '../lib/mb';
import { searchArtists } from '../lib/mbLive';
import { href } from '../lib/router';
import type { StoreState } from '../lib/store';
import ArtistLink from './ArtistLink';

/** Search: artists already in the graph first, then anyone on MusicBrainz. */
export default function SearchView({ store, q }: { store: StoreState; q: string }) {
  const ix = store.index;
  const [remote, setRemote] = useState<Awaited<ReturnType<typeof searchArtists>> | null>(null);
  const [error, setError] = useState(false);

  const local = useMemo(() => {
    const term = normalize(q);
    if (!term) return [];
    return Object.entries(ix.artists)
      .filter(([, a]) => normalize(a.name).includes(term))
      .sort(([, a], [, b]) => Number(Boolean(b.lib)) - Number(Boolean(a.lib)) || (b.plays ?? 0) - (a.plays ?? 0))
      .slice(0, 30)
      .map(([id]) => id);
  }, [ix, q, store.version]);

  const libOnly = useMemo(
    () => (store.library?.artists ?? []).filter((a) => !store.resolved[a.name] && normalize(a.name).includes(normalize(q))).slice(0, 10),
    [store.library, store.resolved, q],
  );

  useEffect(() => {
    setRemote(null);
    setError(false);
    if (!q.trim()) return;
    let cancelled = false;
    searchArtists(q)
      .then((r) => !cancelled && setRemote(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [q]);

  const known = new Set(local);
  return (
    <div className="page search-page">
      <h1>Results for “{q}”</h1>
      {local.length > 0 && (
        <section>
          <h2 className="section-title">In your map</h2>
          <ul className="conn-list">
            {local.map((id) => (
              <li key={id}><ArtistLink ix={ix} id={id} detail={ix.artists[id].lib ? `${ix.artists[id].plays} plays` : undefined} /></li>
            ))}
          </ul>
        </section>
      )}
      {libOnly.length > 0 && (
        <p className="muted small">
          In your library but not matched on MusicBrainz yet: {libOnly.map((a) => a.name).join(', ')}. Pick the right one below.
        </p>
      )}
      <section>
        <h2 className="section-title">On MusicBrainz</h2>
        {error && <p className="muted">MusicBrainz search failed. Try again in a moment.</p>}
        {!remote && !error && <p className="muted">Searching…</p>}
        {remote && remote.length === 0 && <p className="muted">No artists found.</p>}
        <ul className="conn-list">
          {remote
            ?.filter((r) => !known.has(r.id))
            .map((r) => (
              <li key={r.id}>
                <a className="artist-link new" href={href({ view: 'artist', id: r.id })}>
                  <span className="lib-dot" aria-hidden="true" />
                  <span className="artist-link-text">
                    <span className="artist-link-name">{r.name}</span>
                    <span className="artist-link-detail">{[r.type, r.disambiguation].filter(Boolean).join(' · ')}</span>
                  </span>
                </a>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
