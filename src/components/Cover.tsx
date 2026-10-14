import { useState } from 'react';
import { coverUrl } from '../lib/mb';

/** Album art from the Cover Art Archive, with a typographic fallback when there is none. */
export default function Cover({ id, title, size = 250 }: { id: string; title: string; size?: 250 | 500 }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <span className="cover cover-fallback" aria-hidden="true">
        {title.slice(0, 1)}
      </span>
    );
  return <img className="cover" src={coverUrl(id, size)} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
