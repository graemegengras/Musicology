import type { Availability } from '../data/types';

const LABEL: Record<Availability, string> = {
  spotify: 'On Spotify',
  partial: 'Partly on Spotify: key music lives elsewhere',
  unavailable: 'Not on Spotify',
};

export default function AvailabilityDot({ availability }: { availability: Availability }) {
  return <span className={`avail avail-${availability}`} title={LABEL[availability]} aria-label={LABEL[availability]} />;
}

export function availabilityText(a: Availability): string {
  return LABEL[a];
}
