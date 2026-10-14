import { useEffect, useState } from 'react';
import { ERAS } from '../data/eras';
import { makeQuestion, type QuizQuestion } from '../lib/quiz';

const BEST_KEY = 'musicology.quiz.best';

function readBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

interface Props {
  onClose: () => void;
  onExplore: (eraId: string) => void;
}

export default function Quiz({ onClose, onExplore }: Props) {
  const [q, setQ] = useState<QuizQuestion>(() => makeQuestion(ERAS));
  const [picked, setPicked] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [best, setBest] = useState(readBest);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const answer = (eraId: string) => {
    if (picked) return;
    setPicked(eraId);
    const right = eraId === q.answerEraId;
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    const nextStreak = right ? streak + 1 : 0;
    setStreak(nextStreak);
    if (nextStreak > best) {
      setBest(nextStreak);
      try {
        localStorage.setItem(BEST_KEY, String(nextStreak));
      } catch {
        /* ignore */
      }
    }
  };

  const next = () => {
    setQ(makeQuestion(ERAS));
    setPicked(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal quiz" role="dialog" aria-label="Quiz" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close quiz">×</button>
        <p className="eyebrow">
          Quiz · {score.right}/{score.total} · streak {streak} · best {best}
        </p>
        <h2>{q.prompt}</h2>
        <ul className="choices">
          {q.choices.map((c) => {
            const state = !picked ? '' : c.eraId === q.answerEraId ? 'right' : c.eraId === picked ? 'wrong' : 'dim';
            return (
              <li key={c.eraId}>
                <button className={`choice ${state}`} onClick={() => answer(c.eraId)} disabled={!!picked}>
                  {c.label}
                </button>
              </li>
            );
          })}
        </ul>
        {picked && (
          <div className="quiz-feedback">
            <p>
              <strong>{picked === q.answerEraId ? 'Correct.' : 'Not quite.'}</strong> {q.explanation}
            </p>
            <div className="quiz-actions">
              <button className="btn" onClick={() => onExplore(q.answerEraId)}>Explore this era</button>
              <button className="btn primary" onClick={next} autoFocus>Next question →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
