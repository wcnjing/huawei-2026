import type { TranslatedLanguage } from "../languages";
import type { LocaleTable } from "../types";
import { core } from "./core";
import { app } from "./app";
import { drillsLive } from "./drillsLive";
import { drillsPractice } from "./drillsPractice";
import { data } from "./data";
import { account } from "./account";
import { world } from "./world";

const TABLES: LocaleTable[] = [core, app, drillsLive, drillsPractice, data, account, world];

function merge(language: TranslatedLanguage): Record<string, string> {
  return Object.assign({}, ...TABLES.map((table) => table[language] ?? {}));
}

export const DICTIONARIES: Record<TranslatedLanguage, Record<string, string>> = {
  zh: merge("zh"),
  ms: merge("ms"),
  ta: merge("ta"),
};
