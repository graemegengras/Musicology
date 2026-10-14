import { useState } from 'react';
import { isLoggedIn, login, logout, spotifyConfigured } from '../lib/spotifyAuth';

export default function SpotifyButton() {
  const [connected, setConnected] = useState(isLoggedIn);
  if (!spotifyConfigured) return null;
  return connected ? (
    <button
      className="btn spotify connected"
      onClick={() => { logout(); setConnected(false); }}
      title="Connected. Click to disconnect."
    >
      ● Spotify
    </button>
  ) : (
    <button className="btn spotify" onClick={() => login()} title="Connect to search Spotify for more music in each era">
      Connect Spotify
    </button>
  );
}
