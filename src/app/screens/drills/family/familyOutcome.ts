import type { FamilyScenario, FamilyOutcome } from "../../../types/drills";

export function familyOutcome(scenario: FamilyScenario, action: string | null): FamilyOutcome {
  if (action === null) return "wrong";
  if (action === scenario.correctAction || (scenario.id === 4 && action === "REPORT AS SCAM")) return "correct";
  if (action === "ASK SOMEONE YOU TRUST FIRST") return "cautious";
  return "wrong";
}
