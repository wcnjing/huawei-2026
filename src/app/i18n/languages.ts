export type Language = "en" | "zh" | "ms" | "ta";
export type TranslatedLanguage = Exclude<Language, "en">;

// Labels are written in their own language so a user can find theirs without reading English.
export const LANGUAGES: { code: Language; label: string; htmlLang: string }[] = [
  { code: "en", label: "English", htmlLang: "en" },
  { code: "zh", label: "中文", htmlLang: "zh-Hans" },
  { code: "ms", label: "Bahasa Melayu", htmlLang: "ms" },
  { code: "ta", label: "தமிழ்", htmlLang: "ta" },
];

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_KEY = "safespace_language";

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((l) => l.code === value);
}

// The device's own language, consulted only when the user has never picked one in the app.
// Matching is on the primary subtag, so en-SG, zh-Hans-SG, ms-MY and ta-IN all land on the
// language they are written in. Anything we do not speak (id, hi, ...) is left to the caller
// rather than guessed at: a near-miss language is worse than English, which every screen has.
export function matchDeviceLanguage(tags: readonly (string | undefined)[]): Language | undefined {
  for (const tag of tags) {
    const primary = String(tag ?? "").toLowerCase().split("-")[0];
    if (isLanguage(primary)) return primary;
  }
  return undefined;
}

function deviceLanguage(): Language | undefined {
  try {
    const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
    return matchDeviceLanguage(preferred);
  } catch {
    return undefined;
  }
}

// A stored choice always wins. Without one we read the device, and that result is deliberately
// not saved: the user has still chosen nothing, so changing the phone's language changes the
// app's until they pick for themselves. A Tamil speaker should not have to read English menus
// to find the language setting.
export function loadLanguage(): Language {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LANGUAGE_KEY);
  } catch { /* private mode: nothing was stored */ }
  return isLanguage(raw) ? raw : deviceLanguage() ?? DEFAULT_LANGUAGE;
}

export function saveLanguage(language: Language) {
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* private mode: not persisted */ }
}
