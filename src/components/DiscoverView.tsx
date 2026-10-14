import { useMemo, useState } from 'react';
import { KIND_LABEL, suggestions } from '../lib/graph';
import type { EdgeKind } from '../lib/mb';
import type { StoreState } from '../lib/store';
import ArtistLink from './ArtistLink';

/** Artists you don't have, ranked by how tightly they're woven into what you do. */
export default function DiscoverView({ store }: { store: StoreState }) {
  const ix = store.index;
  const [kind, setKind] = useState<EdgeKind | 'all'>('all');
  const all = useMemo(() => suggestions(ix, { limit: 400 }), [ix, store.version]);
  const list = kind === 'all' ? all : all.filter((s) => s.via.some((v) => v.conn.kind === kind));
  const kinds = [...new Set(all.flatMap((s) => s.via.map((v) => v.conn.kind)))];

  return (
    <div className="page discover">
      <header className="lib-head">
        <h1>One step away</h1>
        <p className="meta">
          Artists who aren’t in your library but played with, produced, or belong to artists who are. The more of your
          music they touch, the higher they rank.
        </p>
      </header>
      {kinds.length > 1 && (
        <div className="seg" role="tablist">
          <button className={kind === 'all' ? 'on' : ''} onClick={() => setKind('all')}>All</button>
          {kinds.map((k) => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
          ))}
        </div>
      )}
      {!list.length && <p className="muted">The connection graph is still being built. Check back soon.</p>}
      <ol className="discover-list">
        {list.slice(0, 150).map((s, i) => (
          <li key={s.id} className="discover-row">
            <span className="rank">{i + 1}</span>
            <div>
              <ArtistLink ix={ix} id={s.id} />
              <ul className="via">
                {s.via.slice(0, 4).map((v) => (
                  <li key={v.id}>
                    <ArtistLink ix={ix} id={v.id} /> <span className="muted">{v.conn.labels[0]}</span>
                  </li>
                ))}
                {s.via.length > 4 && <li className="muted small">and {s.via.length - 4} more of your artists</li>}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
