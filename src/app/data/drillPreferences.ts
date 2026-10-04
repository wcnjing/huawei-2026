// User-facing groups derived from the ScamShield scam and variant CSVs. The IDs map to
// the app's current solo scenarios; related scenarios stand in where an exact one is absent.
export const INTERESTS = [
  { id: "shopping", label: "Shopping & marketplaces", scenarioIds: [3, 14, 15, 30] },
  { id: "jobs", label: "Jobs & recruitment", scenarioIds: [9, 33] },
  { id: "investment", label: "Investment & finance", scenarioIds: [16, 34] },
  { id: "government", label: "Government & authority", scenarioIds: [7, 12, 18, 28, 36] },
  { id: "friends", label: "Friends & impersonation", scenarioIds: [13] },
  { id: "prizes", label: "Prizes & lucky draws", scenarioIds: [4, 20] },
  { id: "phishing", label: "Phishing & account safety", scenarioIds: [1, 6, 10, 23, 25, 27] },
  { id: "tech", label: "Tech support", scenarioIds: [5, 22] },
  { id: "education", label: "Education", scenarioIds: [1, 2, 6, 21] },
  { id: "tickets", label: "Tickets & events", scenarioIds: [14, 15] },
] as const;

export const ACTIVITIES = [
  { id: "shopping", label: "Shop online", interests: ["shopping"] },
  { id: "social", label: "Use social media", interests: ["prizes", "phishing", "friends"] },
  { id: "investing", label: "Invest or trade", interests: ["investment"] },
  { id: "job_search", label: "Search for jobs", interests: ["jobs"] },
  { id: "tickets", label: "Buy event tickets", interests: ["tickets", "shopping"] },
  { id: "banking", label: "Use online banking", interests: ["phishing", "government"] },
] as const;

export const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–49", "50–64", "65+"] as const;
export const SITUATIONS = ["Student", "Working", "Self-employed", "Looking for work", "Retired", "Other"] as const;
export const CHANNELS = ["call", "sms", "email"] as const;

export interface DrillPreferences {
  ageRange: string;
  situation: string;
  activities: string[];
  interests: string[];
  channels: string[];
  includeOtherTypes: boolean;
  completed: boolean;
}

export const DEFAULT_DRILL_PREFERENCES: DrillPreferences = {
  ageRange: "", situation: "", activities: [], interests: [], channels: ["call", "sms", "email"],
  includeOtherTypes: true, completed: false,
};

const CURRENT_USER_KEY = "safespace_current_user_id";
const PREFERENCES_KEY = "safespace_drill_preferences_v1";

export function setPreferenceUser(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_USER_KEY, id);
    else localStorage.removeItem(CURRENT_USER_KEY);
  } catch { /* private mode */ }
}

export function loadDrillPreferences(): DrillPreferences {
  try {
    const id = localStorage.getItem(CURRENT_USER_KEY);
    const saved = id && JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}")[id];
    if (!saved || typeof saved !== "object") return { ...DEFAULT_DRILL_PREFERENCES };
    return {
      ...DEFAULT_DRILL_PREFERENCES,
      ageRange: typeof saved.ageRange === "string" && (AGE_RANGES as readonly string[]).includes(saved.ageRange) ? saved.ageRange : "",
      situation: typeof saved.situation === "string" && (SITUATIONS as readonly string[]).includes(saved.situation) ? saved.situation : "",
      activities: Array.isArray(saved.activities) ? saved.activities.filter((id: unknown) => typeof id === "string") : [],
      interests: Array.isArray(saved.interests) ? saved.interests.filter((id: unknown) => typeof id === "string") : [],
      channels: Array.isArray(saved.channels) ? saved.channels.filter((id: unknown) => typeof id === "string") : [...DEFAULT_DRILL_PREFERENCES.channels],
      includeOtherTypes: typeof saved.includeOtherTypes === "boolean" ? saved.includeOtherTypes : DEFAULT_DRILL_PREFERENCES.includeOtherTypes,
      completed: saved.completed === true,
    };
  } catch { return { ...DEFAULT_DRILL_PREFERENCES }; }
}

export function saveDrillPreferences(preferences: DrillPreferences) {
  try {
    const id = localStorage.getItem(CURRENT_USER_KEY);
    if (!id) return;
    const all = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    all[id] = preferences;
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(all));
  } catch { /* private mode */ }
}
