const DEFAULT_LOOKBACK_HOURS = 26;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export function isWithinRecentHours(date: Date, hours = DEFAULT_LOOKBACK_HOURS): boolean {
  const time = date.getTime();
  if (!Number.isFinite(time)) return false;

  const now = Date.now();
  return time >= now - hours * 60 * 60 * 1000 && time <= now + FUTURE_SKEW_MS;
}
