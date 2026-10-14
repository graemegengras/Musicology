import { ERAS } from '../data/eras';
import { TOURS } from '../data/tours';
import { spotifyConfigured } from '../lib/spotifyAuth';
import AvailabilityDot from './AvailabilityDot';

interface Props {
  onStartTour: (id: string) => void;
  onSelect: (id: string) => void;
}

export default function Welcome({ onStartTour, onSelect }: Props) {
  const offCount = ERAS.filter((e) => e.availability !== 'spotify').length;
  const random = () => onSelect(ERAS[Math.floor(Math.random() * ERAS.length)].id);
  return (
    <div className="welcome">
      <h2>Wander through music history</h2>
      <p>
        Each bar is an era or movement, placed in time and grouped by tradition. Click one to read about it,
        play an example, and follow the lines to see what it grew out of and what it led to.
      </p>
      <p>
        Music keeps playing in the dock at the bottom while you browse. A lot of essential music was never
        released, never recorded, or predates recording entirely. {offCount} of the {ERAS.length} eras here
        have key music that isn’t on Spotify, and we show you where to find it instead.
      </p>

      <div className="legend">
        <span><AvailabilityDot availability="spotify" /> On Spotify</span>
        <span><AvailabilityDot availability="partial" /> Partly</span>
        <span><AvailabilityDot availability="unavailable" /> Not on Spotify</span>
      </div>

      <button className="btn primary" onClick={random}>Take me somewhere random</button>

      <h3>Guided tours</h3>
      <ul className="tour-list">
        {TOURS.map((t) => (
          <li key={t.id}>
            <button className="tour-card" onClick={() => onStartTour(t.id)}>
              <strong>{t.title}</strong>
              <span>{t.blurb}</span>
              <span className="muted small">{t.steps.length} stops</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="muted small tip">
        Tip: Ctrl/⌘ + scroll to zoom the timeline. The early centuries are compressed so the recording era has room.
        {!spotifyConfigured && ' Playback uses Spotify’s embed player: log in to spotify.com in this browser for full tracks instead of 30-second previews.'}
      </p>
    </div>
  );
}
