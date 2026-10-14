import type { Era, LaneId } from '../data/types';
import { yearToX } from './timeScale';

export interface PlacedEra {
  era: Era;
  x: number;
  /** Width of the actual time span. */
  spanWidth: number;
  /** Width reserved for the card (at least wide enough for its label). */
  width: number;
  row: number;
}

export interface LaneLayout {
  lane: LaneId;
  rows: number;
  items: PlacedEra[];
}

const CHAR_PX = 7.2;
const LABEL_PAD = 26;
const GAP = 6;

export function labelWidth(title: string): number {
  return Math.ceil(title.length * CHAR_PX + LABEL_PAD);
}

/** Greedy interval packing: each era goes in the first row it fits in. */
export function layoutLane(lane: LaneId, eras: Era[], zoom: number): LaneLayout {
  const sorted = eras.filter((e) => e.lane === lane).sort((a, b) => a.start - b.start || b.end - a.end);
  const rowEnds: number[] = [];
  const items: PlacedEra[] = [];
  for (const era of sorted) {
    const x = yearToX(era.start, zoom);
    const spanWidth = Math.max(yearToX(era.end, zoom) - x, 4);
    const width = Math.max(spanWidth, labelWidth(era.title));
    let row = rowEnds.findIndex((end) => end + GAP <= x);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(0);
    }
    rowEnds[row] = x + width;
    items.push({ era, x, spanWidth, width, row });
  }
  return { lane, rows: Math.max(rowEnds.length, 1), items };
}
