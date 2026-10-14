import type { EdgeKind } from '../lib/mb.ts';

export interface GraphArtist {
  name: string;
  type?: string;
  /** Name as it appears in the Apple Music library, if it's there. */
  lib?: string;
  plays?: number;
  area?: string;
  begin?: number;
  end?: number;
  disambiguation?: string;
  genres?: string[];
  wikidata?: string;
  /** Spotify artist id, when MusicBrainz knows it. */
  spotify?: string;
}

/** [from, to, kind, label (from's point of view), beginYear, endYear] */
export type GraphLink = [string, string, EdgeKind, string, number | null, number | null];

/** [releaseGroupId, title, year, type, creditLine (only when not just this artist)] */
export type DiscographyEntry = [string, string, number | null, string, string | null];

export interface GraphData {
  builtAt: string;
  /** Library artist name → MusicBrainz id (null when it couldn't be resolved). */
  library: Record<string, string | null>;
  artists: Record<string, GraphArtist>;
  links: GraphLink[];
  /** Albums and EPs for each resolved library artist. */
  discographies: Record<string, DiscographyEntry[]>;
  /** Release groups in the library → total plays. */
  libraryAlbums: Record<string, number>;
}

/** releaseGroupId → [artistId, roles, trackCount][] */
export type CreditsData = Record<string, [string, string, number][]>;
