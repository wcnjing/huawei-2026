import { useMemo, useState } from "react";
import type { FamilyGender, FamilyLink, HouseView, MemberView } from "../../services/house";
import { IconTree } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { NODE_H, NODE_W, familyGraph, familyLabels, layoutFamilyTree, linkOf } from "./familyTreeLayout";

const MONO = "'Share Tech Mono', monospace";
const SHAPE_COLOR = { male: "#4ecdc4", female: "#ff6b9d", none: "#9bb0c8" } as const;
type Relation = "child" | "partner" | "parent" | "alone";
const RELATIONS: { id: Relation; label: string }[] = [
  { id: "child", label: "CHILD OF" },
  { id: "partner", label: "PARTNER OF" },
  { id: "parent", label: "PARENT OF" },
  { id: "alone", label: "ON MY OWN" },
];

/** Square for male, circle for female, dashed while gender is unknown. */
function MemberNode({ member, label, isSelf, picked, onPick }: {
  member: MemberView; label: string; isSelf: boolean; picked?: boolean; onPick?: () => void;
}) {
  const gender = linkOf(member).gender;
  const color = SHAPE_COLOR[gender ?? "none"];
  const edge = picked ? "#ffe66d" : isSelf ? "#00ff88" : color;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      aria-label={`${member.name}${label ? `, ${label}` : ""}`}
      style={{
        width: NODE_W, height: NODE_H, backgroundColor: "#111827", padding: 6,
        border: `3px ${gender ? "solid" : "dashed"} ${edge}`,
        borderRadius: gender === "female" ? "50%" : gender ? 0 : 14,
        boxShadow: picked ? "0 0 10px #ffe66d" : isSelf ? "0 0 10px #00ff88" : "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
        cursor: onPick ? "pointer" : "default",
      }}
    >
      <span style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#e8f4f8", maxWidth: NODE_W - 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</span>
      <span style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: isSelf ? "#00ff88" : color, whiteSpace: "nowrap", maxWidth: NODE_W - 12, overflow: "hidden", textOverflow: "ellipsis" }}>{label || "—"}</span>
      {isSelf && <span style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#00ff88" }}>YOU</span>}
    </button>
  );
}

function Chip({ label, active, color, onClick, shape }: { label: string; active: boolean; color: string; onClick: () => void; shape?: "square" | "circle" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        fontFamily: MONO, fontSize: "var(--text-caption)", padding: "8px 10px",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        backgroundColor: active ? color : "#0a0e1a", color: active ? "#0a0e1a" : "#e8f4f8",
        border: `2px solid ${active ? color : "#2a3a5c"}`, cursor: "pointer",
      }}
    >
      {shape && <span style={{ width: 10, height: 10, border: `2px solid ${active ? "#0a0e1a" : color}`, borderRadius: shape === "circle" ? "50%" : 0 }} />}
      {label}
    </button>
  );
}

function relationOf(link: FamilyLink): { relation: Relation; target: string | null } {
  if (link.parentIds.length) return { relation: "child", target: link.parentIds[0] };
  if (link.partnerId) return { relation: "partner", target: link.partnerId };
  if (link.childIds.length) return { relation: "parent", target: link.childIds[0] };
  return { relation: "alone", target: null };
}

