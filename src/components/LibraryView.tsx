import { useMemo, useState } from 'react';
import { suggestions } from '../lib/graph';
import { normalize } from '../lib/mb';
import { href } from '../lib/router';
import type { StoreState } from '../lib/store';
import ArtistLink from './ArtistLink';

const PAGE = 120;

/** Home: your artists, most played first, with the closest new artists as a way out. */
export default function LibraryView({ store }: { store: StoreState }) {
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const lib = store.library;
  const ix = store.index;

  const genres = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of lib?.artists ?? []) for (const g of a.genres.slice(0, 1)) counts.set(g, (counts.get(g) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([g]) => g);
  }, [lib]);

  const rows = useMemo(() => {
    const term = normalize(q);
    return (lib?.artists ?? []).filter(
      (a) => a.tracks > 0 && (!term || normalize(a.name).includes(term)) && (!genre || a.genres.includes(genre)),
    );
  }, [lib, q, genre]);

  const picks = useMemo(() => suggestions(ix, { limit: 6 }), [ix, store.version]);

  if (store.status === 'loading') return <p className="page muted">Loading your library…</p>;
  if (!lib) return <p className="page">Your library couldn’t be loaded.</p>;

  const resolved = Object.values(store.resolved).filter(Boolean).length;

  return (
    <div className="page library">
      <header className="lib-head">
        <h1>Your library</h1>
        <p className="meta">
          {lib.artists.filter((a) => a.tracks > 0).length.toLocaleString()} artists · {lib.trackCount.toLocaleString()} tracks
          {lib.exportedAt && ` · exported ${lib.exportedAt}`}
          {resolved > 0 && ` · ${resolved} mapped on MusicBrainz`}
        </p>
      </header>

      {picks.length > 0 && (
        <section className="picks">
          <div className="section-head">
            <h2 className="section-title">One step from what you play</h2>
            <a href={href({ view: 'discover' })}>See all →</a>
          </div>
          <ul className="pick-grid">
            {picks.map((s) => (
              <li key={s.id} className="pick">
                <ArtistLink ix={ix} id={s.id} />
                <p className="muted small">
                  via {s.via.slice(0, 3).map((v) => ix.artists[v.id]?.name).join(', ')}
                  {s.via.length > 3 ? ` +${s.via.length - 3}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="lib-tools">
        <input
          id="library-filter"
          type="search"
          placeholder="Filter your artists…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
          aria-label="Filter your artists"
        />
        <ul className="chips">
          {genres.map((g) => (
            <li key={g}>
              <button className={`chip ${genre === g ? 'on' : ''}`} onClick={() => { setGenre(genre === g ? null : g); setLimit(PAGE); }}>
                {g}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <ol className="lib-list">
        {rows.slice(0, limit).map((a, i) => {
          const id = store.resolved[a.name];
          const conns = id ? ix.adj.get(id)?.size ?? 0 : 0;
          const target = id ? href({ view: 'artist', id }) : href({ view: 'search', q: a.name });
          return (
            <li key={a.name}>
              <a className="lib-row" href={target}>
                <span className="rank">{i + 1}</span>
                <span className="lib-name">{a.name}</span>
                <span className="lib-genre muted">{a.genres[0] ?? ''}</span>
                <span className="lib-num">{a.plays.toLocaleString()} <span className="muted">plays</span></span>
                <span className="lib-num">{a.albums.length} <span className="muted">{a.albums.length === 1 ? 'album' : 'albums'}</span></span>
                <span className="lib-num">{id ? <>{conns} <span className="muted">links</span></> : <span className="muted">look up</span>}</span>
              </a>
            </li>
          );
        })}
      </ol>
      {rows.length > limit && (
        <button className="btn more" onClick={() => setLimit(limit + PAGE)}>
          Show more ({(rows.length - limit).toLocaleString()} left)
        </button>
      )}
    </div>
  );
}
