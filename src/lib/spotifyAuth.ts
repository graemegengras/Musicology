/**
 * Optional Spotify Web API connection (Authorization Code + PKCE, no backend).
 * Playback itself works without this: the embed player handles login for full
 * tracks. Connecting only unlocks searching the catalogue for more examples.
 */
import type { SpotifyRef } from '../data/types';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;
const TOKEN_KEY = 'musicology.spotify.token';
const VERIFIER_KEY = 'musicology.spotify.verifier';
const STATE_KEY = 'musicology.spotify.state';

interface StoredToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export const spotifyConfigured = Boolean(CLIENT_ID);

// Works at the site root locally and under /Musicology/ on GitHub Pages.
const redirectUri = () => `${window.location.origin}${window.location.pathname}`;

function randomString(len: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as StoredToken) : null;
  } catch {
    return null;
  }
}

function saveToken(t: { access_token: string; refresh_token?: string; expires_in: number }) {
  const prev = readToken();
  const stored: StoredToken = {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? prev?.refresh_token,
    expires_at: Date.now() + (t.expires_in - 60) * 1000,
  };
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
  } catch {
    /* storage unavailable: token lives for this page only */
  }
  memToken = stored;
}

let memToken: StoredToken | null = null;

export async function login(): Promise<void> {
  if (!CLIENT_ID) return;
  const verifier = randomString(64);
  const state = randomString(16);
  localStorage.setItem(VERIFIER_KEY, verifier);
  localStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
  });
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

export function logout() {
  memToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Call once on startup. Completes the redirect leg of the login flow if present. */
export async function handleRedirect(): Promise<void> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!CLIENT_ID || (!code && !url.searchParams.get('error'))) return;

  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  url.searchParams.delete('code');
  url.searchParams.delete('state');
  url.searchParams.delete('error');
  window.history.replaceState({}, '', url.toString());

  if (!code || !verifier || state !== expectedState) return;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (res.ok) saveToken(await res.json());
}

async function accessToken(): Promise<string | null> {
  const t = memToken ?? readToken();
  if (!t || !CLIENT_ID) return null;
  if (Date.now() < t.expires_at) return t.access_token;
  if (!t.refresh_token) return null;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: CLIENT_ID }),
  });
  if (!res.ok) {
    logout();
    return null;
  }
  saveToken(await res.json());
  return memToken!.access_token;
}

export function isLoggedIn(): boolean {
  return Boolean(memToken ?? readToken());
}

export interface SearchHit {
  ref: SpotifyRef;
  name: string;
  artists: string;
  year?: string;
  image?: string;
}

interface ApiTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { release_date?: string; images: { url: string; width: number }[] };
}

/** Top tracks by an artist name, via the Search endpoint. */
export async function searchTracksByArtist(artistName: string, limit = 3): Promise<SearchHit[]> {
  const token = await accessToken();
  if (!token) return [];
  const params = new URLSearchParams({ q: `artist:"${artistName}"`, type: 'track', limit: String(limit) });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) logout();
  if (!res.ok) return [];
  const data = (await res.json()) as { tracks?: { items: ApiTrack[] } };
  return (data.tracks?.items ?? []).map((t) => ({
    ref: { kind: 'track', id: t.id },
    name: t.name,
    artists: t.artists.map((a) => a.name).join(', '),
    year: t.album.release_date?.slice(0, 4),
    image: [...t.album.images].sort((a, b) => a.width - b.width)[0]?.url,
  }));
}
