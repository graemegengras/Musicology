import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ERAS, ERA_BY_ID } from '../data/eras';
import { TOURS } from '../data/tours';
import type { SpotifyRef } from '../data/types';
import type { NowPlaying } from '../App';
import { replace } from '../lib/router';
import EraPanel from './EraPanel';
import Timeline from './Timeline';
import TourBar from './TourBar';
import ToursMenu from './ToursMenu';

interface Props {
  era?: string;
  nowPlaying: NowPlaying | null;
  onPlay: (p: NowPlaying) => void;
}

/** The genre-level timeline: eras, influence lines, tours. */
export default function GenresView({ era, nowPlaying, onPlay }: Props) {
  const selectedId = era && ERA_BY_ID[era] ? era : null;
  const [tour, setTour] = useState<{ tourId: string; step: number } | null>(null);
  const [offSpotifyOnly, setOffSpotifyOnly] = useState(false);
  const [showAllLinks, setShowAllLinks] = useState(false);
  const panel = useRef<HTMLElement>(null);

  const select = useCallback((id: string | null) => replace({ view: 'genres', era: id ?? undefined }), []);

  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && select(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  const play = useCallback(
    (item: { title: string; performer?: string; spotify: SpotifyRef }, eraId?: string) =>
      onPlay({ ref: item.spotify, title: item.title, performer: item.performer, eraId }),
    [onPlay],
  );

  const startTour = (tourId: string) => {
    const t = TOURS.find((x) => x.id === tourId)!;
    setTour({ tourId, step: 0 });
    select(t.steps[0].eraId);
  };
  const goToStep = (step: number) => {
    if (!tour) return;
    const t = TOURS.find((x) => x.id === tour.tourId)!;
    const clamped = Math.max(0, Math.min(step, t.steps.length - 1));
    setTour({ ...tour, step: clamped });
    select(t.steps[clamped].eraId);
  };

  const dimmed = useMemo(
    () => (offSpotifyOnly ? new Set(ERAS.filter((e) => e.availability === 'spotify').map((e) => e.id)) : new Set<string>()),
    [offSpotifyOnly],
  );
  const selected = selectedId ? ERA_BY_ID[selectedId] : null;
  const activeTour = tour ? TOURS.find((t) => t.id === tour.tourId)! : null;

  return (
    <div className="genres">
      <div className="genres-tools">
        <label className="toggle" title="Highlight eras whose essential music isn't (fully) on Spotify">
          <input id="off-spotify" type="checkbox" checked={offSpotifyOnly} onChange={(e) => setOffSpotifyOnly(e.target.checked)} />
          <span>Off-Spotify</span>
        </label>
        <label className="toggle" title="Draw every influence line, not just the selected era's">
          <input id="all-links" type="checkbox" checked={showAllLinks} onChange={(e) => setShowAllLinks(e.target.checked)} />
          <span>All links</span>
        </label>
        <ToursMenu onStart={startTour} />
      </div>
      <div className="genres-main">
        <section className="timeline-wrap">
          {activeTour && tour && <TourBar tour={activeTour} step={tour.step} onStep={goToStep} onClose={() => setTour(null)} />}
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
            <EraPanel key={selected.id} era={selected} onSelect={select} onPlay={play} nowPlaying={nowPlaying} onClose={() => select(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
