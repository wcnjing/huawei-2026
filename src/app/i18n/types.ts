import type { TranslatedLanguage } from "./languages";

// Keys are the exact English text shown in the app; values are the translation.
export type LocaleTable = Partial<Record<TranslatedLanguage, Record<string, string>>>;
