import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ERAS, ERA_BY_ID, LANES } from '../data/eras';
import type { Era } from '../data/types';
import { layoutLane, type PlacedEra } from '../lib/layout';
import { SEGMENTS, ticks, totalWidth, xToYear, yearToX } from '../lib/timeScale';
import AvailabilityDot from './AvailabilityDot';
import { useDragPan } from '../lib/useDragPan';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  dimmed: Set<string>;
  showAllLinks: boolean;
  playingEraId?: string;
  tourIds?: string[];
}

const PAD_X = 160; // room for sticky lane labels
const PAD_RIGHT = 80;
const AXIS_H = 44;
const ROW_H = 34;
const LANE_PAD = 10;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 4;

interface Box {
  era: Era;
  left: number;
  top: number;
  spanWidth: number;
  width: number;
}

export default function Timeline({ selectedId, onSelect, dimmed, showAllLinks, playingEraId, tourIds }: Props) {
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const pendingAnchor = useRef<{ year: number; offset: number } | null>(null);

  const { lanes, boxes, height } = useMemo(() => {
    let top = AXIS_H;
    const boxes = new Map<string, Box>();
    const lanes = LANES.map((lane) => {
      const layout = layoutLane(lane.id, ERAS, zoom);
      const h = layout.rows * ROW_H + LANE_PAD * 2;
      const laneTop = top;
      layout.items.forEach((p: PlacedEra) =>
        boxes.set(p.era.id, {
          era: p.era,
          left: PAD_X + p.x,
          top: laneTop + LANE_PAD + p.row * ROW_H,
          spanWidth: p.spanWidth,
          width: p.width,
        }),
      );
      top += h;
      return { lane, top: laneTop, height: h };
    });
    return { lanes, boxes, height: top };
  }, [zoom]);

  const width = PAD_X + totalWidth(zoom) + PAD_RIGHT;

  // Zoom around the viewport centre so the reader doesn't lose their place.
  const changeZoom = (next: number) => {
    const el = scroller.current;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (!el || z === zoom) return;
    const centre = el.scrollLeft + el.clientWidth / 2 - PAD_X;
    pendingAnchor.current = { year: xToYear(centre, zoom), offset: el.clientWidth / 2 };
    setZoom(z);
  };

  useLayoutEffect(() => {
    const el = scroller.current;
    const a = pendingAnchor.current;
    if (!el || !a) return;
    el.scrollLeft = PAD_X + yearToX(a.year, zoom) - a.offset;
    pendingAnchor.current = null;
  }, [zoom]);

  // Ctrl/⌘ + wheel zooms; plain wheel scrolls.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      changeZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  useDragPan(scroller);

  // Bring the selected era into view.
  useEffect(() => {
    const el = scroller.current;
    const b = selectedId ? boxes.get(selectedId) : null;
    if (!el || !b) return;
    const visibleLeft = el.scrollLeft + PAD_X;
    // The detail drawer covers the right side on desktop (and the bottom on phones).
    const wide = window.innerWidth > 900;
    const drawerW = wide ? Math.min(400, el.clientWidth) : 0;
    const visibleRight = el.scrollLeft + el.clientWidth - drawerW;
    const visibleTop = el.scrollTop + AXIS_H;
    const visibleBottom = el.scrollTop + el.clientHeight * (wide ? 1 : 0.38);
    const inX = b.left >= visibleLeft && b.left + Math.min(b.width, 240) <= visibleRight;
    const inY = b.top >= visibleTop && b.top + ROW_H <= visibleBottom;
    if (inX && inY) return;
    el.scrollTo({
      left: inX ? el.scrollLeft : Math.max(0, b.left - PAD_X - (el.clientWidth - drawerW - PAD_X) * 0.3),
      top: inY ? el.scrollTop : Math.max(0, b.top - AXIS_H - el.clientHeight * (wide ? 0.3 : 0.1)),
      behavior: 'smooth',
    });
    // Only when the selection changes, not on zoom.
  }, [selectedId]);

  const related = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set<string>([selectedId, ...ERA_BY_ID[selectedId].influences]);
    ERAS.forEach((e) => e.influences.includes(selectedId) && ids.add(e.id));
    return ids;
  }, [selectedId]);

  const edges = useMemo(() => {
    const out: { key: string; d: string; kind: 'in' | 'out' | 'bg' }[] = [];
    for (const era of ERAS) {
      for (const parentId of era.influences) {
        const involved = selectedId === era.id || selectedId === parentId;
        if (!involved && !showAllLinks) continue;
        const from = boxes.get(parentId);
        const to = boxes.get(era.id);
        if (!from || !to) continue;
        out.push({
          key: `${parentId}->${era.id}`,
          d: curve(from, to),
          kind: selectedId === era.id ? 'in' : selectedId === parentId ? 'out' : 'bg',
        });
      }
    }
    // Draw highlighted edges last so they sit on top.
    return out.sort((a, b) => (a.kind === 'bg' ? -1 : 0) - (b.kind === 'bg' ? -1 : 0));
  }, [boxes, selectedId, showAllLinks]);

  const tourSet = tourIds ? new Set(tourIds) : null;

  return (
    <div className="timeline">
      <div className="zoom-controls" role="group" aria-label="Zoom">
        <button onClick={() => changeZoom(zoom / 1.4)} aria-label="Zoom out" disabled={zoom <= MIN_ZOOM}>−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button onClick={() => changeZoom(zoom * 1.4)} aria-label="Zoom in" disabled={zoom >= MAX_ZOOM}>+</button>
      </div>
      <div className="timeline-scroll" ref={scroller}>
        <div className="timeline-canvas" style={{ width, height }}>
          {/* Segment bands make the changing scale visible. */}
          {SEGMENTS.map((s, i) => (
            <div
              key={s.from}
              className={`segment segment-${i}`}
              style={{ left: PAD_X + yearToX(s.from, zoom), width: yearToX(s.to, zoom) - yearToX(s.from, zoom), height }}
            >
              <span className="segment-label">
                {i === 0 ? 'before recording · compressed' : 'the recording era'}
              </span>
            </div>
          ))}

          <div className="axis" style={{ width }}>
            {ticks(zoom).map((t) => (
              <div key={t.year} className={`tick ${t.major ? 'major' : ''}`} style={{ left: PAD_X + t.x }}>
                {t.major && <span>{t.year}</span>}
              </div>
            ))}
          </div>

          {lanes.map(({ lane, top, height: h }) => (
            <div key={lane.id} className="lane" style={{ top, height: h, width, ['--lane' as string]: lane.color }}>
              <div className="lane-label">{lane.label}</div>
            </div>
          ))}

          <svg className="edges" width={width} height={height} aria-hidden="true">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill="context-stroke" />
              </marker>
            </defs>
            {edges.map((e) => (
              <path key={e.key} d={e.d} className={`edge edge-${e.kind}`} markerEnd="url(#arrow)" />
            ))}
          </svg>

          {[...boxes.values()].map((b) => {
            const lane = LANES.find((l) => l.id === b.era.lane)!;
            const isSel = b.era.id === selectedId;
            const faded = (related && !related.has(b.era.id)) || dimmed.has(b.era.id) || (tourSet && !tourSet.has(b.era.id));
            return (
              <button
                key={b.era.id}
                className={`era ${isSel ? 'selected' : ''} ${faded ? 'faded' : ''} ${playingEraId === b.era.id ? 'playing' : ''}`}
                style={{ left: b.left, top: b.top, width: b.width, ['--lane' as string]: lane.color }}
                onClick={() => onSelect(b.era.id)}
                title={`${b.era.title} (${b.era.start}–${b.era.end})`}
              >
                <span className="era-span" style={{ width: b.spanWidth }} />
                <span className="era-label">
                  <AvailabilityDot availability={b.era.availability} />
                  {b.era.title}
                  {playingEraId === b.era.id && <span className="eq" aria-label="playing"><i /><i /><i /></span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function curve(from: Box, to: Box): string {
  const fy = from.top + ROW_H / 2 - 2;
  const ty = to.top + ROW_H / 2 - 2;
  // Leave the parent where it ends, or at the child's start if they overlap.
  const fx = Math.min(from.left + from.spanWidth, to.left);
  const tx = to.left;
  const dx = Math.max(40, (tx - fx) / 2);
  return `M${fx},${fy} C${fx + dx},${fy} ${tx - dx},${ty} ${tx},${ty}`;
}
