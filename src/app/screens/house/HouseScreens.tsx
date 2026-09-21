import { useState } from "react";
import type { HouseView } from "../../services/house";
import { formatCodeInput } from "../../services/house";
import { PixelMascot } from "../../components/avatars";
import { IconHouse } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";

export function HouseChoiceScreen({ initialCode, onCreate, onJoin, onBack }: {
  initialCode: string; onBack: () => void;
  onCreate: (name: string) => Promise<string | null>; onJoin: (code: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState(formatCodeInput(initialCode));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<string | null>) => {
    setBusy(true); setMsg("");
    const error = await action();
    setBusy(false);
    if (error) setMsg(error);
  };
  const input: React.CSSProperties = { width: "100%", padding: 12, backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", color: "#e8f4f8", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", outline: "none" };
  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="PLAY WITH OTHERS" titleColor="#4ecdc4" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <PixelPanel accent="#00ff88" className="w-full">
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#00ff88", marginBottom: 8 }}>CREATE A HOUSE</div>
          <input style={input} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. THE TANS" />
          <div style={{ height: 10 }} />
          <PixelButton onClick={() => run(() => onCreate(name))} color="#00ff88" size="md" full disabled={busy || !name.trim()}>[ CREATE ]</PixelButton>
        </PixelPanel>
        <PixelPanel accent="#4ecdc4" className="w-full">
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#4ecdc4", marginBottom: 8 }}>JOIN WITH A CODE</div>
          <input style={{ ...input, letterSpacing: 6, textAlign: "center", fontSize: "var(--text-display)" }} value={code} onChange={(e) => setCode(formatCodeInput(e.target.value))} placeholder="K7P-3QX" autoCapitalize="characters" />
          <div style={{ height: 10 }} />
          <PixelButton onClick={() => run(() => onJoin(code))} color="#4ecdc4" size="md" full disabled={busy || code.length !== 7}>[ JOIN ]</PixelButton>
        </PixelPanel>
        {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#ff6b35", textAlign: "center" }}>{msg}</div>}
      </div>
    </div>
  );
}

// Codes live 24 hours. Showing the remaining time (rather than a timestamp) is what
// tells the owner whether the code they are about to send will still work.
function inviteExpiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return "NO LIVE CODE";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "CODE EXPIRED";
  const hours = Math.floor(ms / 3600000);
  return hours >= 1 ? `EXPIRES IN ${hours}H` : `EXPIRES IN ${Math.max(1, Math.ceil(ms / 60000))}M`;
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: HOUSE SETTINGS — the invite code, who is in the house, and the way out.
// ─────────────────────────────────────────────────────────────────────────
export function HouseSettingsScreen({ house, selfId, onRegenerate, onRename, onRemove, onLeave, onBack }: {
  house: HouseView;
  selfId: string;
  onRegenerate: () => Promise<string | null>;
  onRename: (name: string) => Promise<string | null>;
  onRemove: (id: string) => Promise<string | null>;
  onLeave: () => Promise<string | null>;
  onBack: () => void;
}) {
  const isOwner = house.ownerId === selfId;
  const [draftName, setDraftName] = useState(house.name);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const code = house.inviteCode;
  const inviteUrl = code ? `${location.origin}/?house=${code.replace("-", "")}` : "";

  const run = async (action: () => Promise<string | null>) => {
    setBusy(true); setMsg("");
    const error = await action();
    setBusy(false);
    if (error) setMsg(error);
  };

  const share = async () => {
    if (!code) return;
    setMsg("");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Join my house", text: `Join my house in Drill Mode with code ${code}`, url: inviteUrl });
        return;
      }
      await navigator.clipboard.writeText(inviteUrl);
      setMsg("COPIED");
    } catch { /* the share sheet was dismissed, or the clipboard is blocked */ }
  };

  const leave = () => {
    const question = house.members.length <= 1
      ? "Leave this house? You are the last member, so the house will be deleted."
      : isOwner
        ? "Leave this house? The earliest joiner becomes the owner."
        : "Leave this house?";
    if (!window.confirm(question)) return;
    void run(onLeave);
  };

  const input: React.CSSProperties = { width: "100%", padding: 12, backgroundColor: "#0a0e1a", border: "3px solid #2a3a5c", color: "#e8f4f8", fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", outline: "none" };
  const sectionLabel = (text: string, color: string) => (
    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color, marginBottom: 8 }}>{text}</div>
  );

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="YOUR HOUSE" titleColor="#00ff88" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <PixelPanel accent="#00ff88" className="w-full">
          {sectionLabel("HOUSE NAME", "#00ff88")}
          {isOwner ? (
            <>
              <input style={input} maxLength={30} value={draftName} onChange={(e) => setDraftName(e.target.value)} />
              <div style={{ height: 10 }} />
              <PixelButton onClick={() => run(() => onRename(draftName))} color="#00ff88" size="sm" full disabled={busy || !draftName.trim()}>[ RENAME ]</PixelButton>
            </>
          ) : (
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8" }}>{house.name}</div>
          )}
        </PixelPanel>

        <PixelPanel accent="#4ecdc4" className="w-full">
          {sectionLabel("INVITE CODE", "#4ecdc4")}
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "var(--text-display)", color: code ? "#4ecdc4" : "#6b8ba4", letterSpacing: 2, textAlign: "center", padding: "8px 0" }}>
            {code ?? "——"}
          </div>
          <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-label)", color: "#9bb0c8", textAlign: "center", marginBottom: 10 }}>
            {inviteExpiryLabel(house.inviteExpiresAt)}
          </div>
          {code && <PixelButton onClick={() => { void share(); }} color="#4ecdc4" size="md" full>[ SHARE ]</PixelButton>}
          {isOwner && (
            <>
              <div style={{ height: 10 }} />
              <PixelButton onClick={() => run(onRegenerate)} color="#1a2340" textColor="#4ecdc4" size="sm" full disabled={busy}>[ NEW CODE ]</PixelButton>
            </>
          )}
        </PixelPanel>

        <PixelPanel accent="#c77dff" className="w-full">
          {sectionLabel(`MEMBERS (${house.members.length}/6)`, "#c77dff")}
          {house.members.map((m) => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "2px solid #2a3a5c" }}>
              <PixelMascot size={36} color={m.avatar?.color ?? "#4ecdc4"} hat={m.avatar?.hat ?? "None"} eyes={m.avatar?.eyes ?? "Default"} outfit={m.avatar?.outfit ?? "Standard"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: "#e8f4f8" }}>{m.name}</div>
                {m.isOwner && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-caption)", color: "#ffe66d", marginTop: 3 }}>OWNER</div>}
              </div>
              {isOwner && m.id !== selfId && (
                <PixelButton
                  onClick={() => { if (window.confirm(`Remove ${m.name} from the house?`)) void run(() => onRemove(m.id)); }}
                  color="#ff2d55"
                  textColor="#ffffff"
                  size="sm"
                  disabled={busy}
                >
                  REMOVE
                </PixelButton>
              )}
            </div>
          ))}
        </PixelPanel>

        {msg && <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: "var(--text-body)", color: msg === "COPIED" ? "#00ff88" : "#ff6b35", textAlign: "center" }}>{msg}</div>}

        <PixelButton onClick={leave} color="#1a2340" textColor="#ff2d55" size="md" full disabled={busy}>[ LEAVE HOUSE ]</PixelButton>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────
// SCREEN: NOTIFICATIONS (list view)
// ─────────────────────────────────────────────────────────────────────────
