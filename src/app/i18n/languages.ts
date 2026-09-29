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

export function loadLanguage(): Language {
  try {
    const raw = localStorage.getItem(LANGUAGE_KEY);
    return isLanguage(raw) ? raw : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function saveLanguage(language: Language) {
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* private mode: not persisted */ }
}
