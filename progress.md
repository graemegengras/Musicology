# Progress

## 2026-10-14
- Created project, initialized git, pushed to private GitHub repo graemegengras/Musicology.
- Defined the project: visual music-history browser + learning tool with Spotify listening, plus coverage of music not on Spotify.
- Built MVP (Vite + React + TS):
  - Zoomable piecewise timeline, 45 eras in 8 lanes, influence lines, search, shareable `#/era/<id>` URLs.
  - Era panel: summary, availability (on / partly / not on Spotify), listen items, key figures, grew-out-of / led-to, links.
  - Docked Spotify player via the iFrame API (plain-embed fallback). Needs no API key.
  - Off-Spotify items with reasons + YouTube / Internet Archive / archive links. "Off-Spotify" highlight toggle.
  - 6 guided tours, generated quiz (3 question types, best streak saved locally).
  - Optional Spotify PKCE login (`VITE_SPOTIFY_CLIENT_ID`) adds per-era artist track search.
  - Tests: data integrity, time scale, layout packing, quiz.
- Not yet verified: actual Spotify embed playback (Spotify is blocked from the dev sandbox; check in a real browser).

- Added GitHub Pages deploy workflow (on push to main), relative asset paths, plain `#<era-id>` share links, explicit light/dark theme guards.
  - Live at https://graemegengras.github.io/Musicology/ (repo made public, Pages source = GitHub Actions). Every push to main redeploys.

- Feedback round 1 (user): timeline should start at Baroque, drag to pan, no quiz, no welcome sidebar. Main goal is now an artist-level explorer based on the user's Apple Music library.
  - Done: timeline 1600–today (pre-Baroque eras dropped), click-and-drag panning, quiz + welcome removed, era details in a closable drawer (Esc), tours in a menu.
  - Done: `npm run import-library -- Library.xml` → `src/data/library.json` (artists, albums, plays, genres, feat. links; no file paths). The user OK'd committing their library to the public repo.
  - Phase 2 (artist explorer) built: Library home (your artists by plays, genre filter, "one step from what you play"), artist pages (constellation map of connections, "next stops" = new artists one hop away ranked by ties to your library, grouped connections, discography with covers, per-album personnel inline), Discover (ranked one-step-away list with "via" reasons), search (local + live MusicBrainz), path trail, Genres tab = the old timeline.
  - Data: `npm run build-graph -- --top 600 --credits` (MusicBrainz, cached in .mbcache, ~1 req/s) → public/data/graph.json + credits.json. Anything outside the prebuilt graph is fetched live in the browser (src/lib/mbLive.ts, rate-limited queue).
  - Feedback: missing the chronological aspect. Added a Timeline tab (library artists as bars from first to latest album, lanes by family of music, drag/zoom, click to draw connections, card to open the artist) and an "In time" mode on artist pages (career axis with albums; one row per connection showing when paths crossed: band years and shared records).
  - In progress: full graph build running via a background agent. public/data not committed yet; commit it when the run finishes.

## Next ideas
- Verify the player in a real browser; tune the compact/expanded embed heights.
- More eras: non-Western traditions (Hindustani/Carnatic, gamelan, Afrobeat, highlife, bossa nova, K-pop, Latin), 2000s+.
- Embed non-Spotify audio directly (Internet Archive / Wikimedia Commons players) instead of only linking out.
- Artist-level nodes inside eras; a "your listening" view from Spotify history.
- For Spotify login on the live site: register https://graemegengras.github.io/Musicology/ as a redirect URI and set the `VITE_SPOTIFY_CLIENT_ID` repo variable.
