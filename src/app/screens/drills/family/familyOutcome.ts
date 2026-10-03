import type { FamilyScenario, FamilyOutcome } from "../../../types/drills";

export const CAUTIOUS_ACTION = "ASK FAMILY FIRST";

export function familyOutcome(scenario: FamilyScenario, action: string | null): FamilyOutcome {
  if (action === null) return "wrong";
  if (action === scenario.correctAction || (scenario.id === 4 && action === "REPORT AS SCAM")) return "correct";
  if (action === CAUTIOUS_ACTION) return "cautious";
  return "wrong";
}
