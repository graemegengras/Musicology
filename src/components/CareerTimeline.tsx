import { useMemo } from 'react';
import type { LibraryArtist } from '../lib/appleLibrary';
import { careerSpan } from '../lib/careers';
import type { Connection, GraphIndex } from '../lib/graph';
import { go, href, replace } from '../lib/router';

interface Props {
  ix: GraphIndex;
  id: string;
  connections: Connection[];
  libArtist?: LibraryArtist;
  max?: number;
}

interface Mark {
  year: number;
  title: string;
  albumId?: string;
}

/**
 * The artist's career on a year axis, with one row per connection showing when
 * their paths crossed: membership years as a band, shared records as dots.
 */
export default function CareerTimeline({ ix, id, connections, libArtist, max = 28 }: Props) {
  const centre = careerSpan(ix, id, libArtist);

  const rows = useMemo(() => {
    const all = connections
      .map((c) => {
        const marks: Mark[] = [...c.albums]
          .map((aid) => ix.albums.get(aid))
          .filter((a): a is NonNullable<typeof a> => Boolean(a?.year))
          .map((a) => ({ year: a.year!, title: a.title, albumId: a.id }));
        const band = c.begin ? { from: c.begin, to: c.end ?? c.begin } : null;
        const first = Math.min(...marks.map((m) => m.year), band?.from ?? Infinity);
        return { c, marks, band, span: careerSpan(ix, c.id), first };
      })
      .filter((r) => Number.isFinite(r.first) || r.span);
    // Keep your artists and the longest-running ties; one-off session players
    // on a single record would otherwise crowd everything out.
    const weight = (r: (typeof all)[number]) =>
      (ix.artists[r.c.id]?.lib ? 100 : 0) + (r.band ? 50 : 0) + r.marks.length * 10 + (r.c.kind === 'credit' ? 0 : 20);
    const start = (r: (typeof all)[number]) => (Number.isFinite(r.first) ? r.first : r.span!.start);
    return [...all]
      .sort((a, b) => weight(b) - weight(a))
      .slice(0, max)
      .sort((a, b) => start(a) - start(b));
  }, [connections, ix, max]);

  const years = [
    ...(centre ? [centre.start, centre.end] : []),
    ...rows.flatMap((r) => [...r.marks.map((m) => m.year), ...(r.band ? [r.band.from, r.band.to] : [])]),
  ];
  if (years.length < 2) return <p className="muted">Not enough dates on MusicBrainz to place this artist in time yet.</p>;
  const y0 = Math.floor((Math.min(...years) - 2) / 5) * 5;
  const y1 = Math.ceil((Math.max(...years) + 2) / 5) * 5;
  const pct = (y: number) => `${((y - y0) / (y1 - y0)) * 100}%`;
  const ticks: number[] = [];
  const step = y1 - y0 > 50 ? 10 : 5;
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) ticks.push(y);

  const centreAlbums = (ix.discographies[id] ?? []).filter(([, , y, type]) => y && (type === 'Album' || type === 'EP'));

  return (
    <div className="career">
      <div className="career-row career-axis">
        <span />
        <div className="career-track">
          {ticks.map((y) => (
            <span key={y} className="career-tick" style={{ left: pct(y) }}>{y}</span>
          ))}
        </div>
      </div>
      <div className="career-row career-centre">
        <span className="career-name">{ix.artists[id]?.name}</span>
        <div className="career-track">
          {ticks.map((y) => <i key={y} className="career-grid" style={{ left: pct(y) }} />)}
          {centre && <span className="career-span" style={{ left: pct(centre.start), width: `calc(${pct(centre.end)} - ${pct(centre.start)})` }} />}
          {centreAlbums.map(([aid, title, y]) => (
            <button
              key={aid}
              className={`career-album ${ix.libraryAlbums[aid] !== undefined ? 'mine' : ''}`}
              style={{ left: pct(y!) }}
              title={`${title} (${y})`}
              aria-label={`${title}, ${y}`}
              onClick={() => replace({ view: 'artist', id, album: aid })}
            />
          ))}
        </div>
      </div>
      {rows.map(({ c, marks, band, span }) => {
        const a = ix.artists[c.id];
        return (
          <div key={c.id} className={`career-row k-${c.kind}`}>
            <a className={`career-name ${a?.lib ? 'mine' : 'new'}`} href={href({ view: 'artist', id: c.id })} title={c.labels.join('\n')}>
              <span className="lib-dot" aria-hidden="true" />
              {a?.name}
            </a>
            <div className="career-track">
              {ticks.map((y) => <i key={y} className="career-grid" style={{ left: pct(y) }} />)}
              {span && (
                <span className="career-span faint" style={{ left: pct(Math.max(span.start, y0)), width: `calc(${pct(Math.min(span.end, y1))} - ${pct(Math.max(span.start, y0))})` }} />
              )}
              {band && (
                <span className="career-band" style={{ left: pct(band.from), width: `max(6px, calc(${pct(band.to)} - ${pct(band.from)}))` }} title={c.labels[0]} />
              )}
              {marks.map((m) => (
                <button
                  key={`${m.albumId}-${m.year}`}
                  className="career-mark"
                  style={{ left: pct(m.year) }}
                  title={`${m.title} (${m.year})`}
                  aria-label={`${m.title}, ${m.year}`}
                  onClick={() => {
                    if (!m.albumId) return;
                    const owner = ix.albums.get(m.albumId)?.owner ?? id;
                    (owner === id ? replace : go)({ view: 'artist', id: owner, album: m.albumId });
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      {connections.length > rows.length && <p className="muted small">Showing {rows.length} of {connections.length} connections, earliest first.</p>}
    </div>
  );
}
