import { useEffect, useRef, useState } from 'react';
import { ERA_BY_ID } from '../data/eras';
import type { NowPlaying } from '../App';
import { spotifyEmbedUrl } from '../lib/links';

/**
 * A docked Spotify embed that survives navigation, so music keeps playing as
 * you browse. Uses Spotify's iFrame API to swap tracks and start playback;
 * falls back to a plain embed if the API script can't load.
 *
 * Logged into Spotify in this browser → full tracks. Otherwise → 30s previews.
 */

interface EmbedController {
  loadUri: (uri: string) => void;
  play: () => void;
  pause: () => void;
  addListener: (event: string, cb: (e: unknown) => void) => void;
}

interface IFrameAPI {
  createController: (
    el: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    cb: (c: EmbedController) => void,
  ) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

let apiPromise: Promise<IFrameAPI> | null = null;
function loadApi(): Promise<IFrameAPI> {
  apiPromise ??= new Promise<IFrameAPI>((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => reject(new Error('Spotify iFrame API failed to load'));
    document.body.appendChild(s);
    setTimeout(() => reject(new Error('Spotify iFrame API timed out')), 8000);
  });
  return apiPromise;
}

interface Props {
  nowPlaying: NowPlaying | null;
  onClose: () => void;
  onShowEra: (id: string) => void;
}

export default function Player({ nowPlaying, onClose, onShowEra }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<EmbedController | null>(null);
  const creating = useRef(false);
  const latestUri = useRef<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const uri = nowPlaying ? `spotify:${nowPlaying.ref.kind}:${nowPlaying.ref.id}` : null;

  useEffect(() => {
    latestUri.current = uri;
    if (!uri || fallback) return;
    if (controller.current) {
      controller.current.loadUri(uri);
      return;
    }
    if (creating.current || !host.current) return;
    creating.current = true;
    const target = document.createElement('div');
    host.current.replaceChildren(target);
    loadApi()
      .then((api) =>
        api.createController(target, { uri, width: '100%', height: 152 }, (c) => {
          controller.current = c;
          // The user may have picked another item while the player was loading.
          if (latestUri.current && latestUri.current !== uri) c.loadUri(latestUri.current);
          // 'ready' fires after each load; start playback as soon as possible.
          c.addListener('ready', () => c.play());
        }),
      )
      .catch(() => setFallback(true))
      .finally(() => {
        creating.current = false;
      });
  }, [uri, fallback]);

  useEffect(() => {
    if (!nowPlaying) controller.current?.pause();
  }, [nowPlaying]);

  const era = nowPlaying?.eraId ? ERA_BY_ID[nowPlaying.eraId] : null;

  return (
    <div className={`player ${nowPlaying ? 'open' : ''} ${expanded ? 'expanded' : ''}`} aria-hidden={!nowPlaying}>
      <div className="player-info">
        <span className="eyebrow">Now playing</span>
        <strong className="player-title">{nowPlaying?.title}</strong>
        {era && (
          <button className="linkish small" onClick={() => onShowEra(era.id)}>
            from {era.title}
          </button>
        )}
        <div className="player-buttons">
          <button className="btn small" onClick={() => setExpanded((x) => !x)}>{expanded ? 'Compact' : 'Expand'}</button>
          <button className="btn small" onClick={onClose} aria-label="Close player">Close</button>
        </div>
      </div>
      <div className="player-embed">
        {fallback ? (
          nowPlaying && (
            <iframe
              key={nowPlaying.ref.id}
              title="Spotify player"
              src={spotifyEmbedUrl(nowPlaying.ref)}
              width="100%"
              height="152"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            />
          )
        ) : (
          <div ref={host} />
        )}
      </div>
    </div>
  );
}
