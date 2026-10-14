# Musicology

A visual music-history browser and learning tool. Browse eras and movements on a
zoomable timeline, follow influence lines between them, and listen as you go. It
also covers the music you **can't** stream: lost, unreleased, archive-only, and
pre-recording music.

## Features

- **Timeline**: 45 eras across 8 traditions, from 600 BCE to today. The scale
  is piecewise, so the dense 20th century gets room. Ctrl/⌘ + scroll to zoom.
- **Influence map**: select an era to see what it grew out of (solid) and what
  it led to (dashed). Toggle *All links* to see the whole web.
- **Listen while you browse**: a docked Spotify player keeps playing as you
  explore. No setup needed. If you're logged in to spotify.com in the same
  browser you get full tracks, otherwise 30-second previews.
- **Beyond Spotify**: each era is marked on Spotify / partly / not on Spotify.
  Off-Spotify items explain why (never recorded, dubplates, party tapes,
  cylinder archives…) and link to YouTube, the Internet Archive, and specialist
  archives. The *Off-Spotify* toggle highlights these eras.
- **Guided tours**: six narrated paths, e.g. *Roots of the Blues*, *Machines That
  Make Music*, and *Off the Grid*.
- **Quiz**: "which came first", "whose key figure", and "what fed into what"
  questions, generated from the data.
- **Optional Spotify connect**: with a Client ID, logging in adds "More from
  these artists" search results to each era.

## Running it

```sh
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # data integrity + logic tests
npm run build
```

### Optional: Connect Spotify

Playback works without this. Connecting only adds catalogue search.

1. Create an app at <https://developer.spotify.com/dashboard>.
2. Add the redirect URI `http://127.0.0.1:5173/`. Spotify doesn't accept
   `localhost`, so use the loopback IP.
3. `cp .env.example .env.local` and set `VITE_SPOTIFY_CLIENT_ID`.

Login uses Authorization Code + PKCE entirely in the browser, with no backend
and no secret. Apps in Spotify's development mode can only be used by
allow-listed accounts.

## Hosting on GitHub Pages

`.github/workflows/pages.yml` builds, tests, and deploys on every push to `main`.
One-time setup:

1. GitHub Pages needs a **public repo**, or a private one on GitHub Pro/Team.
   Either way the published site itself is public.
2. Go to repo **Settings → Pages → Build and deployment → Source** and choose
   **GitHub Actions**.
3. Push or merge to `main`. The site appears at
   `https://graemegengras.github.io/Musicology/`.

For Spotify login on the live site, add `https://graemegengras.github.io/Musicology/`
as a redirect URI in your Spotify app. Then add the Client ID as a repo variable
named `VITE_SPOTIFY_CLIENT_ID` under Settings → Secrets and variables → Actions → Variables.

## Project layout

```
src/data/eras.ts       the content: eras, lanes, Spotify ids, off-Spotify notes
src/data/tours.ts      guided tours
src/lib/timeScale.ts   piecewise year→pixel scale
src/lib/layout.ts      packs eras into rows per lane
src/lib/quiz.ts        question generator
src/lib/spotifyAuth.ts optional PKCE login + search
src/components/        Timeline, EraPanel, Player, TourBar, Quiz, Search…
tests/                 vitest
```

### Adding an era

Add an entry to `ERAS` in `src/data/eras.ts`. Give it an `id`, a `lane`,
`start`/`end`, `influences` (ids of parent eras), and `listen` items. A listen
item either has a `spotify: track('<22-char id>')` or `notOnSpotify: true` with
a `note` saying where to hear it. `npm test` checks the references.
