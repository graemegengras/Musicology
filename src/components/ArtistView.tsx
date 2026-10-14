import { useEffect, useMemo, useState } from 'react';
import type { DiscographyEntry } from '../data/graphTypes';
import { KIND_LABEL, connectionsOf, suggestions, type Connection } from '../lib/graph';
import { spotifySearchUrl, youtubeSearchUrl } from '../lib/links';
import type { EdgeKind } from '../lib/mb';
import { href, replace } from '../lib/router';
import { ensureArtist, ensureCredits, retry, type StoreState } from '../lib/store';
import type { NowPlaying } from '../App';
import ArtistLink from './ArtistLink';
import AlbumCredits from './AlbumCredits';
import Constellation from './Constellation';
import Cover from './Cover';

interface Props {
  store: StoreState;
  id: string;
  album?: string;
  trail: string[];
  onPlay: (p: NowPlaying) => void;
}

type DiscoFilter = 'albums' | 'eps' | 'other' | 'all';

const isStudio = (type: string) => type === 'Album';

export default function ArtistView({ store, id, album, trail, onPlay }: Props) {
  const ix = store.index;
  const a = ix.artists[id];
  const loading = store.pending.has(id);
  const failed = store.failed.has(id);

  useEffect(() => {
    if (store.status === 'ready') ensureArtist(id);
  }, [id, store.status]);

  useEffect(() => {
    if (album) ensureCredits(album);
  }, [album]);

  const connections = useMemo(() => connectionsOf(ix, id), [ix, id, store.version]);
  const disco = ix.discographies[id] ?? [];

  // New artists one step from here, ranked by how many of *your* artists they also touch.
  const nextStops = useMemo(() => {
    const global = new Map(suggestions(ix, { limit: 2000 }).map((s) => [s.id, s]));
    return connections
      .filter((c) => !ix.artists[c.id]?.lib)
      .map((c) => ({ c, s: global.get(c.id) }))
      .sort((x, y) => (y.s?.via.length ?? 0) - (x.s?.via.length ?? 0) || (y.s?.score ?? 0) - (x.s?.score ?? 0))
      .slice(0, 8);
  }, [connections, ix]);

  if (store.status !== 'ready') return <p className="page muted">Loading your library…</p>;
  if (!a && loading) return <p className="page muted">Looking up this artist on MusicBrainz…</p>;
  if (!a)
    return (
      <div className="page">
        <p>We couldn’t load this artist.</p>
        <button className="btn" onClick={() => { retry(id); ensureArtist(id); }}>Try again</button>
      </div>
    );

  const years = a.begin ? `${a.begin}${a.end ? `–${a.end}` : a.type === 'Person' ? '' : '–present'}` : '';
  const facts = [a.type === 'Group' ? 'Band' : a.type, a.area, years].filter(Boolean).join(' · ');
  const playable = a.spotify ? { kind: 'artist' as const, id: a.spotify } : null;

  return (
    <div className="page artist-page">
      {trail.length > 1 && <Trail ids={trail} store={store} />}

      <header className="artist-head">
        <div>
          <p className={`eyebrow ${a.lib ? 'mine' : 'new'}`}>
            {a.lib ? `In your library · ${a.plays?.toLocaleString()} plays` : 'New to you'}
          </p>
          <h1>{a.name}</h1>
          <p className="meta">
            {facts}
            {a.disambiguation && <span className="muted"> · {a.disambiguation}</span>}
          </p>
          {a.genres && a.genres.length > 0 && (
            <ul className="chips tags">
              {a.genres.map((g) => <li key={g} className="chip static">{g}</li>)}
            </ul>
          )}
        </div>
        <div className="artist-actions">
          {playable ? (
            <button className="btn play-btn" onClick={() => onPlay({ ref: playable, title: a.name })}>▶ Play on Spotify</button>
          ) : (
            <a className="btn" href={spotifySearchUrl(a.name)} target="_blank" rel="noreferrer">Find on Spotify ↗</a>
          )}
          <a className="btn" href={`https://musicbrainz.org/artist/${id}`} target="_blank" rel="noreferrer">MusicBrainz ↗</a>
          {a.wikidata && (
            <a className="btn" href={`https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${a.wikidata}`} target="_blank" rel="noreferrer">Wikipedia ↗</a>
          )}
        </div>
      </header>

      {loading && <p className="muted small">Fetching more connections from MusicBrainz…</p>}
      {failed && (
        <p className="muted small">
          MusicBrainz didn’t answer.{' '}
          <button className="linkish" onClick={() => { retry(id); ensureArtist(id); }}>Try again</button>
        </p>
      )}

      <Constellation ix={ix} id={id} connections={connections} />

      {nextStops.length > 0 && (
        <section>
          <h2 className="section-title">Next stops from here</h2>
          <p className="muted small section-sub">Artists connected to {a.name} that aren’t in your library yet, best-connected to your music first.</p>
          <ul className="stops">
            {nextStops.map(({ c, s }) => (
              <li key={c.id} className="stop">
                <ArtistLink ix={ix} id={c.id} detail={c.labels[0]} />
                {s && s.via.length > 1 && (
                  <p className="muted small">
                    Also connected to {s.via.filter((v) => v.id !== id).slice(0, 3).map((v) => ix.artists[v.id]?.name).join(', ')}
                    {s.via.length > 4 ? ` and ${s.via.length - 4} more of yours` : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Connections store={store} connections={connections} />

      <Discography store={store} artistId={id} entries={disco} open={album} loading={loading} />
    </div>
  );
}

function Trail({ ids, store }: { ids: string[]; store: StoreState }) {
  return (
    <nav className="trail" aria-label="Your path">
      <span className="eyebrow">Your path</span>
      <ol>
        {ids.map((tid, i) => (
          <li key={`${tid}-${i}`}>
            {i === ids.length - 1 ? (
              <span className="current">{store.index.artists[tid]?.name}</span>
            ) : (
              <a href={href({ view: 'artist', id: tid })} className={store.index.artists[tid]?.lib ? 'mine' : 'new'}>
                {store.index.artists[tid]?.name}
              </a>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Connections({ store, connections }: { store: StoreState; connections: Connection[] }) {
  const ix = store.index;
  const groups = new Map<EdgeKind, Connection[]>();
  for (const c of connections) groups.set(c.kind, [...(groups.get(c.kind) ?? []), c]);
  const [expanded, setExpanded] = useState<Set<EdgeKind>>(new Set());
  if (!connections.length) return null;
  return (
    <section>
      <h2 className="section-title">Connections</h2>
      <div className="conn-groups">
        {[...groups.entries()].map(([kind, list]) => {
          const open = expanded.has(kind);
          const shown = open ? list : list.slice(0, 18);
          return (
            <div key={kind} className={`conn-group k-${kind}`}>
              <h3>
                {KIND_LABEL[kind]} <span className="muted">{list.length}</span>
              </h3>
              <ul className="conn-list">
                {shown.map((c) => (
                  <li key={c.id}>
                    <ArtistLink ix={ix} id={c.id} detail={c.labels.slice(0, 2).join(' · ') + (c.labels.length > 2 ? ` · +${c.labels.length - 2}` : '')} />
                  </li>
                ))}
              </ul>
              {list.length > shown.length && (
                <button className="linkish small" onClick={() => setExpanded(new Set([...expanded, kind]))}>
                  Show all {list.length}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Discography({
  store,
  artistId,
  entries,
  open,
  loading,
}: {
  store: StoreState;
  artistId: string;
  entries: DiscographyEntry[];
  open?: string;
  loading: boolean;
}) {
  const [filter, setFilter] = useState<DiscoFilter>('albums');
  const owned = store.index.libraryAlbums;
  const counts = {
    albums: entries.filter((e) => isStudio(e[3])).length,
    eps: entries.filter((e) => e[3] === 'EP').length,
    other: entries.filter((e) => !isStudio(e[3]) && e[3] !== 'EP').length,
    all: entries.length,
  };
  const effective: DiscoFilter = counts[filter] ? filter : 'all';
  const shown = entries
    .filter((e) => effective === 'all' || (effective === 'albums' ? isStudio(e[3]) : effective === 'eps' ? e[3] === 'EP' : !isStudio(e[3]) && e[3] !== 'EP'))
    .sort((x, y) => (x[2] ?? 9999) - (y[2] ?? 9999));
  const ownedCount = entries.filter((e) => owned[e[0]] !== undefined).length;

  return (
    <section>
      <div className="section-head">
        <h2 className="section-title">
          Discography <span className="muted small">{ownedCount ? `${ownedCount} of ${entries.length} in your library` : entries.length || ''}</span>
        </h2>
        <div className="seg" role="tablist">
          {(['albums', 'eps', 'other', 'all'] as const).map((f) =>
            counts[f] ? (
              <button key={f} role="tab" aria-selected={effective === f} className={effective === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'albums' ? 'Albums' : f === 'eps' ? 'EPs' : f === 'other' ? 'Live, comps & more' : 'All'} {counts[f]}
              </button>
            ) : null,
          )}
        </div>
      </div>
      {!entries.length && <p className="muted">{loading ? 'Loading discography…' : 'No albums listed on MusicBrainz.'}</p>}
      <ul className="disco">
        {shown.map(([rg, title, year, type, by]) => {
          const plays = owned[rg];
          const isOpen = open === rg;
          return [
            <li key={rg}>
              <button
                className={`album ${open === rg ? 'open' : ''} ${plays !== undefined ? 'mine' : ''}`}
                onClick={() => replace({ view: 'artist', id: artistId, album: open === rg ? undefined : rg })}
              >
                <Cover id={rg} title={title} />
                <span className="album-title">{title}</span>
                <span className="album-meta">
                  {year ?? '—'}
                  {type !== 'Album' && ` · ${type}`}
                  {by && <> · <span className="muted">{by}</span></>}
                </span>
                {plays !== undefined && <span className="owned">In your library{plays ? ` · ${plays} plays` : ''}</span>}
              </button>
            </li>,
            // Personnel opens right under the album you clicked, full width.
            isOpen && (
              <li key={`${rg}-credits`} className="album-detail-row">
                <AlbumCredits store={store} albumId={rg} onClose={() => replace({ view: 'artist', id: artistId })} />
              </li>
            ),
          ];
        })}
      </ul>
      <p className="muted small">
        Not every record is on Spotify. Search{' '}
        <a href={spotifySearchUrl(store.index.artists[artistId]?.name ?? '')} target="_blank" rel="noreferrer">Spotify</a> or{' '}
        <a href={youtubeSearchUrl(store.index.artists[artistId]?.name ?? '')} target="_blank" rel="noreferrer">YouTube</a>.
      </p>
    </section>
  );
}
