import type { FamilyOutcome } from "../types/drills";

export const FAMILY_XP: Record<FamilyOutcome, number> = { correct: 100, cautious: 50, wrong: 25 };
export const FAMILY_COINS: Record<FamilyOutcome, number> = { correct: 30, cautious: 0, wrong: 0 };
