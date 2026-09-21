import { useState } from "react";
import { MemberChar } from "../../components/avatars";
import { IconBulb, IconCheck, IconCoin, IconX } from "../../components/icons";
import { PixelButton } from "../../components/ui";
import { useMembers } from "../../hooks/useMembers";
import { useSelfId } from "../../hooks/useSelfId";

export function PaydayScreen({ coins, claimedThisWeek, canCollect, onCollect, onClose }: { coins: Record<string, number>; claimedThisWeek: boolean; canCollect: boolean; onCollect: () => void; onClose: () => void }) {
  const [collected, setCollected] = useState(claimedThisWeek);
  const members = useMembers();
  const selfId = useSelfId();
  const paidMembers = members.filter((m) => m.id === selfId);
  const weeklyBase = 200;
  const drillBonus = 150;
  const payPeriod = new Date().toLocaleDateString(undefined, {
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
      <div style={{ padding: "0 16px", minHeight: 52, backgroundColor: "#0a0e1a", borderBottom: "4px solid #ffe66d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconCoin size={18} color="#ffe66d" />
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d" }}>PAYDAY SUNDAY</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <IconX size={16} color="#6b8ba4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div style={{ padding: "16px" }}>
          <div style={{ backgroundColor: "#111827", border: "4px solid #ffe66d", boxShadow: "4px 4px 0 #ffe66d", padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>PAY PERIOD</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#ffe66d" }}>{payPeriod}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>BASE ALLOWANCE</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d" }}>+{weeklyBase}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>DRILL BONUS (SAFE)</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00ff88" }}>+{drillBonus}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #2a3a5c", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>OUTCOME TO REVIEW</div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#4ecdc4" }}>NO COIN LOSS</div>
            </div>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", lineHeight: 1.6 }}>
              You get +{weeklyBase}. Staying safe all week adds a +{drillBonus} bonus. A missed red flag never reduces an existing balance.
            </div>
          </div>

          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", letterSpacing: 2, marginBottom: 10 }}>YOUR BALANCE</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {paidMembers.map(m => {
              const balance = coins[m.id] ?? 0;
              return (
                <div key={m.id} style={{ backgroundColor: "#111827", border: "3px solid #2a3a5c", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <MemberChar member={m} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: m.primaryColor }}>{m.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 3 }}>
                      {m.safeThisWeek ? "SAFE THIS WEEK" : "REVIEW NEEDED"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ffe66d" }}>
                      +{balance}
                    </div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#9bb0c8", marginTop: 3 }}>COINS</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ backgroundColor: "rgba(0,255,136,0.06)", border: "3px solid #00ff88", padding: "12px 14px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <IconBulb size={12} color="#ffe66d" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d" }}>PAYDAY TIP</div>
            </div>
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#00ff88", lineHeight: 1.5 }}>
              Complete drills every week to earn your full salary bonus. Missed red flags reduce the bonus, but every review helps the whole house improve.
            </div>
          </div>

          {collected ? (
            <div style={{ backgroundColor: "#00ff88", border: "4px solid #0a0e1a", boxShadow: "4px 4px 0 #0a0e1a", padding: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <IconCheck size={16} color="#0a0e1a" />
              <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#0a0e1a" }}>{claimedThisWeek ? "COLLECTED THIS WEEK" : "COLLECTED!"}</div>
            </div>
          ) : canCollect ? (
            <PixelButton onClick={handleCollect} color="#ffe66d" textColor="#0a0e1a" size="lg" full>[ COLLECT PAYDAY ]</PixelButton>
          ) : (
            <div style={{ backgroundColor: "#111827", border: "4px solid #2a3a5c", padding: "16px", textAlign: "center", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8" }}>
              LOADING YOUR HOUSE…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
