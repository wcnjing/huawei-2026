// Point values — mirrors the behaviour-tracking table in the product spec.
export const POINTS = {
  OPEN_EMAIL: 0,
  CHECK_SENDER: 10,
  HOVER_LINK: 15,
  REPORT_SCAM_CORRECT: 40,
  REPORT_SCAM_INCORRECT: 0,
  DELETE_SUSPICIOUS: 20,
  DELETE_LEGIT: 0,
  CLICK_PHISHING_LINK: -40,
  CLICK_LEGIT_LINK: 0,
  DOWNLOAD_ATTACHMENT: -50,
  SUBMIT_CREDENTIALS: -70,
} as const;

// Maximum achievable score for this specific 4-email drill —
// used to render "score / possible" in the investigation report.
export const MAX_POSSIBLE_SCORE =
  POINTS.CHECK_SENDER * 4 + POINTS.HOVER_LINK * 4 + POINTS.REPORT_SCAM_CORRECT * 2 + POINTS.DELETE_SUSPICIOUS * 0;

export function formatClock(minutesPastNine: number): string {
  const hh = 9 + Math.floor(minutesPastNine / 60);
  const mm = minutesPastNine % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
