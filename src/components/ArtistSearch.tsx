import { useMemo, useRef, useState } from 'react';
import { normalize } from '../lib/mb';
import { go } from '../lib/router';
import type { StoreState } from '../lib/store';

/** Top-bar search: jump to an artist you know, or search MusicBrainz for anyone. */
export default function ArtistSearch({ store }: { store: StoreState }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = normalize(q);
    if (term.length < 2) return [];
    return Object.entries(store.index.artists)
      .filter(([, a]) => normalize(a.name).includes(term))
      .sort(
        ([, a], [, b]) =>
          Number(normalize(b.name).startsWith(term)) - Number(normalize(a.name).startsWith(term)) ||
          Number(Boolean(b.lib)) - Number(Boolean(a.lib)) ||
          (b.plays ?? 0) - (a.plays ?? 0),
      )
      .slice(0, 7);
  }, [q, store.index, store.version]);

  const done = () => {
    setQ('');
    setOpen(false);
    input.current?.blur();
  };
  const options = [...results.map(([id, a]) => ({ id, a })), null];

  const choose = (i: number) => {
    const o = options[i];
    if (o) go({ view: 'artist', id: o.id });
    else if (q.trim()) go({ view: 'search', q: q.trim() });
    done();
  };

  return (
    <div className="search">
      <input
        ref={input}
        id="artist-search"
        type="search"
        placeholder="Search any artist…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter') choose(active);
          if (e.key === 'Escape') done();
        }}
        aria-label="Search artists"
      />
      {open && q.trim().length >= 2 && (
        <ul className="search-results" role="listbox">
          {options.map((o, i) => (
            <li key={o?.id ?? 'mb'} role="option" aria-selected={i === active}>
              <button className={i === active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
                {o ? (
                  <>
                    <span className={`lib-dot ${o.a.lib ? 'mine' : 'new'}`} />
                    <span>
                      <strong>{o.a.name}</strong>
                      <span className="muted small">{o.a.lib ? `In your library · ${o.a.plays} plays` : 'In your map'}</span>
                    </span>
                  </>
                ) : (
                  <span>
                    <strong>Search MusicBrainz for “{q.trim()}”</strong>
                    <span className="muted small">Any artist, even if they’re not connected to your library yet</span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
