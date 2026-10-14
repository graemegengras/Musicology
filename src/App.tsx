import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ERAS, ERA_BY_ID } from './data/eras';
import { TOURS } from './data/tours';
import type { Listen, SpotifyRef } from './data/types';
import Timeline from './components/Timeline';
import EraPanel from './components/EraPanel';
import Player from './components/Player';
import TourBar from './components/TourBar';
import ToursMenu from './components/ToursMenu';
import Search from './components/Search';
import SpotifyButton from './components/SpotifyButton';

export interface NowPlaying {
  ref: SpotifyRef;
  title: string;
  performer?: string;
  eraId?: string;
}

export interface ActiveTour {
  tourId: string;
  step: number;
}

function eraFromHash(): string | null {
  // Plain #<era-id> anchors, so links work on hosts that only pass simple fragments.
  const id = window.location.hash.replace(/^#\/?(era\/)?/, '');
  return ERA_BY_ID[id] ? id : null;
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(eraFromHash);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [tour, setTour] = useState<ActiveTour | null>(null);
  const [offSpotifyOnly, setOffSpotifyOnly] = useState(false);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const panel = useRef<HTMLElement>(null);

  // Each era starts at the top of the panel.
  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  // Esc closes the detail drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep the URL shareable: #/era/<id>
  useEffect(() => {
    const target = selectedId ? `#${selectedId}` : window.location.pathname + window.location.search;
    if (window.location.hash === (selectedId ? target : '')) return;
    try {
      window.history.replaceState(null, '', target);
    } catch {
      /* some sandboxed hosts disallow history changes */
    }
  }, [selectedId]);

  useEffect(() => {
    const onHash = () => setSelectedId(eraFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const select = useCallback((id: string | null) => setSelectedId(id), []);

  const play = useCallback((item: Listen | { title: string; performer?: string; spotify: SpotifyRef }, eraId?: string) => {
    if (!item.spotify) return;
    setNowPlaying({ ref: item.spotify, title: item.title, performer: item.performer, eraId });
  }, []);

  const startTour = (tourId: string) => {
    const t = TOURS.find((x) => x.id === tourId)!;
    setTour({ tourId, step: 0 });
    setSelectedId(t.steps[0].eraId);
  };

  const goToStep = (step: number) => {
    if (!tour) return;
    const t = TOURS.find((x) => x.id === tour.tourId)!;
    const clamped = Math.max(0, Math.min(step, t.steps.length - 1));
    setTour({ ...tour, step: clamped });
    setSelectedId(t.steps[clamped].eraId);
  };

  const dimmed = useMemo(
    () => (offSpotifyOnly ? new Set(ERAS.filter((e) => e.availability === 'spotify').map((e) => e.id)) : new Set<string>()),
    [offSpotifyOnly],
  );

  const selected = selectedId ? ERA_BY_ID[selectedId] : null;
  const activeTour = tour ? TOURS.find((t) => t.id === tour.tourId)! : null;

  return (
    <div className={`app ${nowPlaying ? 'has-player' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={() => { select(null); setTour(null); }} aria-label="Musicology home">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--surface-2)" />
            <path d="M12 22.5a3.5 3.5 0 1 1-2-3.16V8l13-2.5v13a3.5 3.5 0 1 1-2-3.16V9.9l-9 1.75z" fill="var(--accent)" />
          </svg>
          <span>Musicology</span>
        </button>
        <Search onPick={select} />
        <div className="topbar-actions">
          <label className="toggle" title="Highlight eras whose essential music isn't (fully) on Spotify">
            <input type="checkbox" checked={offSpotifyOnly} onChange={(e) => setOffSpotifyOnly(e.target.checked)} />
            <span>Off-Spotify</span>
          </label>
          <label className="toggle" title="Draw every influence line, not just the selected era's">
            <input type="checkbox" checked={showAllLinks} onChange={(e) => setShowAllLinks(e.target.checked)} />
            <span>All links</span>
          </label>
          <ToursMenu onStart={startTour} />
          <SpotifyButton />
        </div>
      </header>

      <main className="main">
        <section className="timeline-wrap">
          {activeTour && tour && (
            <TourBar
              tour={activeTour}
              step={tour.step}
              onStep={goToStep}
              onClose={() => setTour(null)}
            />
          )}
          <Timeline
            selectedId={selectedId}
            onSelect={select}
            dimmed={dimmed}
            showAllLinks={showAllLinks}
            playingEraId={nowPlaying?.eraId}
            tourIds={activeTour ? activeTour.steps.map((s) => s.eraId) : undefined}
          />
        </section>

        {selected && (
          <aside className="drawer" ref={panel}>
            <EraPanel
              key={selected.id}
              era={selected}
              onSelect={select}
              onPlay={play}
              nowPlaying={nowPlaying}
              onClose={() => select(null)}
            />
          </aside>
        )}
      </main>

      <Player nowPlaying={nowPlaying} onClose={() => setNowPlaying(null)} onShowEra={select} />
    </div>
  );
}
