import type { Screen } from "../types/navigation";

const FAMILY_DRILL_SCREENS: Screen[] = ["family-round"];

const DRILL_SCREENS: Screen[] = [
  "drill-select", "incoming", "call",
  "sms-inbox", "sms-thread", "sms-browser",
  "email-inbox", "email-detail", "email-browser", "email-download",
  "realistic-phone-intro", "realistic-sms-intro", "telegram-intro", "realistic-email-intro",
  "result-win", "result-lose",
  ...FAMILY_DRILL_SCREENS, "family-answer",
];

const MUSIC_OK_DURING_DRILL: Screen[] = ["drill-select", "result-win", "result-lose"];

export const MUSIC_SILENT_SCREENS: Screen[] = DRILL_SCREENS.filter(
  (screen) => !MUSIC_OK_DURING_DRILL.includes(screen),
);
