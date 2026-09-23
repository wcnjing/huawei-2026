import { useMemo, useState } from "react";
import type { FamilyLink, FamilyRole, HouseView, MemberView } from "../../services/house";
import { FAMILY_ROLES } from "../../services/house";
import { PixelMascot } from "../../components/avatars";
import { IconTree } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { NODE_H, NODE_W, familyGraph, layoutFamilyTree, linkOf } from "./familyTreeLayout";

const MONO = "'Share Tech Mono', monospace";
const ROLE_LABEL: Record<FamilyRole, string> = {
  GRANDPA: "GRANDPA", GRANDMA: "GRANDMA", DAD: "DAD", MUM: "MUM", SON: "SON", DAUGHTER: "DAUGHTER",
  BROTHER: "BROTHER", SISTER: "SISTER", UNCLE: "UNCLE", AUNTIE: "AUNTIE", COUSIN: "COUSIN",
  HUSBAND: "HUSBAND", WIFE: "WIFE", PARTNER: "PARTNER", GUARDIAN: "GUARDIAN", OTHER: "FAMILY",
};

function MemberNode({ member, isSelf }: { member: MemberView; isSelf: boolean }) {
  const role = member.family?.role;
  const accent = isSelf ? "#00ff88" : member.avatar?.color ?? "#4ecdc4";
  return (
    <div style={{
      width: NODE_W, height: NODE_H, backgroundColor: "#111827", border: `3px solid ${accent}`,
      boxShadow: isSelf ? `0 0 10px ${accent}` : `3px 3px 0 #0a0e1a`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: 4,
    }}>
      <PixelMascot size={34} color={member.avatar?.color ?? "#4ecdc4"} hat={member.avatar?.hat ?? "None"} eyes={member.avatar?.eyes ?? "Default"} outfit={member.avatar?.outfit ?? "Standard"} />
      <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#e8f4f8", maxWidth: NODE_W - 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
      <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: isSelf ? "#00ff88" : "#9bb0c8" }}>
        {isSelf ? (role ? `YOU · ${ROLE_LABEL[role]}` : "YOU") : role ? ROLE_LABEL[role] : "—"}
      </div>
    </div>
  );
}

