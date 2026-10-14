import { useEffect, useRef, useState } from 'react';
import { TOURS } from '../data/tours';

export default function ToursMenu({ onStart }: { onStart: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="menu" ref={root}>
      <button className="btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Tours ▾
      </button>
      {open && (
        <ul className="menu-list">
          {TOURS.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => {
                  setOpen(false);
                  onStart(t.id);
                }}
              >
                <strong>{t.title}</strong>
                <span className="muted small">{t.blurb}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
