import { useMemo, useRef, useState } from 'react';
import { ERAS, LANES } from '../data/eras';
import { formatSpan } from '../lib/timeScale';

export default function Search({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return ERAS.map((e) => {
      const figure = e.keyFigures.find((f) => f.toLowerCase().includes(term));
      const score = e.title.toLowerCase().includes(term) ? 3 : figure ? 2 : e.region.toLowerCase().includes(term) ? 1 : 0;
      return { era: e, figure, score };
    })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.era.start - b.era.start)
      .slice(0, 8);
  }, [q]);

  const choose = (id: string) => {
    onPick(id);
    setQ('');
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="search">
      <input
        ref={input}
        type="search"
        placeholder="Search eras, artists, places…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === 'Enter' && results[active]) choose(results[active].era.id);
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="Search"
      />
      {open && results.length > 0 && (
        <ul className="search-results" role="listbox">
          {results.map((r, i) => (
            <li key={r.era.id} role="option" aria-selected={i === active}>
              <button
                className={i === active ? 'active' : ''}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r.era.id)}
                style={{ ['--lane' as string]: LANES.find((l) => l.id === r.era.lane)!.color }}
              >
                <span className="swatch" />
                <span>
                  <strong>{r.era.title}</strong>
                  <span className="muted small">
                    {r.figure ? `${r.figure} · ` : ''}{formatSpan(r.era.start, r.era.end)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
