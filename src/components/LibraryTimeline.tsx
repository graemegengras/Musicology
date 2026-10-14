import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FAMILIES, careerSpan, familyOf, type Family, type Span } from '../lib/careers';
import { connectionsOf } from '../lib/graph';
import { go, href } from '../lib/router';
import type { StoreState } from '../lib/store';
import { useDragPan } from '../lib/useDragPan';

/**
 * Your library through time: each artist is a bar across the years they made
 * records, in lanes by family of music. Select one to draw its connections.
 */

const PAD_X = 150;
const PAD_RIGHT = 120;
const AXIS_H = 40;
const ROW_H = 30;
const BAR_H = 22;
const LANE_PAD = 10;
const CHAR_PX = 7;
const SIZES = [150, 300, 600, 1200] as const;

interface Item {
  key: string;
  /** MusicBrainz id when the artist is mapped. */
  id: string | null;
  name: string;
  plays: number;
  family: Family;
  span: Span;
}

interface Placed extends Item {
  x: number;
  w: number;
  spanW: number;
  y: number;
}

export default function LibraryTimeline({ store }: { store: StoreState }) {
  const [count, setCount] = useState<(typeof SIZES)[number]>(300);
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const anchor = useRef<{ year: number; offset: number } | null>(null);
  useDragPan(scroller);

  const ix = store.index;
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const a of store.library?.artists ?? []) {
      if (a.tracks === 0) continue;
      const id = store.resolved[a.name] ?? null;
      const span = careerSpan(ix, id, a);
      if (!span) continue;
      const genres = [...a.genres, ...(id ? ix.artists[id]?.genres ?? [] : [])];
      out.push({ key: id ?? `lib:${a.name}`, id, name: a.name, plays: a.plays, family: familyOf(genres), span });
      if (out.length >= count) break;
    }
    return out;
  }, [store.library, store.resolved, ix, count, store.version]);

  const y0 = useMemo(() => Math.max(1900, Math.floor(Math.min(1950, ...items.map((i) => i.span.start)) / 10) * 10), [items]);
  const y1 = new Date().getFullYear() + 1;
  const ppy = 26 * zoom;
  const xOf = (year: number) => PAD_X + (year - y0) * ppy;

  const { lanes, placed, height } = useMemo(() => {
    const placed: Placed[] = [];
    const lanes: { id: Family; label: string; color: string; top: number; height: number }[] = [];
    let top = AXIS_H;
    for (const fam of FAMILIES) {
      const mine = items.filter((i) => i.family === fam.id).sort((a, b) => a.span.start - b.span.start || b.plays - a.plays);
      if (!mine.length) continue;
      const rowEnds: number[] = [];
      for (const it of mine) {
        const x = xOf(it.span.start);
        const spanW = Math.max((it.span.end - it.span.start) * ppy, 6);
        const w = Math.max(spanW, it.name.length * CHAR_PX + 18);
        let row = rowEnds.findIndex((end) => end + 6 <= x);
        if (row === -1) row = rowEnds.push(0) - 1;
        rowEnds[row] = x + w;
        placed.push({ ...it, x, w, spanW, y: top + LANE_PAD + row * ROW_H });
      }
      const h = rowEnds.length * ROW_H + LANE_PAD * 2;
      lanes.push({ ...fam, top, height: h });
      top += h;
    }
    return { lanes, placed, height: top };
    // xOf depends on y0 and ppy
  }, [items, y0, ppy]);

  const width = xOf(y1) + PAD_RIGHT;
  const maxPlays = Math.max(1, ...items.map((i) => i.plays));
  const byKey = useMemo(() => new Map(placed.map((p) => [p.key, p])), [placed]);

  // Connections from the selected artist to others on the chart.
  const sel = selected ? byKey.get(selected) : null;
  const links = useMemo(() => {
    if (!sel?.id) return [];
    return connectionsOf(ix, sel.id)
      .map((c) => ({ c, p: byKey.get(c.id) }))
      .filter((x): x is { c: (typeof x)['c']; p: Placed } => Boolean(x.p));
  }, [sel, ix, byKey]);
  const related = new Set(links.map((l) => l.p.key));

  const changeZoom = (z: number) => {
    const el = scroller.current;
    const next = Math.min(3, Math.max(0.4, z));
    if (!el || next === zoom) return;
    anchor.current = { year: y0 + (el.scrollLeft + el.clientWidth / 2 - PAD_X) / ppy, offset: el.clientWidth / 2 };
    setZoom(next);
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && anchor.current) {
      el.scrollLeft = xOf(anchor.current.year) - anchor.current.offset;
      anchor.current = null;
    }
  }, [zoom]);

  // Open on the last few decades, where most libraries live.
  const opened = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el || opened.current || !placed.length) return;
    opened.current = true;
    el.scrollLeft = Math.max(0, xOf(1965) - PAD_X);
  }, [placed.length]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelected(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (store.status !== 'ready') return <p className="page muted">Loading your library…</p>;

  const decades: number[] = [];
  for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += zoom >= 1.6 ? 5 : 10) decades.push(y);

  return (
    <div className="ltl">
      <div className="genres-tools">
        <span className="muted small">Your top</span>
        <div className="seg" role="tablist" aria-label="How many artists">
          {SIZES.map((n) => (
            <button key={n} className={count === n ? 'on' : ''} onClick={() => setCount(n)}>{n}</button>
          ))}
        </div>
        <span className="muted small">artists by plays · bars run from first to latest album</span>
      </div>
      <div className="timeline">
        <div className="zoom-controls" role="group" aria-label="Zoom">
          <button onClick={() => changeZoom(zoom / 1.4)} aria-label="Zoom out" disabled={zoom <= 0.4}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => changeZoom(zoom * 1.4)} aria-label="Zoom in" disabled={zoom >= 3}>+</button>
        </div>
        <div className="timeline-scroll" ref={scroller} onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="timeline-canvas" style={{ width, height }} onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
            <div className="axis" style={{ width }}>
              {decades.map((y) => (
                <div key={y} className={`tick ${y % 10 === 0 ? 'major' : ''}`} style={{ left: xOf(y) }}>
                  {y % 10 === 0 && <span>{y}s</span>}
                </div>
              ))}
            </div>
            {lanes.map((l) => (
              <div key={l.id} className="lane" style={{ top: l.top, height: l.height, width, ['--lane' as string]: l.color }}>
                <div className="lane-label">{l.label}</div>
              </div>
            ))}
            <svg className="edges" width={width} height={height} aria-hidden="true">
              {sel &&
                links.map(({ c, p }) => {
                  // Anchor each line at the year the connection happened when we know it.
                  const year = connectionYear(ix, c, p.span, sel.span);
                  const fx = Math.min(Math.max(xOf(year), sel.x), sel.x + sel.spanW);
                  const tx = Math.min(Math.max(xOf(year), p.x), p.x + p.spanW);
                  const fy = sel.y + BAR_H / 2;
                  const ty = p.y + BAR_H / 2;
                  const dy = (ty - fy) / 2;
                  return (
                    <path
                      key={p.key}
                      d={`M${fx},${fy} C${fx},${fy + dy} ${tx},${ty - dy} ${tx},${ty}`}
                      className={`ltl-edge k-${c.kind}`}
                    />
                  );
                })}
            </svg>
            {placed.map((p) => {
              const fam = FAMILIES.find((f) => f.id === p.family)!;
              const strength = 0.25 + 0.6 * (Math.log(1 + p.plays) / Math.log(1 + maxPlays));
              const faded = sel && p.key !== sel.key && !related.has(p.key);
              return (
                <button
                  key={p.key}
                  className={`ltl-bar ${p.key === selected ? 'selected' : ''} ${faded ? 'faded' : ''} ${related.has(p.key) ? 'related' : ''}`}
                  style={{ left: p.x, top: p.y, width: p.w, ['--lane' as string]: fam.color, ['--a' as string]: strength }}
                  onClick={() => setSelected(p.key === selected ? null : p.key)}
                  onDoubleClick={() => (p.id ? go({ view: 'artist', id: p.id }) : go({ view: 'search', q: p.name }))}
                  title={`${p.name}: ${p.span.start}–${p.span.end} · ${p.plays.toLocaleString()} plays`}
                >
                  <span className="ltl-span" style={{ width: p.spanW }}>
                    {p.span.albumYears.map((y) => (
                      <i key={y} className="ltl-album" style={{ left: (y - p.span.start) * ppy }} />
                    ))}
                  </span>
                  <span className="ltl-label">{p.name}</span>
                </button>
              );
            })}
          </div>
        </div>
        {sel && (
          <aside className="ltl-card" aria-live="polite">
            <button className="close" onClick={() => setSelected(null)} aria-label="Clear selection">×</button>
            <p className="eyebrow">{FAMILIES.find((f) => f.id === sel.family)?.label} · {sel.span.start}–{sel.span.end}</p>
            <h2>{sel.name}</h2>
            <p className="muted small">{sel.plays.toLocaleString()} plays · {sel.span.albumYears.length} albums on the chart</p>
            {sel.id ? (
              links.length ? (
                <p className="small">
                  Connected here to{' '}
                  {links.slice(0, 6).map((l, i) => (
                    <span key={l.p.key}>
                      {i > 0 && ', '}
                      <button className="linkish" onClick={() => setSelected(l.p.key)}>{l.p.name}</button>
                    </span>
                  ))}
                  {links.length > 6 && ` and ${links.length - 6} more`}
                </p>
              ) : (
                <p className="muted small">No connections to other artists on this chart yet.</p>
              )
            ) : (
              <p className="muted small">Not mapped on MusicBrainz yet.</p>
            )}
            <a className="btn primary small" href={sel.id ? href({ view: 'artist', id: sel.id }) : href({ view: 'search', q: sel.name })}>
              Open artist →
            </a>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Best guess at when two artists' paths crossed. */
function connectionYear(ix: StoreState['index'], c: ReturnType<typeof connectionsOf>[number], a: Span, b: Span): number {
  if (c.begin) return c.begin;
  const years = [...c.albums].map((id) => ix.albums.get(id)?.year).filter((y): y is number => !!y);
  if (years.length) return Math.min(...years);
  // Otherwise, where their careers overlap.
  return Math.round((Math.max(a.start, b.start) + Math.min(a.end, b.end)) / 2);
}
