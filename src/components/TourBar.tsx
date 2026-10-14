import { ERA_BY_ID } from '../data/eras';
import type { Tour } from '../data/types';

interface Props {
  tour: Tour;
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}

export default function TourBar({ tour, step, onStep, onClose }: Props) {
  const s = tour.steps[step];
  const last = step === tour.steps.length - 1;
  return (
    <div className="tour-bar" role="region" aria-label={`Tour: ${tour.title}`}>
      <div className="tour-head">
        <span className="eyebrow">Tour · {tour.title}</span>
        <ol className="tour-dots">
          {tour.steps.map((st, i) => (
            <li key={st.eraId}>
              <button
                className={i === step ? 'current' : i < step ? 'done' : ''}
                onClick={() => onStep(i)}
                aria-label={`Stop ${i + 1}: ${ERA_BY_ID[st.eraId].title}`}
              />
            </li>
          ))}
        </ol>
        <button className="close" onClick={onClose} aria-label="End tour">×</button>
      </div>
      <p>
        <strong>{step + 1}. {ERA_BY_ID[s.eraId].title}.</strong> {s.note}
      </p>
      <div className="tour-nav">
        <button className="btn small" onClick={() => onStep(step - 1)} disabled={step === 0}>← Back</button>
        {last ? (
          <button className="btn small primary" onClick={onClose}>Finish tour</button>
        ) : (
          <button className="btn small primary" onClick={() => onStep(step + 1)}>Next →</button>
        )}
      </div>
    </div>
  );
}
