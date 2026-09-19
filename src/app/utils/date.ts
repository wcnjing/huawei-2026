export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Payday is a Sunday event, so use the local Sunday that begins the current week.
// This avoids UTC rollover allowing a second claim near midnight in Singapore.
export function localWeekKey(date = new Date()): string {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return localDateKey(sunday);
}

export function formatNotifTimestamp(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60) return "JUST NOW";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}H AGO`;
  const days = Math.floor(hrs / 24);
  return `${days}D AGO`;
}