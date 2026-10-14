import type { Era } from '../data/types';
import { formatSpan } from './timeScale';

export interface QuizQuestion {
  kind: 'which-first' | 'whose-figure' | 'influence';
  prompt: string;
  choices: { label: string; eraId: string }[];
  answerEraId: string;
  explanation: string;
}

export type Rng = () => number;

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: T[], n: number, rng: Rng): T[] {
  return shuffle(arr, rng).slice(0, n);
}

function whichFirst(eras: Era[], rng: Rng): QuizQuestion {
  // Require a clear gap so the answer isn't a coin toss.
  let a: Era, b: Era;
  do {
    [a, b] = sample(eras, 2, rng);
  } while (Math.abs(a.start - b.start) < 12);
  const first = a.start < b.start ? a : b;
  return {
    kind: 'which-first',
    prompt: 'Which emerged first?',
    choices: shuffle([a, b], rng).map((e) => ({ label: e.title, eraId: e.id })),
    answerEraId: first.id,
    explanation: `${a.title}: ${formatSpan(a.start, a.end)}. ${b.title}: ${formatSpan(b.start, b.end)}.`,
  };
}

function whoseFigure(eras: Era[], rng: Rng): QuizQuestion {
  const era = pick(eras.filter((e) => e.keyFigures.length > 0), rng);
  const figure = pick(era.keyFigures, rng);
  // Distractors must not also list this figure (e.g. Ray Charles is in two eras).
  const others = sample(
    eras.filter((e) => e.id !== era.id && !e.keyFigures.includes(figure)),
    3,
    rng,
  );
  return {
    kind: 'whose-figure',
    prompt: `${figure} is a key figure in…`,
    choices: shuffle([era, ...others], rng).map((e) => ({ label: e.title, eraId: e.id })),
    answerEraId: era.id,
    explanation: `${figure} belongs to ${era.title} (${formatSpan(era.start, era.end)}, ${era.region}).`,
  };
}

function influence(eras: Era[], rng: Rng): QuizQuestion {
  const era = pick(eras.filter((e) => e.influences.length > 0), rng);
  const parentId = pick(era.influences, rng);
  const parent = eras.find((e) => e.id === parentId)!;
  // Plausible distractors: other eras that already existed, but weren't direct parents.
  const pool = eras.filter((e) => e.id !== era.id && !era.influences.includes(e.id) && e.start < era.end);
  if (pool.length < 2) return whichFirst(eras, rng);
  const others = sample(pool, 3, rng);
  return {
    kind: 'influence',
    prompt: `Which of these directly fed into ${era.title}?`,
    choices: shuffle([parent, ...others], rng).map((e) => ({ label: e.title, eraId: e.id })),
    answerEraId: parent.id,
    explanation: `${era.title} grew out of ${era.influences
      .map((id) => eras.find((e) => e.id === id)?.title)
      .join(', ')}.`,
  };
}

export function makeQuestion(eras: Era[], rng: Rng = Math.random): QuizQuestion {
  const r = rng();
  if (r < 0.34) return whichFirst(eras, rng);
  if (r < 0.67) return whoseFigure(eras, rng);
  return influence(eras, rng);
}

/** Small deterministic PRNG for tests. */
export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
