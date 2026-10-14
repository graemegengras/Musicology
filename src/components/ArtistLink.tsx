import type { GraphIndex } from '../lib/graph';
import { href } from '../lib/router';

interface Props {
  ix: GraphIndex;
  id: string;
  /** Shown under the name, e.g. "bass guitar on Black Messiah". */
  detail?: string;
  chip?: boolean;
}

/** An artist name that links to its page, marked when it's in your library. */
export default function ArtistLink({ ix, id, detail, chip }: Props) {
  const a = ix.artists[id];
  const mine = Boolean(a?.lib);
  return (
    <a
      className={`artist-link ${chip ? 'chip' : ''} ${mine ? 'mine' : 'new'}`}
      href={href({ view: 'artist', id })}
      title={mine ? `In your library · ${a?.plays ?? 0} plays` : 'Not in your library yet'}
    >
      <span className="lib-dot" aria-hidden="true" />
      <span className="artist-link-text">
        <span className="artist-link-name">{a?.name ?? 'Unknown artist'}</span>
        {detail && <span className="artist-link-detail">{detail}</span>}
      </span>
    </a>
  );
}
