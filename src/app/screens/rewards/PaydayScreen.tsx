import { useI18n } from "../../i18n";
import { useState } from "react";
import { MemberChar } from "../../components/avatars";
import { IconBulb, IconCheck, IconCoin, IconX } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { useMembers } from "../../hooks/useMembers";
import { useSelfId } from "../../hooks/useSelfId";
import { ink } from "../../utils/color";

export function PaydayScreen({ coins, claimedThisWeek, canCollect, onCollect, onClose }: { coins: Record<string, number>; claimedThisWeek: boolean; canCollect: boolean; onCollect: () => void; onClose: () => void }) {
  const { t, language } = useI18n();
  const [collected, setCollected] = useState(claimedThisWeek);
  const members = useMembers();
  const selfId = useSelfId();
  const paidMembers = members.filter((m) => m.id === selfId);
  const weeklyBase = 200;
  const drillBonus = 150;
  const payPeriod = new Date().toLocaleDateString(language === "en" ? "en-SG" : `${language}-SG`, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).toUpperCase();

  const handleCollect = () => {
    if (collected || !canCollect) return;
    setCollected(true);
    onCollect();
    setTimeout(() => onClose(), 1200);
  };

  return (
    <div className="flex flex-col h-full">
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "var(--background)", borderBottom: "4px solid var(--yellow-line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconCoin size={18} color="var(--yellow)" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)" }}>{t("PAYDAY SUNDAY")}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="var(--muted-foreground)" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          <div style={{ backgroundColor: "var(--card)", border: "4px solid var(--yellow-line)", boxShadow: "4px 4px 0 var(--yellow-line)", padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("PAY PERIOD")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--yellow)" }}>{payPeriod}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("BASE ALLOWANCE")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)" }}>+{weeklyBase}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("DRILL BONUS (SAFE)")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--green)" }}>+{drillBonus}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>{t("OUTCOME TO REVIEW")}</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--teal)" }}>{t("NO COIN LOSS")}</div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", lineHeight: 1.6 }}>
              {t("You get +{base}. Staying safe all week adds a +{bonus} bonus. A missed red flag never reduces an existing balance.", { base: weeklyBase, bonus: drillBonus })}
            </div>
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", letterSpacing: 2, marginBottom: 10 }}>{t("YOUR BALANCE")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {paidMembers.map(m => {
              const balance = coins[m.id] ?? 0;
              return (
                <div key={m.id} style={{ backgroundColor: "var(--card)", border: "3px solid var(--border)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <MemberChar member={m} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: ink(m.primaryColor) }}>{m.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 3 }}>
                      {m.safeThisWeek ? t("SAFE THIS WEEK") : t("REVIEW NEEDED")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--yellow)" }}>
                      +{balance}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--soft-foreground)", marginTop: 3 }}>{t("COINS")}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ backgroundColor: "color-mix(in srgb, var(--green-fill) 6%, transparent)", border: "3px solid var(--green-line)", padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <IconBulb size={12} color="var(--yellow)" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "var(--yellow)" }}>{t("PAYDAY TIP")}</div>
            </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--green)", lineHeight: 1.5 }}>
              {t("Complete drills every week to earn your full salary bonus. Missed red flags reduce the bonus, but every review helps the whole house improve.")}
            </div>
          </div>

          {collected ? (
            <div style={{ backgroundColor: "var(--green-fill)", border: "4px solid var(--outline)", boxShadow: "4px 4px 0 var(--outline)", padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <IconCheck size={16} color="var(--on-fill)" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "var(--on-fill)" }}>{claimedThisWeek ? t("COLLECTED THIS WEEK") : t("COLLECTED!")}</div>
            </div>
          ) : canCollect ? (
            <PixelButton onClick={handleCollect} color="var(--yellow-fill)" textColor="var(--on-fill)" size="lg" full>{t("[ COLLECT PAYDAY ]")}</PixelButton>
          ) : (
            <div style={{ backgroundColor: "var(--card)", border: "4px solid var(--border)", padding: "16px", textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "var(--soft-foreground)" }}>
              {t("LOADING YOUR HOUSE…")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
