import type { FamilyScenario } from "../types/drills";
import { FAMILY_SCENARIOS } from "./familyScenarios";

export const SOLO_COUNT = { min: 5, max: 10, default: 5 } as const;

const BY_ID = new Map(FAMILY_SCENARIOS.map((s) => [s.id, s]));

export function scenarioById(id: number): FamilyScenario | undefined {
  return BY_ID.get(id);
}

/** `count` distinct scenarios in random order, capped at the pool size. */
export function pickScenarios(count: number, random = Math.random): FamilyScenario[] {
  const pool = [...FAMILY_SCENARIOS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}