// ─────────────────────────────────────────────────────────────────────────
// SCREEN: FAMILY TREE — members add their own branch; the app names everyone from it.
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
  const saved = me ? linkOf(me) : null;
  const initial = saved ? relationOf(saved) : { relation: "alone" as Relation, target: null };

  const [gender, setGender] = useState<FamilyGender | null>(saved?.gender ?? null);
  const [relation, setRelation] = useState<Relation>(initial.relation);
  const [target, setTarget] = useState<string | null>(initial.target);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Partners as the rest of the house has them, so "child of Mum" also makes you Dad's.
  const othersGraph = useMemo(
    () => familyGraph(members.map((m) => (m.id === selfId ? { ...m, family: null } : m))),
    [members, selfId],
  );
  const draft: FamilyLink = useMemo(() => {
    const base: FamilyLink = { role: null, gender, parentIds: [], partnerId: null, childIds: [] };
    if (!target || relation === "alone") return base;
    if (relation === "partner") return { ...base, partnerId: target };
    if (relation === "parent") return { ...base, childIds: [target] };
    const partner = othersGraph.partnerOf.get(target);
    return { ...base, parentIds: partner && partner !== selfId ? [target, partner] : [target] };
  }, [gender, relation, target, othersGraph, selfId]);

  const editing = members.map((m) => (m.id === selfId ? { ...m, family: draft } : m));
  const shown = house ? members : editing;
  const layout = useMemo(() => layoutFamilyTree(shown), [shown]);
  const labels = useMemo(() => familyLabels(shown), [shown]);
  const previewLabel = familyLabels(editing).get(selfId) ?? "";
  const byId = Object.fromEntries(shown.map((m) => [m.id, m]));

  const needsTarget = relation !== "alone";
  const dirty = !saved || JSON.stringify({ ...draft, role: null }) !== JSON.stringify({ ...saved, role: null });
  const canSave = !!gender && (!needsTarget || !!target) && dirty && !busy;
  const pickFromTree = needsTarget && !!house;

  const save = async () => {
    setBusy(true); setMsg("");
    const error = await onSave(draft);
    setBusy(false);
    setMsg(error ?? "SAVED");
  };

  const label = (text: string) => (
    <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#9bb0c8", margin: "14px 0 6px" }}>{text}</div>
  );

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="FAMILY TREE" titleColor="#00ff88" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <PixelPanel accent="#00ff88" className="w-full">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <IconTree size={20} />
            <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#00ff88" }}>{house?.name ?? "YOUR HOUSE"}</div>
          </div>
          {layout.nodes.length ? (
            <div style={{ overflowX: "auto", scrollbarWidth: "thin" }}>
              <div style={{ position: "relative", width: layout.width, height: layout.height, margin: "0 auto" }}>
                <svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0 }} aria-hidden>
                  {layout.segments.map((s) => (
                    <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="#6b8ba4" strokeWidth={3} strokeLinecap="square" />
                  ))}
                </svg>
                {layout.nodes.map((n) => byId[n.id] && (
                  <div key={n.id} style={{ position: "absolute", left: n.x - NODE_W / 2, top: n.y }}>
                    <MemberNode
                      member={byId[n.id]}
                      label={labels.get(n.id) ?? ""}
                      isSelf={n.id === selfId}
                      picked={pickFromTree && dirty && target === n.id}
                      onPick={pickFromTree && n.id !== selfId ? () => setTarget(n.id) : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.5 }}>
              The tree is empty. Add your branch below to start it.
            </div>
          )}
          {layout.unplaced.length > 0 && (
            <>
              {label("NOT ON THE TREE YET")}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {layout.unplaced.map((id) => byId[id] && (
                  <MemberNode key={id} member={byId[id]} label="" isSelf={id === selfId}
                    picked={pickFromTree && dirty && target === id}
                    onPick={pickFromTree && id !== selfId ? () => setTarget(id) : undefined} />
                ))}
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
            {(["male", "female"] as const).map((g) => (
              <div key={g} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, border: `2px solid ${SHAPE_COLOR[g]}`, borderRadius: g === "female" ? "50%" : 0 }} />
                <span style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{g.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </PixelPanel>

        {me && !house && (
          <PixelPanel accent="#4ecdc4" className="w-full">
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.5, marginBottom: 10 }}>
              Your family tree lives in your house. Create or join one, then add your branch.
            </div>
            <PixelButton onClick={onInvite} color="#4ecdc4" size="md" full>PLAY WITH OTHERS</PixelButton>
          </PixelPanel>
        )}

        {me && house && (
          <PixelPanel accent="#c77dff" className="w-full">
            <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#c77dff" }}>ADD YOUR BRANCH</div>
            {label("YOU ARE")}
            <div style={{ display: "flex", gap: 8 }}>
              <Chip label="MALE" shape="square" color={SHAPE_COLOR.male} active={gender === "male"} onClick={() => setGender("male")} />
              <Chip label="FEMALE" shape="circle" color={SHAPE_COLOR.female} active={gender === "female"} onClick={() => setGender("female")} />
            </div>

            {others.length > 0 && (
              <>
                {label("YOUR PLACE")}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                  {RELATIONS.map((r) => (
                    <Chip key={r.id} label={r.label} color="#c77dff" active={relation === r.id}
                      onClick={() => { setRelation(r.id); if (r.id === "alone") setTarget(null); }} />
                  ))}
                </div>
                {needsTarget && (
                  <>
                    {label("WHO? (OR TAP THEM ON THE TREE)")}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {others.map((m) => (
                        <Chip key={m.id} label={m.name} color="#ffe66d" active={target === m.id} onClick={() => setTarget(m.id)} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {gender && (!needsTarget || target) && (
              <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#e8f4f8", marginTop: 14 }}>
                YOU&apos;LL SHOW AS: <span style={{ color: "#00ff88" }}>{previewLabel || "FAMILY"}</span>
              </div>
            )}
            <div style={{ height: 14 }} />
            <PixelButton onClick={() => { void save(); }} color="#00ff88" size="md" full disabled={!canSave}>
              {busy ? "SAVING…" : "[ SAVE MY BRANCH ]"}
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
