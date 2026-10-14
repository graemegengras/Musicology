/**
 * When was an artist active, and which broad family of music do they belong to?
 * Used to put artists on a time axis.
 */
import type { LibraryArtist } from './appleLibrary';
import type { GraphIndex } from './graph';

export interface Span {
  start: number;
  end: number;
  /** Years with an album or EP, for markers along the bar. */
  albumYears: number[];
}

const THIS_YEAR = new Date().getFullYear();

/**
 * Career span from MusicBrainz studio albums/EPs when we have them (Apple's
 * "Year" is often a reissue date), else from the library, else life-span.
 */
export function careerSpan(ix: GraphIndex, id: string | null, lib?: LibraryArtist): Span | null {
  const fromMb = id
    ? (ix.discographies[id] ?? [])
        .filter(([, , year, type]) => year && (type === 'Album' || type === 'EP'))
        .map(([, , year]) => year as number)
    : [];
  const fromLib = (lib?.albums ?? []).map((a) => a.year).filter((y): y is number => !!y && y > 1900);
  const years = (fromMb.length ? fromMb : fromLib).filter((y) => y <= THIS_YEAR).sort((a, b) => a - b);
  const a = id ? ix.artists[id] : undefined;
  if (!years.length) {
    if (a?.begin && a.type !== 'Person') return { start: a.begin, end: a.end ?? THIS_YEAR, albumYears: [] };
    return null;
  }
  // A band's founding year is a better start than its first record, when known.
  const start = a?.type === 'Group' && a.begin && a.begin < years[0] && years[0] - a.begin < 15 ? a.begin : years[0];
  return { start, end: Math.max(years[years.length - 1], start + 1), albumYears: [...new Set(years)] };
}

export type Family = 'jazz' | 'hiphop' | 'soul' | 'electronic' | 'rock' | 'world' | 'other';

export const FAMILIES: { id: Family; label: string; color: string }[] = [
  { id: 'jazz', label: 'Jazz', color: '#6fb4ff' },
  { id: 'soul', label: 'Soul, R&B & Funk', color: '#ff8a8a' },
  { id: 'hiphop', label: 'Hip-Hop', color: '#a6e36b' },
  { id: 'electronic', label: 'Electronic', color: '#4fd6c4' },
  { id: 'rock', label: 'Rock, Indie & Folk', color: '#f2b84b' },
  { id: 'world', label: 'Reggae, Brazil & World', color: '#e8a76b' },
  { id: 'other', label: 'Everything else', color: '#9aa3b5' },
];

const RULES: [Family, RegExp][] = [
  ['hiphop', /hip.?hop|\brap\b|beats|wonky|boom bap/i],
  ['jazz', /jazz|bebop|bop\b|fusion|swing|джаз/i],
  ['soul', /r&b|r ?and ?b|soul|funk|gospel|motown|quiet storm|disco/i],
  ['electronic', /electronic|electronica|house|techno|ambient|downtempo|idm|experimental|new age|lounge|dubstep|footwork|drum and bass/i],
  ['world', /reggae|\bdub\b|ska|bossa|mpb|brazil|latin|afro|world|tropical|samba|highlife/i],
  ['rock', /rock|alternative|punk|indie|grunge|metal|folk|singer|blues|country|americana/i],
];

/** First matching family across Apple genres (most common first), then MusicBrainz genres. */
export function familyOf(genres: string[]): Family {
  for (const g of genres) for (const [fam, re] of RULES) if (re.test(g)) return fam;
  return 'other';
}
