// Weekly house stats reset at Monday 00:00 in Singapore. Singapore has no daylight
// saving, so a fixed offset is exact and needs no time-zone database.
const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function weekStart(now = new Date()) {
  const local = new Date(now.getTime() + SGT_OFFSET_MS); // UTC fields now read as SGT
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - daysSinceMonday * DAY_MS - SGT_OFFSET_MS);
}
