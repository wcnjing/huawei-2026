import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, LANGUAGES, loadLanguage, saveLanguage, type Language, type TranslatedLanguage } from "./languages";
import { DICTIONARIES } from "./locales";

export { LANGUAGES, type Language } from "./languages";

export type TranslateVars = Record<string, string | number>;
export type Translate = (text: string, vars?: TranslateVars) => string;

const warned = new Set<string>();

type Pattern = { re: RegExp; names: string[]; key: string };
const patternCache: Partial<Record<TranslatedLanguage, Pattern[]>> = {};

// Keys with {placeholders} also match text that already has the values filled in (e.g. server
// errors like "try again in 5 minutes"). Short literals are skipped so they can't over-match.
function patterns(language: TranslatedLanguage): Pattern[] {
  return (patternCache[language] ??= Object.keys(DICTIONARIES[language])
    .filter((key) => /\{\w+\}/.test(key) && key.replace(/\{\w+\}/g, "").trim().length >= 6)
    .map((key) => {
      const names: string[] = [];
      const source = key.split(/(\{\w+\})/).map((part) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        if (name) { names.push(name); return "(.+?)"; }
        return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }).join("");
      return { re: new RegExp(`^${source}$`, "s"), names, key };
    })
    .sort((a, b) => b.key.replace(/\{\w+\}/g, "").length - a.key.replace(/\{\w+\}/g, "").length));
}

function matchPattern(language: TranslatedLanguage, text: string): string | undefined {
  for (const { re, names, key } of patterns(language)) {
    const m = re.exec(text);
    if (!m) continue;
    const vars = Object.fromEntries(names.map((name, i) => [name, translate(language, m[i + 1])]));
    return DICTIONARIES[language][key].replace(/\{(\w+)\}/g, (s, k) => (k in vars ? vars[k] : s));
  }
  return undefined;
}

// Usable outside React (notification builders, services). Unknown text falls back to English.
export function translate(language: Language, text: string, vars?: TranslateVars): string {
  let out = text;
  if (language !== "en") {
    const hit = DICTIONARIES[language][text] ?? (vars ? undefined : matchPattern(language, text));
    if (hit !== undefined) out = hit;
    else if (import.meta.env.DEV && text.trim() && !warned.has(language + text)) {
      warned.add(language + text);
      console.warn(`[i18n] missing ${language}: ${JSON.stringify(text)}`);
    }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return out;
}

type I18nValue = { language: Language; setLanguage: (l: Language) => void; t: Translate };

const I18nContext = createContext<I18nValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (text, vars) => translate(DEFAULT_LANGUAGE, text, vars),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(loadLanguage);

  useEffect(() => {
    document.documentElement.lang = LANGUAGES.find((l) => l.code === language)?.htmlLang ?? "en";
  }, [language]);

  const setLanguage = useCallback((l: Language) => {
    saveLanguage(l);
    setLanguageState(l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (text, vars) => translate(language, text, vars) }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT(): Translate {
  return useContext(I18nContext).t;
}
