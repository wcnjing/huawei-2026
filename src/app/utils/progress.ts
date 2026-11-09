// Player progress derived from the stats the server keeps on each member
// (level, XP into that level, streak, wins, times scammed). Profile, Settings and
// the leaderboard all read from here so they can never disagree with each other.

type Stats = { level: number; xp: number; streak: number; timesSafe: number; timesScammed: number };

/** XP needed to finish level 1. Mirrors the level-up rule in server/store.js addXp. */
export const FIRST_LEVEL_XP = 500;

/** XP earned since the start: every finished level plus progress into the current one. */
export function totalXp(level: number, xp: number): number {
  let total = 0;
  let need = FIRST_LEVEL_XP;
  for (let l = 1; l < level; l++) {
    total += need;
    need = Math.round(need * 1.2);
  }
  return total + xp;
}

/** Rank title shown next to the level, rising as the player levels up. */
export function rankTitle(level: number): string {
  if (level >= 10) return "HOUSE GUARDIAN";
  if (level >= 6) return "SCAM BLOCKER";
  if (level >= 3) return "LINK INSPECTOR";
  return "WATCHER";
}

export interface Achievement { id: number; name: string; color: string; unlocked: boolean }

const ACHIEVEMENT_RULES: { name: string; color: string; earned: (s: Stats) => boolean }[] = [
  { name: "FIRST BLOCK", color: "#00ff88", earned: (s) => s.timesSafe >= 1 },
  { name: "STREAK X5", color: "#ff6b35", earned: (s) => s.streak >= 5 },
  { name: "SCAM SPOTTER", color: "#4ecdc4", earned: (s) => s.timesSafe >= 5 },
  { name: "EAGLE EYE", color: "#ffe66d", earned: (s) => s.timesSafe >= 10 },
  { name: "STREAK X10", color: "#ff6b35", earned: (s) => s.streak >= 10 },
  { name: "RISING STAR", color: "#c77dff", earned: (s) => s.level >= 5 },
  { name: "GHOST MODE", color: "#c77dff", earned: (s) => s.timesSafe >= 10 && s.timesScammed === 0 },
  { name: "VETERAN", color: "#4ecdc4", earned: (s) => s.timesSafe >= 25 },
  { name: "GRANDMASTER", color: "#ffe66d", earned: (s) => s.level >= 10 },
];

/** The badge wall for a member, unlocked from their real stats. */
export function achievementsFor(stats: Stats): Achievement[] {
  return ACHIEVEMENT_RULES.map((r, i) => ({ id: i + 1, name: r.name, color: r.color, unlocked: r.earned(stats) }));
}

/** Leaderboard order: most total XP first, then most wins. */
export function rankMembers<T extends Stats & { id: string }>(members: T[]): T[] {
  return [...members].sort(
    (a, b) => totalXp(b.level, b.xp) - totalXp(a.level, a.xp) || b.timesSafe - a.timesSafe,
  );
}

/** 1-based position of a member on the house leaderboard, or null if not in it. */
export function houseRank<T extends Stats & { id: string }>(members: T[], id: string): number | null {
  const i = rankMembers(members).findIndex((m) => m.id === id);
  return i === -1 ? null : i + 1;
}
