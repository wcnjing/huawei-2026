import type { FamilyMember } from "../types/family";

export const FAMILY_MEMBERS: FamilyMember[] = [
  { id: "grandma", name: "GRANDMA", role: "ELDER GUARDIAN", level: 12, xp: 3800, xpMax: 4000, streak: 24, timesSafe: 89, timesScammed: 1, safeThisWeek: true, recentDrillResult: "WON", primaryColor: "#c77dff", roomName: "GRANDMA'S ROOM", roomBg: "#100c20", badgeCount: 7, badgeTotal: 9, coins: 1240 },
  { id: "mum", name: "MUM", role: "SHIELD BEARER", level: 9, xp: 2100, xpMax: 2500, streak: 16, timesSafe: 67, timesScammed: 2, safeThisWeek: true, recentDrillResult: "WON", primaryColor: "#00ff88", roomName: "MUM'S ROOM", roomBg: "#0c1a10", badgeCount: 5, badgeTotal: 9, coins: 850 },
  { id: "dad", name: "DAD", role: "ROOKIE", level: 4, xp: 890, xpMax: 1200, streak: 0, timesSafe: 23, timesScammed: 7, safeThisWeek: false, recentDrillResult: "LOST", primaryColor: "#4ecdc4", roomName: "DAD'S ROOM", roomBg: "#081420", badgeCount: 2, badgeTotal: 9, coins: 0 },
  { id: "kid", name: "KID", role: "TRAINEE", level: 3, xp: 450, xpMax: 800, streak: 5, timesSafe: 12, timesScammed: 3, safeThisWeek: true, recentDrillResult: "WON", primaryColor: "#ffe66d", roomName: "KID'S ROOM", roomBg: "#161408", badgeCount: 3, badgeTotal: 9, coins: 300 },
];

export const MEMBER_MAP = Object.fromEntries(FAMILY_MEMBERS.map(m => [m.id, m]));

// Pixi — the AI coach. Not a real family member; synthetic entry for chat rendering.
export const PIXI_MEMBER = {
  id: "pixi",
  name: "PIXI",
  primaryColor: "#00d4ff",
};

export const FAMILY_NAME_TO_ID: Record<string, string> = {
  "Grandma": "grandma",
  "Mum": "mum",
  "Dad": "dad",
  "Kid": "kid",
};