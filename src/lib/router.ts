import { useEffect, useState } from 'react';

export type Route =
  | { view: 'library' }
  | { view: 'discover' }
  | { view: 'artist'; id: string; album?: string }
  | { view: 'search'; q: string }
  | { view: 'genres'; era?: string };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  switch (parts[0]) {
    case 'artist':
      return parts[1] ? { view: 'artist', id: parts[1], album: parts[2] || undefined } : { view: 'library' };
    case 'discover':
      return { view: 'discover' };
    case 'search':
      return { view: 'search', q: parts.slice(1).join('/') };
    case 'genres':
      return { view: 'genres', era: parts[1] || undefined };
    default:
      return { view: 'library' };
  }
}

export function href(r: Route): string {
  switch (r.view) {
    case 'artist':
      return `#/artist/${r.id}${r.album ? `/${r.album}` : ''}`;
    case 'discover':
      return '#/discover';
    case 'search':
      return `#/search/${encodeURIComponent(r.q)}`;
    case 'genres':
      return `#/genres${r.era ? `/${r.era}` : ''}`;
    default:
      return '#/';
  }
}

/** Navigate with history, so the browser's back button retraces your path. */
export function go(r: Route) {
  window.location.hash = href(r);
}

/** Change the URL without a new history entry (e.g. opening an album). */
export function replace(r: Route) {
  window.history.replaceState(null, '', href(r));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
