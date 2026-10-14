import { useEffect, useState } from 'react';
import { ERA_BY_ID, LANES, descendantsOf } from '../data/eras';
import type { Era, Listen, SpotifyRef } from '../data/types';
import type { NowPlaying } from '../App';
import { formatSpan } from '../lib/timeScale';
import {
  archiveSearchUrl,
  listenQuery,
  spotifyOpenUrl,
  spotifySearchUrl,
  youtubeSearchUrl,
} from '../lib/links';
import { isLoggedIn, searchTracksByArtist, spotifyConfigured, type SearchHit } from '../lib/spotifyAuth';
import AvailabilityDot, { availabilityText } from './AvailabilityDot';

interface Props {
  era: Era;
  onSelect: (id: string) => void;
  onPlay: (item: { title: string; performer?: string; spotify: SpotifyRef }, eraId?: string) => void;
  nowPlaying: NowPlaying | null;
  onClose: () => void;
}

export default function EraPanel({ era, onSelect, onPlay, nowPlaying, onClose }: Props) {
  const lane = LANES.find((l) => l.id === era.lane)!;
  const parents = era.influences.map((id) => ERA_BY_ID[id]).filter(Boolean);
  const children = descendantsOf(era.id);

  return (
    <article className="era-panel" style={{ ['--lane' as string]: lane.color }}>
      <button className="close" onClick={onClose} aria-label="Close">×</button>
      <p className="eyebrow">{lane.label}</p>
      <h2>{era.title}</h2>
      <p className="meta">
        {formatSpan(era.start, era.end)} · {era.region}
      </p>

      <p className={`availability availability-${era.availability}`}>
        <AvailabilityDot availability={era.availability} />
        <span>
          <strong>{availabilityText(era.availability)}.</strong> {era.availabilityNote}
        </span>
      </p>

      <p className="summary">{era.summary}</p>

      <h3>Listen</h3>
      <ul className="listen-list">
        {era.listen.map((item) => (
          <ListenRow key={item.title} item={item} eraId={era.id} onPlay={onPlay} nowPlaying={nowPlaying} />
        ))}
      </ul>

      <MoreOnSpotify era={era} onPlay={onPlay} nowPlaying={nowPlaying} />

      <h3>Key figures</h3>
      <ul className="chips">
        {era.keyFigures.map((f) => (
          <li key={f} className="chip static">{f}</li>
        ))}
      </ul>

      <div className="connections">
        <div>
          <h3>Grew out of</h3>
          {parents.length ? (
            <ul className="chips">
              {parents.map((p) => (
                <li key={p.id}>
                  <button className="chip" onClick={() => onSelect(p.id)} style={{ ['--lane' as string]: LANES.find((l) => l.id === p.lane)!.color }}>
                    ← {p.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">A starting point in this map.</p>
          )}
        </div>
        <div>
          <h3>Led to</h3>
          {children.length ? (
            <ul className="chips">
              {children.map((c) => (
                <li key={c.id}>
                  <button className="chip" onClick={() => onSelect(c.id)} style={{ ['--lane' as string]: LANES.find((l) => l.id === c.lane)!.color }}>
                    {c.title} →
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing mapped yet.</p>
          )}
        </div>
      </div>

      <h3>Read more</h3>
      <ul className="links">
        {era.links.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ListenRow({
  item,
  eraId,
  onPlay,
  nowPlaying,
}: {
  item: Listen;
  eraId: string;
  onPlay: Props['onPlay'];
  nowPlaying: NowPlaying | null;
}) {
  const q = listenQuery(item.title, item.performer);
  const spotify = item.spotify;
  const playing = spotify && nowPlaying?.ref.id === spotify.id;
  return (
    <li className={`listen ${item.notOnSpotify ? 'off-spotify' : ''}`}>
      <div className="listen-main">
        {spotify ? (
          <button
            className={`play ${playing ? 'is-playing' : ''}`}
            onClick={() => onPlay({ title: item.title, performer: item.performer, spotify }, eraId)}
            aria-label={`Play ${item.title}`}
          >
            {playing ? <span className="eq"><i /><i /><i /></span> : '▶'}
          </button>
        ) : (
          <span className={`play placeholder ${item.notOnSpotify ? 'off' : ''}`} aria-hidden="true">
            {item.notOnSpotify ? '⌀' : '♪'}
          </span>
        )}
        <div>
          <div className="listen-title">
            {item.title}
            {item.year && <span className="muted"> · {item.year}</span>}
          </div>
          {item.performer && item.performer !== item.title && <div className="muted small">{item.performer}</div>}
          {item.notOnSpotify && <div className="badge-off">Not on Spotify</div>}
        </div>
      </div>
      {item.note && <p className="listen-note">{item.note}</p>}
      <div className="listen-links">
        {spotify && (
          <a href={spotifyOpenUrl(spotify)} target="_blank" rel="noreferrer">Open in Spotify ↗</a>
        )}
        {!spotify && !item.notOnSpotify && (
          <a href={spotifySearchUrl(q)} target="_blank" rel="noreferrer">Find on Spotify ↗</a>
        )}
        <a href={youtubeSearchUrl(q)} target="_blank" rel="noreferrer">YouTube ↗</a>
        {item.notOnSpotify && (
          <a href={archiveSearchUrl(q)} target="_blank" rel="noreferrer">Internet Archive ↗</a>
        )}
      </div>
    </li>
  );
}

function MoreOnSpotify({ era, onPlay, nowPlaying }: { era: Era; onPlay: Props['onPlay']; nowPlaying: NowPlaying | null }) {
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const loggedIn = spotifyConfigured && isLoggedIn();

  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    const known = new Set(era.listen.map((l) => l.spotify?.id).filter(Boolean));
    Promise.all(era.keyFigures.slice(0, 3).map((f) => searchTracksByArtist(f, 2)))
      .then((groups) => {
        if (cancelled) return;
        const seen = new Set<string>();
        setHits(
          groups.flat().filter((h) => {
            if (known.has(h.ref.id) || seen.has(h.ref.id)) return false;
            seen.add(h.ref.id);
            return true;
          }),
        );
      })
      .catch(() => !cancelled && setHits([]));
    return () => {
      cancelled = true;
    };
  }, [era, loggedIn]);

  if (!loggedIn) return null;
  return (
    <>
      <h3>More from these artists on Spotify</h3>
      {hits === null ? (
        <p className="muted small">Searching Spotify…</p>
      ) : hits.length === 0 ? (
        <p className="muted small">Nothing found. Older and archival eras are often thin on Spotify.</p>
      ) : (
        <ul className="hits">
          {hits.map((h) => (
            <li key={h.ref.id}>
              <button
                className={`hit ${nowPlaying?.ref.id === h.ref.id ? 'is-playing' : ''}`}
                onClick={() => onPlay({ title: h.name, performer: h.artists, spotify: h.ref }, era.id)}
              >
                {h.image ? <img src={h.image} alt="" width={40} height={40} /> : <span className="hit-img" />}
                <span>
                  <span className="hit-name">{h.name}</span>
                  <span className="muted small">{h.artists}{h.year ? ` · ${h.year}` : ''}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
