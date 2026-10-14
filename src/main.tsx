import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { handleRedirect } from './lib/spotifyAuth';
import './styles.css';

// Finish a Spotify login redirect (if any) before the first render so the
// UI starts out in the right "connected" state.
handleRedirect()
  .catch(() => undefined)
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
