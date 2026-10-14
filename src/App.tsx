import { useCallback, useEffect, useState } from 'react';
import type { SpotifyRef } from './data/types';
import ArtistSearch from './components/ArtistSearch';
import ArtistView from './components/ArtistView';
import DiscoverView from './components/DiscoverView';
import GenresView from './components/GenresView';
import LibraryView from './components/LibraryView';
import Player from './components/Player';
import SearchView from './components/SearchView';
import SpotifyButton from './components/SpotifyButton';
import { go, href, useRoute } from './lib/router';
import { loadData, useStore } from './lib/store';

export interface NowPlaying {
  ref: SpotifyRef;
  title: string;
  performer?: string;
  eraId?: string;
}

export default function App() {
  const route = useRoute();
  const store = useStore();
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [trail, setTrail] = useState<string[]>([]);

  useEffect(loadData, []);

  // The path you've walked between artists. Going back to an earlier artist trims it.
  const artistId = route.view === 'artist' ? route.id : null;
  useEffect(() => {
    if (!artistId) return;
    setTrail((t) => {
      const at = t.lastIndexOf(artistId);
      if (at === t.length - 1) return t;
      return at >= 0 ? t.slice(0, at + 1) : [...t, artistId].slice(-12);
    });
    document.querySelector('.main')?.scrollTo({ top: 0 });
  }, [artistId]);

  const play = useCallback((p: NowPlaying) => setNowPlaying(p), []);

  const tab = route.view === 'artist' || route.view === 'search' ? null : route.view;

  return (
    <div className={`app ${nowPlaying ? 'has-player' : ''} view-${route.view}`}>
      <header className="topbar">
        <a className="brand" href={href({ view: 'library' })} aria-label="Musicology home">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--surface-2)" />
            <path d="M12 22.5a3.5 3.5 0 1 1-2-3.16V8l13-2.5v13a3.5 3.5 0 1 1-2-3.16V9.9l-9 1.75z" fill="var(--accent)" />
          </svg>
          <span>Musicology</span>
        </a>
        <nav className="tabs" aria-label="Views">
          <a href={href({ view: 'library' })} aria-current={tab === 'library' ? 'page' : undefined}>Library</a>
          <a href={href({ view: 'discover' })} aria-current={tab === 'discover' ? 'page' : undefined}>Discover</a>
          <a href={href({ view: 'genres' })} aria-current={tab === 'genres' ? 'page' : undefined}>Genres</a>
        </nav>
        <ArtistSearch store={store} />
        <div className="topbar-actions">
          {trail.length > 0 && route.view !== 'artist' && (
            <button className="btn small" onClick={() => go({ view: 'artist', id: trail[trail.length - 1] })}>
              ← Back to {store.index.artists[trail[trail.length - 1]]?.name}
            </button>
          )}
          <SpotifyButton />
        </div>
      </header>

      <main className="main">
        {route.view === 'library' && <LibraryView store={store} />}
        {route.view === 'discover' && <DiscoverView store={store} />}
        {route.view === 'search' && <SearchView store={store} q={route.q} />}
        {route.view === 'artist' && (
          <ArtistView key={route.id} store={store} id={route.id} album={route.album} trail={trail} onPlay={play} />
        )}
        {route.view === 'genres' && <GenresView era={route.era} nowPlaying={nowPlaying} onPlay={play} />}
      </main>

      <Player
        nowPlaying={nowPlaying}
        onClose={() => setNowPlaying(null)}
        onShowEra={(id) => go({ view: 'genres', era: id })}
      />
    </div>
  );
}
