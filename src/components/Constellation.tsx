import { useMemo, useState } from 'react';
import type { Connection, GraphIndex } from '../lib/graph';
import { KIND_LABEL } from '../lib/graph';
import type { EdgeKind } from '../lib/mb';
import { go } from '../lib/router';

interface Props {
  ix: GraphIndex;
  id: string;
  connections: Connection[];
  max?: number;
}

const W = 860;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const RX = 300;
const RY = 255;

const KIND_ORDER: EdgeKind[] = ['member', 'collab', 'feat', 'support', 'family', 'credit'];

/**
 * The selected artist in the middle, its connections around it, grouped by
 * kind of tie. Artists from your library are filled in; new ones are hollow.
 */
export default function Constellation({ ix, id, connections, max = 40 }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const nodes = useMemo(() => {
    // Keep a mix: every library connection that fits, then the strongest new ones.
    const mine = connections.filter((c) => ix.artists[c.id]?.lib);
    const rest = connections.filter((c) => !ix.artists[c.id]?.lib);
    const picked = [...mine.slice(0, Math.ceil(max * 0.6)), ...rest].slice(0, max);
    picked.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    // Two columns of evenly spaced rows (right side top→bottom, then left side
    // bottom→top) bent around an ellipse. Even vertical spacing keeps labels apart.
    const n = picked.length;
    const right = Math.ceil(n / 2);
    return picked.map((c, i) => {
      const onRight = i < right;
      const k = onRight ? i : i - right;
      const count = onRight ? right : n - right;
      const t = count === 1 ? 0 : -1 + (2 * (k + 0.5)) / count; // -1 … 1, top to bottom
      const ty = onRight ? t : -t;
      const y = CY + RY * ty;
      const bulge = 0.3 + 0.7 * Math.sqrt(Math.max(0, 1 - ty * ty));
      const x = CX + (onRight ? 1 : -1) * RX * bulge;
      const plays = ix.artists[c.id]?.plays ?? 0;
      return { c, x, y, angle: onRight ? 0 : Math.PI, r: ix.artists[c.id]?.lib ? 5 + Math.min(6, Math.log2(1 + plays) / 1.5) : 5 };
    });
  }, [connections, ix, max]);

  const centre = ix.artists[id];
  const hidden = connections.length - nodes.length;
  const kindsShown = [...new Set(nodes.map((n) => n.c.kind))];

  if (!nodes.length) return null;

  return (
    <figure className="constellation">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Connections of ${centre?.name}`}>
        {nodes.map(({ c, x, y }) => (
          <path
            key={`e-${c.id}`}
            d={`M${CX},${CY} Q${(CX + x) / 2 + (y - CY) * 0.08},${(CY + y) / 2 - (x - CX) * 0.08} ${x},${y}`}
            className={`c-edge k-${c.kind} ${hover === c.id ? 'hot' : ''} ${hover && hover !== c.id ? 'cold' : ''}`}
          />
        ))}
        <circle cx={CX} cy={CY} r={30} className={`c-centre ${centre?.lib ? 'mine' : ''}`} />
        <text x={CX} y={CY + 50} textAnchor="middle" className="c-centre-label">
          {centre?.name}
        </text>
        {nodes.map(({ c, x, y, angle, r }) => {
          const a = ix.artists[c.id];
          const right = Math.cos(angle) >= 0;
          const name = (a?.name ?? '?').length > 22 ? `${a!.name.slice(0, 21)}…` : a?.name;
          return (
            <g
              key={c.id}
              className={`c-node k-${c.kind} ${a?.lib ? 'mine' : 'new'} ${hover && hover !== c.id ? 'cold' : ''}`}
              transform={`translate(${x},${y})`}
              onMouseEnter={() => setHover(c.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c.id)}
              onBlur={() => setHover(null)}
              onClick={() => go({ view: 'artist', id: c.id })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && go({ view: 'artist', id: c.id })}
              tabIndex={0}
              role="link"
              aria-label={`${a?.name}: ${c.labels[0]}`}
            >
              <circle r={r + 8} className="c-hit" />
              <circle r={r} className="c-dot" />
              <text x={right ? r + 6 : -r - 6} y={4} textAnchor={right ? 'start' : 'end'} className="c-label">
                {name}
              </text>
              <title>{`${a?.name}\n${c.labels.slice(0, 4).join('\n')}`}</title>
            </g>
          );
        })}
      </svg>
      <figcaption>
        <span className="legend-item"><span className="lib-dot mine" /> in your library</span>
        <span className="legend-item"><span className="lib-dot new" /> new to you</span>
        {kindsShown.map((k) => (
          <span key={k} className={`legend-item k-${k}`}><span className="legend-line" /> {KIND_LABEL[k].toLowerCase()}</span>
        ))}
        {hidden > 0 && <span className="muted">+{hidden} more below</span>}
      </figcaption>
    </figure>
  );
}
