# Musicology

A visual music-history browser and learning tool (Vite + React + TypeScript, no backend).
Timeline of eras with influence links, a docked Spotify embed player, guided tours, a quiz,
and first-class coverage of music that isn't on Spotify. See README.md for features and layout.

- Content lives in `src/data/eras.ts` and `src/data/tours.ts`. `npm test` validates references, dates, and Spotify id format.
- Spotify ids in the data were looked up in the real catalogue. Don't invent ids. If one isn't known, omit `spotify` (the UI shows a "Find on Spotify" search link) or set `notOnSpotify: true` with a note.
- Checks: `npm run typecheck`, `npm test`, `npm run build`.

Current status and next steps are in progress.md. Read it at the start of a session and update it before finishing a task.
