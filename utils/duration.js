const DURATION_UNITS_MS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMilliseconds(value) {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) {
    throw new Error('Duration must be a number followed by s, m, h, or d');
  }

  const [, amount, unit] = match;
  return Number(amount) * DURATION_UNITS_MS[unit];
}
