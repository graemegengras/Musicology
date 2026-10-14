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

## Next ideas
- Verify the player in a real browser; tune the compact/expanded embed heights.
- More eras: non-Western traditions (Hindustani/Carnatic, gamelan, Afrobeat, highlife, bossa nova, K-pop, Latin), 2000s+.
- Embed non-Spotify audio directly (Internet Archive / Wikimedia Commons players) instead of only linking out.
- Artist-level nodes inside eras; a "your listening" view from Spotify history.
- For Spotify login on the live site: register https://graemegengras.github.io/Musicology/ as a redirect URI and set the `VITE_SPOTIFY_CLIENT_ID` repo variable.
