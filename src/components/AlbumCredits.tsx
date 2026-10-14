import { useEffect } from 'react';
import { isTechnicalRole } from '../lib/mb';
import { spotifySearchUrl, youtubeSearchUrl } from '../lib/links';
import { ensureCredits, retry, type StoreState } from '../lib/store';
import ArtistLink from './ArtistLink';
import Cover from './Cover';

const PRODUCTION = /producer|programming|arrangement|mix|remixer|orchestra|conductor/;

/** Who played on an album, grouped into musicians, production, and engineering. */
export default function AlbumCredits({ store, albumId, onClose }: { store: StoreState; albumId: string; onClose: () => void }) {
  const ix = store.index;
  const album = ix.albums.get(albumId)!;
  const list = ix.credits[albumId];
  const key = `credits:${albumId}`;

  useEffect(() => ensureCredits(albumId), [albumId]);

  const owner = album.owner;
  const groups: Record<'Musicians' | 'Production' | 'Engineering', [string, string, number][]> = {
    Musicians: [],
    Production: [],
    Engineering: [],
  };
  for (const c of list ?? []) {
    if (c[0] === owner && c[1].split(', ').every((r) => isTechnicalRole(r) || r === 'producer')) continue;
    const roles = c[1].split(', ');
    if (roles.every(isTechnicalRole)) groups.Engineering.push(c);
    else if (roles.every((r) => PRODUCTION.test(r) || isTechnicalRole(r))) groups.Production.push(c);
    else groups.Musicians.push(c);
  }
  const byLine = album.by ?? ix.artists[owner]?.name ?? '';
  const q = `${byLine} ${album.title}`;
  const plays = ix.libraryAlbums[albumId];

  return (
    <article className="album-credits">
      <button className="close" onClick={onClose} aria-label="Close album">×</button>
      <Cover id={albumId} title={album.title} size={500} />
      <div className="album-credits-body">
        <p className="eyebrow">{album.type}{album.year ? ` · ${album.year}` : ''}{plays !== undefined ? ` · in your library${plays ? `, ${plays} plays` : ''}` : ''}</p>
        <h3>{album.title}</h3>
        <p className="meta">{byLine}</p>
        <div className="listen-links">
          <a href={spotifySearchUrl(q)} target="_blank" rel="noreferrer">Find on Spotify ↗</a>
          <a href={youtubeSearchUrl(q)} target="_blank" rel="noreferrer">YouTube ↗</a>
          <a href={`https://musicbrainz.org/release-group/${albumId}`} target="_blank" rel="noreferrer">MusicBrainz ↗</a>
        </div>

        {!list && store.pending.has(key) && <p className="muted">Loading personnel from MusicBrainz…</p>}
        {!list && store.failed.has(key) && (
          <p className="muted">
            Couldn’t load personnel. <button className="linkish" onClick={() => { retry(key); ensureCredits(albumId); }}>Try again</button>
          </p>
        )}
        {list && list.length === 0 && <p className="muted">MusicBrainz has no personnel listed for this album yet.</p>}
        {list && list.length > 0 &&
          (Object.entries(groups) as [string, [string, string, number][]][]).map(([name, people]) =>
            people.length ? (
              <section key={name} className="credit-group">
                <h4>{name}</h4>
                <ul className="credit-list">
                  {people.map(([pid, roles, tracks]) => (
                    <li key={pid}>
                      <ArtistLink ix={ix} id={pid} detail={`${roles}${tracks ? ` · ${tracks} track${tracks === 1 ? '' : 's'}` : ''}`} />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
      </div>
    </article>
  );
}