function Chip({ label, active, disabled, color, onClick }: { label: string; active: boolean; disabled?: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      style={{
        fontFamily: MONO, fontSize: "var(--text-caption)", padding: "6px 8px",
        backgroundColor: active ? color : "#0a0e1a", color: active ? "#0a0e1a" : disabled ? "#3a4a6c" : "#e8f4f8",
        border: `2px solid ${active ? color : "#2a3a5c"}`, cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY TREE — everyone in the house on one diagram, and a form to place yourself.
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
  const others = members.filter((m) => m.id !== selfId);
  const layout = useMemo(() => layoutFamilyTree(members), [members]);
  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const saved = me ? linkOf(me) : { role: null, parentIds: [], partnerId: null, childIds: [] };
  const [role, setRole] = useState<FamilyRole | null>(saved.role);
  const [parentIds, setParentIds] = useState<string[]>(saved.parentIds);
  const [partnerId, setPartnerId] = useState<string | null>(saved.partnerId);
  const [childIds, setChildIds] = useState<string[]>(saved.childIds);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Links other members made that involve you — shown so you don't wonder where a line came from.
  const { parentsOf, partnerOf } = useMemo(
    () => familyGraph(members.map((m) => (m.id === selfId ? { ...m, family: null } : m))),
    [members, selfId],
  );
  const fromOthers: string[] = [];
  for (const p of parentsOf.get(selfId) ?? []) if (!parentIds.includes(p)) fromOthers.push(`${byId[p]?.name} lists you as their child`);
  for (const [child, ps] of parentsOf) if (ps.has(selfId) && !childIds.includes(child)) fromOthers.push(`${byId[child]?.name} lists you as a parent`);
  const claimedPartner = partnerOf.get(selfId);
  if (claimedPartner && claimedPartner !== partnerId) fromOthers.push(`${byId[claimedPartner]?.name} lists you as their partner`);

  const toggle = (list: string[], set: (v: string[]) => void, id: string, max: number) => {
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < max) set([...list, id]);
  };
  const usedElsewhere = (id: string, except: "parent" | "partner" | "child") =>
    (except !== "parent" && parentIds.includes(id)) ||
    (except !== "partner" && partnerId === id) ||
    (except !== "child" && childIds.includes(id));

  const dirty = JSON.stringify({ role, parentIds, partnerId, childIds }) !== JSON.stringify(saved);
  const save = async () => {
    setBusy(true); setMsg("");
    const error = await onSave({ role, parentIds, partnerId, childIds });
    setBusy(false);
    setMsg(error ?? "SAVED");
  };

  const label = (text: string, color: string) => (
    <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color, margin: "12px 0 6px" }}>{text}</div>
  );

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
                    <polyline key={line.key} points={line.points.map((p) => p.join(",")).join(" ")} fill="none" stroke="#4ecdc4" strokeWidth={3} strokeLinejoin="miter" />
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
              No branches yet. Place yourself below: pick your parents, partner or children and the tree grows.
            </div>
          )}
          {layout.unplaced.length > 0 && (
            <>
              {label(layout.nodes.length ? "NOT ON THE TREE YET" : "IN THIS HOUSE", "#9bb0c8")}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {layout.unplaced.map((id) => byId[id] && <MemberNode key={id} member={byId[id]} isSelf={id === selfId} />)}
              </div>
            </>
          )}
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
            <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#c77dff" }}>PLACE YOURSELF</div>
            {label("I AM THE…", "#9bb0c8")}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
              {FAMILY_ROLES.map((r) => (
                <Chip key={r} label={ROLE_LABEL[r]} active={role === r} color="#c77dff" onClick={() => setRole(role === r ? null : r)} />
              ))}
            </div>

            {others.length === 0 ? (
              <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#9bb0c8", marginTop: 12, lineHeight: 1.5 }}>
                Invite your family to link up with them on the tree.
                <div style={{ height: 10 }} />
                <PixelButton onClick={onInvite} color="#1a2340" textColor="#4ecdc4" size="sm" full>+ INVITE</PixelButton>
              </div>
            ) : (
              <>
                {label("MY PARENTS (UP TO 2)", "#9bb0c8")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {others.map((m) => (
                    <Chip key={m.id} label={m.name} color="#4ecdc4" active={parentIds.includes(m.id)}
                      disabled={usedElsewhere(m.id, "parent") || (!parentIds.includes(m.id) && parentIds.length >= 2)}
                      onClick={() => toggle(parentIds, setParentIds, m.id, 2)} />
                  ))}
                </div>
                {label("MY PARTNER", "#9bb0c8")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {others.map((m) => (
                    <Chip key={m.id} label={m.name} color="#ff6b9d" active={partnerId === m.id}
                      disabled={usedElsewhere(m.id, "partner")}
                      onClick={() => setPartnerId(partnerId === m.id ? null : m.id)} />
                  ))}
                </div>
                {label("MY CHILDREN", "#9bb0c8")}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {others.map((m) => (
                    <Chip key={m.id} label={m.name} color="#ffe66d" active={childIds.includes(m.id)}
                      disabled={usedElsewhere(m.id, "child")}
                      onClick={() => toggle(childIds, setChildIds, m.id, 5)} />
                  ))}
                </div>
                {fromOthers.length > 0 && (
                  <div style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#6b8ba4", marginTop: 12, lineHeight: 1.5 }}>
                    {fromOthers.map((t) => <div key={t}>· {t}</div>)}
                  </div>
                )}
              </>
            )}
            <div style={{ height: 14 }} />
            <PixelButton onClick={() => { void save(); }} color="#00ff88" size="md" full disabled={busy || !dirty}>
              {busy ? "SAVING…" : "[ SAVE MY PLACE ]"}
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
