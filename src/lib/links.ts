import type { SpotifyRef } from '../data/types';

export const spotifyEmbedUrl = (ref: SpotifyRef) =>
  `https://open.spotify.com/embed/${ref.kind}/${ref.id}?utm_source=musicology`;

export const spotifyOpenUrl = (ref: SpotifyRef) => `https://open.spotify.com/${ref.kind}/${ref.id}`;

export const spotifySearchUrl = (q: string) => `https://open.spotify.com/search/${encodeURIComponent(q)}`;

export const youtubeSearchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

export const archiveSearchUrl = (q: string) =>
  `https://archive.org/search?query=${encodeURIComponent(q)}&sin=&and%5B%5D=mediatype%3A%22audio%22`;

export const listenQuery = (title: string, performer?: string) =>
  performer && performer !== title ? `${performer} ${title}` : title;
