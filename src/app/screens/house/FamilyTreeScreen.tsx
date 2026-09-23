import { useMemo, useState } from "react";
import type { FamilyLink, FamilyRole, HouseView, MemberView } from "../../services/house";
import { FAMILY_ROLES } from "../../services/house";
import { IconTree } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { NODE_H, NODE_W, genderOf, layoutFamilyTree, type Gender } from "./familyTreeLayout";

const MONO = "'Share Tech Mono', monospace";
const ROLE_LABEL: Record<FamilyRole, string> = {
  GRANDPA: "GRANDPA", GRANDMA: "GRANDMA", DAD: "DAD", MUM: "MUM", SON: "SON", DAUGHTER: "DAUGHTER",
  BROTHER: "BROTHER", SISTER: "SISTER", UNCLE: "UNCLE", AUNTIE: "AUNTIE", COUSIN: "COUSIN",
  HUSBAND: "HUSBAND", WIFE: "WIFE", PARTNER: "PARTNER", GUARDIAN: "GUARDIAN", OTHER: "FAMILY",
};
const GENDER_COLOR: Record<Gender, string> = { male: "#4ecdc4", female: "#ff6b9d", unknown: "#9bb0c8" };

/** Square for male, circle for female, dashed rounded square when the role doesn't say. */
function MemberNode({ member, isSelf }: { member: MemberView; isSelf: boolean }) {
  const role = member.family?.role ?? null;
  const gender = genderOf(role);
  const color = GENDER_COLOR[gender];
  return (
    <div style={{
      width: NODE_W, height: NODE_H, backgroundColor: "#111827",
      border: `3px ${gender === "unknown" ? "dashed" : "solid"} ${isSelf ? "#00ff88" : color}`,
      borderRadius: gender === "female" ? "50%" : gender === "unknown" ? 14 : 0,
      boxShadow: isSelf ? "0 0 10px #00ff88" : "none",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, padding: 6,
    }}>
      <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#e8f4f8", maxWidth: NODE_W - 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
      <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: isSelf ? "#00ff88" : color, whiteSpace: "nowrap" }}>
        {role ? ROLE_LABEL[role] : "—"}
      </div>
      {isSelf && <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#00ff88" }}>YOU</div>}
    </div>
  );
}

function Legend() {
  const item = (shape: React.CSSProperties, label: string) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 12, height: 12, backgroundColor: "#111827", ...shape }} />
      <span style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{label}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
      {item({ border: `2px solid ${GENDER_COLOR.male}` }, "MALE")}
      {item({ border: `2px solid ${GENDER_COLOR.female}`, borderRadius: "50%" }, "FEMALE")}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY TREE — everyone in the house on one diagram, placed by the role they pick.
// ─────────────────────────────────────────────────────────────────────────
export function FamilyTreeScreen({ house, self, selfId, onSave, onInvite, onBack }: {
  house: HouseView | null;
  self: MemberView | null | undefined;
  selfId: string;
  onSave: (link: FamilyLink) => Promise<string | null>;
  onInvite: () => void;
  onBack: () => void;
}) {
  const members = useMemo(() => house?.members ?? (self ? [self] : []), [house, self]);
  const me = members.find((m) => m.id === selfId) ?? self ?? null;
  const layout = useMemo(() => layoutFamilyTree(members), [members]);
  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const savedRole = me?.family?.role ?? null;
  const [role, setRole] = useState<FamilyRole | null>(savedRole);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setMsg("");
    const error = await onSave({ role, parentIds: [], partnerId: null, childIds: [] });
    setBusy(false);
    setMsg(error ?? "SAVED");
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="FAMILY TREE" titleColor="#00ff88" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <PixelPanel accent="#00ff88" className="w-full">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <IconTree size={20} />
            <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#00ff88" }}>{house?.name ?? "YOUR HOUSE"}</div>
          </div>
          {layout.nodes.length ? (
            <div style={{ overflowX: "auto", scrollbarWidth: "thin" }}>
              <div style={{ position: "relative", width: layout.width, height: layout.height, margin: "0 auto" }}>
                <svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0 }} aria-hidden>
                  {layout.lines.map((line) => (
                    <polyline key={line.key} points={line.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#6b8ba4" strokeWidth={3} />
                  ))}
                </svg>
                {layout.nodes.map((n) => byId[n.id] && (
                  <div key={n.id} style={{ position: "absolute", left: n.x - NODE_W / 2, top: n.y }}>
                    <MemberNode member={byId[n.id]} isSelf={n.id === selfId} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.5 }}>
              No one is on the tree yet. Pick who you are below and the tree starts to grow.
            </div>
          )}
          {layout.unplaced.length > 0 && (
            <>
              <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#9bb0c8", margin: "12px 0 6px" }}>NOT ON THE TREE YET</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {layout.unplaced.map((id) => byId[id] && <MemberNode key={id} member={byId[id]} isSelf={id === selfId} />)}
              </div>
            </>
          )}
          <Legend />
        </PixelPanel>

        {me && !house && (
          <PixelPanel accent="#4ecdc4" className="w-full">
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.5, marginBottom: 10 }}>
              Your family tree lives in your house. Create or join one, then place yourself on it.
            </div>
            <PixelButton onClick={onInvite} color="#4ecdc4" size="md" full>PLAY WITH OTHERS</PixelButton>
          </PixelPanel>
        )}

        {me && house && (
          <PixelPanel accent="#c77dff" className="w-full">
            <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#c77dff", marginBottom: 8 }}>I AM THE…</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {FAMILY_ROLES.map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRole(active ? null : r)}
                    aria-pressed={active}
                    style={{
                      fontFamily: MONO, fontSize: "var(--text-caption)", padding: "8px 4px",
                      backgroundColor: active ? "#c77dff" : "#0a0e1a", color: active ? "#0a0e1a" : "#e8f4f8",
                      border: `2px solid ${active ? "#c77dff" : "#2a3a5c"}`, cursor: "pointer",
                    }}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
            <div style={{ height: 14 }} />
            <PixelButton onClick={() => { void save(); }} color="#00ff88" size="md" full disabled={busy || role === savedRole}>
              {busy ? "SAVING…" : "[ SAVE ]"}
            </PixelButton>
            {msg && (
              <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: msg === "SAVED" ? "#00ff88" : "#ff6b35", textAlign: "center", marginTop: 10 }}>{msg}</div>
            )}
          </PixelPanel>
        )}
      </div>
    </div>
  );
}
