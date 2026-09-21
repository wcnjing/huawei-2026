import { AppSettings } from "../types/settings";

export const DRILL_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export const DRILL_DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// Whether a real (surprise) drill is allowed to fire at `now`, given the schedule window.
// Returns whether the window is open and, if not, a short label for when it next opens.
export function drillWindowStatus(s: AppSettings, now: Date = new Date()): { open: boolean; nextLabel: string } {
  const hhmm = (n: number) => `${String(n).padStart(2, "0")}:00`;
  const anyDay = s.drillDays.some(Boolean);
  const validRange = s.drillEndHour > s.drillStartHour;
  if (!anyDay || !validRange) return { open: false, nextLabel: "never" };
  const hour = now.getHours();
  if (s.drillDays[now.getDay()] && hour >= s.drillStartHour && hour < s.drillEndHour) {
    return { open: true, nextLabel: "" };
  }
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (!s.drillDays[d.getDay()]) continue;
    if (i === 0 && hour >= s.drillStartHour) continue; // today's window has already passed
    const dayLabel = i === 0 ? "TODAY" : i === 1 ? "TMR" : DRILL_DAY_NAMES[d.getDay()];
    return { open: false, nextLabel: `${dayLabel} ${hhmm(s.drillStartHour)}` };
  }
  return { open: false, nextLabel: "never" };
}
