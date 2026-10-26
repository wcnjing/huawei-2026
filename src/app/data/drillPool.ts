import type { FamilyScenario } from "../types/drills";
import { FAMILY_SCENARIOS } from "./familyScenarios";
import { ACTIVITIES, INTERESTS, type PresurveyResponses } from "./presurvey";

export const SOLO_COUNT = { min: 5, max: 10, default: 5 } as const;

const BY_ID = new Map(FAMILY_SCENARIOS.map((s) => [s.id, s]));

export function scenarioById(id: number): FamilyScenario | undefined {
  return BY_ID.get(id);
}

/** `count` distinct scenarios in random order, capped at the pool size. */
export function pickScenarios(count: number, random = Math.random, preferences?: PresurveyResponses): FamilyScenario[] {
  // Channels are a hard limit: an unticked SMS or email never appears. App notifications
  // belong to no channel. If that leaves nothing (every channel unticked), use them all.
  const allowed = FAMILY_SCENARIOS.filter(scenario => !preferences
    || (scenario.type !== "sms" && scenario.type !== "email")
    || preferences.channels.includes(scenario.type));
  const pool = allowed.length ? allowed : [...FAMILY_SCENARIOS];
  const selected = new Set(preferences?.interests ?? []);
  const context = new Set<string>();
  if (preferences) {
    for (const activity of ACTIVITIES) {
      if (preferences.activities.includes(activity.id)) activity.interests.forEach(id => context.add(id));
    }
    if (preferences.situation === "Student") context.add("education");
    if (preferences.situation === "Looking for work") context.add("jobs");
  }
  const result: FamilyScenario[] = [];
  while (pool.length && result.length < count) {
    const weights = pool.map(scenario => {
      if (!preferences) return 1;
      const groups = INTERESTS.filter(group => (group.scenarioIds as readonly number[]).includes(scenario.id));
      const explicit = groups.some(group => selected.has(group.id));
      const contextual = groups.some(group => context.has(group.id));
      // Keep broad coverage, including safe messages and categories with no match.
      const base = preferences.includeOtherTypes ? 1 : 0.35;
      return base + (explicit ? 6 : 0) + (contextual ? 2 : 0);
    });
    let draw = random() * weights.reduce((sum, weight) => sum + weight, 0);
    let index = weights.length - 1;
    for (let i = 0; i < weights.length; i++) {
      draw -= weights[i];
      if (draw < 0) { index = i; break; }
    }
    result.push(pool.splice(index, 1)[0]);
  }
  return result;
}
