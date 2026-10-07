import { PixelButton } from "../../components/ui";
import { PixiAvatar } from "../../components/avatars";
import { Stars } from "../../components/layout";
import { useT } from "../../i18n";

export function StartScreen({ onNew, onReturning }: { onNew: () => void; onReturning: () => void }) {
  const t = useT();
  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 gap-6">
      <Stars />
      <div className="relative z-10 flex flex-col items-center gap-6 w-full">
        <PixiAvatar size={96} animate />
        <PixelButton onClick={onNew} color="#00ff88" size="lg" full>{t("[ NEW PLAYER ]")}</PixelButton>
        <PixelButton onClick={onReturning} color="#1a2340" textColor="#4ecdc4" size="md" full>{t("I HAVE AN ACCOUNT")}</PixelButton>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SAFETY HABITS — collapsible reference card on the Drill tab. Deliberately tucked
// behind a dropdown, not shown up front: Drill Mode is about building reflexes under
// pressure, not reciting rules, so this is a look-it-up-if-you-want reference, never
// the thing standing between someone and a drill.
// ─────────────────────────────────────────────────────────────────────────




// ─────────────────────────────────────────────────────────────────────────
// SCREEN: TELEGRAM DRILL INTRO — explains flow, then opens Telegram bot
// ─────────────────────────────────────────────────────────────────────────
