import { apiGet, apiPost } from "../services/api";

// The pre-survey: the onboarding questions (also Settings → Preferences) whose answers
// personalise drills. Answers are stored on the account in safespace-prod via
// /api/me/presurvey; this browser keeps a copy per signed-in player for display.
// The option lists are mirrored in server/presurvey.js, which also maps them to the
// bulletin scam types that drills are written from; keep the two in sync.
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

export interface PresurveyResponses {
  ageRange: string;
  situation: string;
  activities: string[];
  interests: string[];
  channels: string[];
  includeOtherTypes: boolean;
  completed: boolean;
}

export const DEFAULT_PRESURVEY: PresurveyResponses = {
  ageRange: "", situation: "", activities: [], interests: [], channels: ["call", "sms", "email"],
  includeOtherTypes: true, completed: false,
};

const CURRENT_USER_KEY = "safespace_current_user_id";
const PREFERENCES_KEY = "safespace_drill_preferences_v1";

export function setPresurveyUser(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_USER_KEY, id);
    else localStorage.removeItem(CURRENT_USER_KEY);
  } catch { /* private mode */ }
}

export function loadPresurvey(): PresurveyResponses {
  try {
    const id = localStorage.getItem(CURRENT_USER_KEY);
    const saved = id && JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}")[id];
    if (!saved || typeof saved !== "object") return { ...DEFAULT_PRESURVEY };
    return {
      ...DEFAULT_PRESURVEY,
      ageRange: typeof saved.ageRange === "string" && (AGE_RANGES as readonly string[]).includes(saved.ageRange) ? saved.ageRange : "",
      situation: typeof saved.situation === "string" && (SITUATIONS as readonly string[]).includes(saved.situation) ? saved.situation : "",
      activities: Array.isArray(saved.activities) ? saved.activities.filter((id: unknown) => typeof id === "string") : [],
      interests: Array.isArray(saved.interests) ? saved.interests.filter((id: unknown) => typeof id === "string") : [],
      channels: Array.isArray(saved.channels) ? saved.channels.filter((id: unknown) => typeof id === "string") : [...DEFAULT_PRESURVEY.channels],
      includeOtherTypes: typeof saved.includeOtherTypes === "boolean" ? saved.includeOtherTypes : DEFAULT_PRESURVEY.includeOtherTypes,
      completed: saved.completed === true,
    };
  } catch { return { ...DEFAULT_PRESURVEY }; }
}

export function savePresurvey(preferences: PresurveyResponses) {
  try {
    const id = localStorage.getItem(CURRENT_USER_KEY);
    if (!id) return;
    const all = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || "{}");
    all[id] = preferences;
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(all));
  } catch { /* private mode */ }
}

/** Stores the answers on the account. Resolves false when the server couldn't save them. */
export async function uploadPresurvey(presurvey: PresurveyResponses): Promise<boolean> {
  const result = await apiPost("/api/me/presurvey", { presurvey });
  return result.ok;
}

/**
 * Brings this device in line with the account, for the player setPresurveyUser named:
 * the account's saved answers win; a device that answered before they were stored on
 * the account uploads its copy. Returns the preferences to show, or null to keep the
 * local ones (offline, or nothing saved anywhere).
 */
export async function syncPresurvey(): Promise<PresurveyResponses | null> {
  const data = await apiGet<{ presurvey: PresurveyResponses | null }>("/api/me/presurvey");
  if (!data) return null;
  if (data.presurvey) {
    savePresurvey({ ...DEFAULT_PRESURVEY, ...data.presurvey });
    return loadPresurvey();
  }
  const local = loadPresurvey();
  if (local.completed) void uploadPresurvey(local);
  return null;
}
