export type LaneId =
  | 'tech'
  | 'art'
  | 'roots'
  | 'blues-jazz'
  | 'rnb'
  | 'rock'
  | 'electronic'
  | 'hiphop';

export interface Lane {
  id: LaneId;
  label: string;
  color: string;
}

export type SpotifyKind = 'track' | 'album' | 'artist' | 'playlist';

export interface SpotifyRef {
  kind: SpotifyKind;
  id: string;
}

/** A single thing you can listen to (or read about, if no recording exists). */
export interface Listen {
  title: string;
  performer?: string;
  year?: string;
  /** Exact Spotify item to play. */
  spotify?: SpotifyRef;
  /** The recording isn't on Spotify (unreleased, lost, archive-only, or withheld). */
  notOnSpotify?: boolean;
  /** Why this matters, or why it isn't on Spotify. */
  note?: string;
}

/**
 * How much of an era's essential music is on Spotify.
 * - spotify: the core repertoire is there
 * - partial: some is, but important material lives elsewhere
 * - unavailable: the defining music was never released, never recorded, or predates recording
 */
export type Availability = 'spotify' | 'partial' | 'unavailable';

export interface ExternalLink {
  label: string;
  url: string;
}

export interface Era {
  id: string;
  title: string;
  lane: LaneId;
  /** Years; negative = BCE. */
  start: number;
  end: number;
  region: string;
  summary: string;
  keyFigures: string[];
  /** Ids of eras this one grew out of. */
  influences: string[];
  listen: Listen[];
  availability: Availability;
  availabilityNote?: string;
  links: ExternalLink[];
}

export interface TourStep {
  eraId: string;
  note: string;
}

export interface Tour {
  id: string;
  title: string;
  blurb: string;
  steps: TourStep[];
}
