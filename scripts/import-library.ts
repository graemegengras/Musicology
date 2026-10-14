/**
 * Usage: npm run import-library -- path/to/Library.xml
 * Writes src/data/library.json (artists, albums, play counts; no file paths).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { summarizeLibrary } from '../src/lib/appleLibrary.ts';

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run import-library -- path/to/Library.xml');
  process.exit(1);
}
const summary = summarizeLibrary(readFileSync(input, 'utf8'));
writeFileSync(new URL('../src/data/library.json', import.meta.url), JSON.stringify(summary, null, 1) + '\n');
console.log(`${summary.trackCount} tracks, ${summary.artists.length} artists → src/data/library.json`);
