import { PixelButton } from "../../components/ui";
import { PixelMascot } from "../../components/avatars";
import { Stars } from "../../components/layout";
import { LANGUAGES, type Language } from "../../i18n";
import { suggestedLanguage } from "../../i18n/languages";

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: LANGUAGE — the one-time step after the title, shown only to a player who has
// never picked a language (hasStoredLanguage). The app can detect the device's language,
// but a phone set up by somebody else says nothing about who is holding it: plenty of our
// players read Tamil or Chinese on a handset a son or daughter configured in English.
// Detection decides which option is *suggested* here; the player decides which is used.
//
// Not a single word on this screen goes through t(). Every option is written in its own
// language, so it is legible to the person who needs it without their having to read any
// of the others first — which is the whole reason the step exists.
// ─────────────────────────────────────────────────────────────────────────

// "Language" in each of the four, so the question is clear whichever one you read.
const PROMPT = "LANGUAGE · 语言 · BAHASA · மொழி";

export function LanguageScreen({ onPick }: { onPick: (language: Language) => void }) {
  const suggested = suggestedLanguage();

  return (
    <section
      aria-label={PROMPT}
      className="relative flex flex-col items-center justify-center h-full px-6 gap-6"
    >
      <Stars />
      <div className="relative z-10 flex flex-col items-center gap-6 w-full">
        <PixelMascot size={96} animate />
        <div
          style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "var(--text-label)",
            color: "#4ecdc4",
            letterSpacing: 1,
            textAlign: "center",
          }}
        >
          {PROMPT}
        </div>
        <div className="flex flex-col gap-3 w-full">
          {LANGUAGES.map((l) => {
            // The device's guess is the primary button; the rest sit beside it as equals,
            // never greyed out. Nothing is pre-committed — every option is one tap.
            const isSuggested = l.code === suggested;
            return (
              <PixelButton
                key={l.code}
                onClick={() => onPick(l.code)}
                color={isSuggested ? "#00ff88" : "#1a2340"}
                textColor={isSuggested ? "#0a0e1a" : "#e8f4f8"}
                size="md"
                full
              >
                <span lang={l.htmlLang}>{l.label}</span>
              </PixelButton>
            );
          })}
        </div>
      </div>
    </section>
  );
}
