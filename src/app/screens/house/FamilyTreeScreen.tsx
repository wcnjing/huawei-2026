import { useMemo, useState } from "react";
import type { FamilyGender, FamilyLink, HouseView, MemberView } from "../../services/house";
import { IconTree } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";
import { SubPageHeader } from "../../components/layout";
import { NODE_H, NODE_W, SHAPE, familyGraph, layoutFamilyTree, linkOf, relationLabels, roleBase } from "./familyTreeLayout";
import { useI18n, useT } from "../../i18n";

const MONO = "'Share Tech Mono', monospace";
const SHAPE_COLOR = { male: "#4ecdc4", female: "#ff6b9d", other: "#ffe66d", none: "#9bb0c8" } as const;
const GENDERS: { id: FamilyGender; label: string }[] = [
  { id: "male", label: "MALE" },
  { id: "female", label: "FEMALE" },
  { id: "other", label: "OTHERS" },
];
type Relation = "child" | "partner" | "parent" | "friend" | "alone";
const RELATIONS: { id: Relation; label: string }[] = [
  { id: "child", label: "CHILD OF" },
  { id: "partner", label: "PARTNER OF" },
  { id: "parent", label: "PARENT OF" },
  { id: "friend", label: "FRIEND OF" },
  { id: "alone", label: "ON MY OWN" },
];

/**
 * Square = male, circle = female, triangle = others, dashed = not set yet. The three
 * shapes are drawn to the same visual size (a circle the width of a square looks smaller).
 */
function Shape({ gender, size, stroke, fill = "#111827", strokeWidth = 3, dashed = false }: {
  gender: FamilyGender | null; size: number; stroke: string; fill?: string; strokeWidth?: number; dashed?: boolean;
}) {
  const c = size / 2;
  const w = strokeWidth;
  const common = { fill, stroke, strokeWidth: w, strokeDasharray: dashed ? "4 3" : undefined };
  const square = size * 0.84;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", overflow: "visible" }} aria-hidden>
      {gender === "female" ? <circle cx={c} cy={c} r={c - w / 2} {...common} />
        : gender === "other" ? <polygon points={`${c},${w} ${size - w / 2},${size - w / 2} ${w / 2},${size - w / 2}`} strokeLinejoin="round" {...common} />
        : <rect x={c - square / 2} y={c - square / 2} width={square} height={square} rx={gender ? 0 : 6} {...common} />}
    </svg>
  );
}

function MemberNode({ member, label, isSelf, picked, onPick }: {
  member: MemberView; label: string; isSelf: boolean; picked?: boolean; onPick?: () => void;
}) {
  const t = useT();
  const gender = linkOf(member).gender;
  const color = SHAPE_COLOR[gender ?? "none"];
  const edge = picked ? "#ffffff" : isSelf ? "#00ff88" : color;
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      aria-label={`${member.name}${label ? `, ${label}` : ""}${isSelf ? ", you" : ""}`}
      style={{
        width: NODE_W, height: NODE_H, padding: 0, background: "none", border: "none",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        cursor: onPick ? "pointer" : "default",
      }}
    >
      <div style={{ position: "relative", filter: isSelf || picked ? `drop-shadow(0 0 5px ${edge})` : "none" }}>
        <Shape gender={gender} size={SHAPE} stroke={edge} dashed={!gender} />
        <span style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          paddingTop: gender === "other" ? 10 : 0,
          fontFamily: MONO, fontSize: 14, color: "#e8f4f8",
        }}>{member.name.slice(0, 1)}</span>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 12, lineHeight: "14px", color: "#e8f4f8", maxWidth: NODE_W, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {member.name}
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11, lineHeight: "13px", color: isSelf ? "#00ff88" : color, maxWidth: NODE_W, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isSelf ? t("YOU") : label || "—"}
      </span>
    </button>
  );
}

function Chip({ label, active, color, onClick, gender }: { label: string; active: boolean; color: string; onClick: () => void; gender?: FamilyGender }) {
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
      {gender && <Shape gender={gender} size={12} strokeWidth={2} stroke={active ? "#0a0e1a" : color} fill="none" />}
      {label}
    </button>
  );
}

function relationOf(link: FamilyLink): { relation: Relation; target: string | null } {
  if (link.parentIds.length) return { relation: "child", target: link.parentIds[0] };
  if (link.partnerId) return { relation: "partner", target: link.partnerId };
  if (link.childIds.length) return { relation: "parent", target: link.childIds[0] };
  if (link.friendIds.length) return { relation: "friend", target: link.friendIds[0] };
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
  const { language, t } = useI18n();
  // Role keys may carry a " · FATHER'S SIDE" detail for languages that name each side
  // differently; English (and any missing translation) falls back to the plain role.
  const roleText = (key: string) => {
    if (!key) return "";
    if (language === "en") return roleBase(key);
    const full = t(key);
    return full !== key ? full : t(roleBase(key));
  };
  const [busy, setBusy] = useState(false);

  // Partners as the rest of the house has them, so "child of Mum" also makes you Dad's.
  const othersGraph = useMemo(
    () => familyGraph(members.map((m) => (m.id === selfId ? { ...m, family: null } : m))),
    [members, selfId],
  );
  const draft: FamilyLink = useMemo(() => {
    const base: FamilyLink = { gender, parentIds: [], partnerId: null, childIds: [], friendIds: [] };
    if (!target || relation === "alone") return base;
    if (relation === "partner") return { ...base, partnerId: target };
    if (relation === "parent") return { ...base, childIds: [target] };
    if (relation === "friend") return { ...base, friendIds: [target] };
    const partner = othersGraph.partnerOf.get(target);
    return { ...base, parentIds: partner && partner !== selfId ? [target, partner] : [target] };
  }, [gender, relation, target, othersGraph, selfId]);

  const editing = members.map((m) => (m.id === selfId ? { ...m, family: draft } : m));
  const shown = house ? members : editing;
  const layout = useMemo(() => layoutFamilyTree(shown), [shown]);
  // Everyone is named by what they are to you: Mum's husband is your SON-IN-LAW if Mum is your daughter.
  const labels = useMemo(() => relationLabels(shown, selfId), [shown, selfId]);
  // What you'll be to the person you're attaching to, e.g. "MUM'S DAUGHTER".
  const previewLabel = target && relation !== "alone" ? relationLabels(editing, target).get(selfId) ?? "" : "";
  const byId = Object.fromEntries(shown.map((m) => [m.id, m]));

  const needsTarget = relation !== "alone";
  const dirty = !saved || JSON.stringify(draft) !== JSON.stringify(saved);
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
  const legend = (content: React.ReactNode, text: string) => (
    <div key={text} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {content}
      <span style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{text}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title={t("FAMILY TREE")} titleColor="#00d4ff" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>
        <PixelPanel accent="#00ff88" className="w-full">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <IconTree size={18} color="#00ff88" />
            <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#00ff88" }}>{house?.name ?? t("YOUR HOUSE")}</div>
          </div>
          {layout.nodes.length ? (
            <div style={{ overflowX: "auto", scrollbarWidth: "thin" }}>
              <div style={{ position: "relative", width: layout.width, height: layout.height, margin: "0 auto" }}>
                <svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0 }} aria-hidden>
                  {layout.segments.map((s) => (
                    <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                      stroke={s.dashed ? "#ffe66d" : "#6b8ba4"} strokeWidth={2}
                      strokeDasharray={s.dashed ? "4 4" : undefined} strokeLinecap="square" />
                  ))}
                </svg>
                {layout.nodes.map((n) => byId[n.id] && (
                  <div key={n.id} style={{ position: "absolute", left: n.x - NODE_W / 2, top: n.y }}>
                    <MemberNode
                      member={byId[n.id]}
                      label={roleText(labels.get(n.id) ?? "")}
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
              {t("The tree is empty. Add your branch below to start it.")}
            </div>
          )}
          {layout.unplaced.length > 0 && (
            <>
              {label(t("NOT ON THE TREE YET"))}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {layout.unplaced.map((id) => byId[id] && (
                  <MemberNode key={id} member={byId[id]} label="" isSelf={id === selfId}
                    picked={pickFromTree && dirty && target === id}
                    onPick={pickFromTree && id !== selfId ? () => setTarget(id) : undefined} />
                ))}
              </div>
            </>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 10 }}>
            {GENDERS.map((g) => legend(<Shape gender={g.id} size={12} strokeWidth={2} stroke={SHAPE_COLOR[g.id]} fill="none" />, t(g.label)))}
            {legend(<svg width={16} height={4} aria-hidden><line x1={0} y1={2} x2={16} y2={2} stroke="#ffe66d" strokeWidth={2} strokeDasharray="3 3" /></svg>, t("FRIEND"))}
          </div>
        </PixelPanel>

        {me && !house && (
          <PixelPanel accent="#4ecdc4" className="w-full">
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.5, marginBottom: 10 }}>
              {t("Your family tree lives in your house. Create or join one, then add your branch.")}
            </div>
            <PixelButton onClick={onInvite} color="#4ecdc4" size="md" full>{t("PLAY WITH OTHERS")}</PixelButton>
          </PixelPanel>
        )}

        {me && house && (
          <PixelPanel accent="#c77dff" className="w-full">
            <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#c77dff" }}>{t("ADD YOUR BRANCH")}</div>
            {label(t("YOU ARE"))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {GENDERS.map((g) => (
                <Chip key={g.id} label={t(g.label)} gender={g.id} color={SHAPE_COLOR[g.id]} active={gender === g.id} onClick={() => setGender(g.id)} />
              ))}
            </div>

            {others.length > 0 && (
              <>
                {label(t("YOUR PLACE"))}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                  {RELATIONS.map((r) => (
                    <Chip key={r.id} label={t(r.label)} color="#c77dff" active={relation === r.id}
                      onClick={() => { setRelation(r.id); if (r.id === "alone") setTarget(null); }} />
                  ))}
                </div>
                {needsTarget && (
                  <>
                    {label(t("WHO? (OR TAP THEM ON THE TREE)"))}
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
                {needsTarget && target && byId[target] && previewLabel
                  ? <span style={{ color: "#00ff88" }}>{t("YOU'LL BE {name}'S {role}", { name: byId[target].name, role: roleText(previewLabel) })}</span>
                  : t("YOU'LL BE ON THE TREE ON YOUR OWN")}
              </div>
            )}
            <div style={{ height: 14 }} />
            <PixelButton onClick={() => { void save(); }} color="#00ff88" size="md" full disabled={!canSave}>
              {busy ? t("SAVING…") : t("[ SAVE MY BRANCH ]")}
            </PixelButton>
            {msg && (
              <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: msg === "SAVED" ? "#00ff88" : "#ff6b35", textAlign: "center", marginTop: 10 }}>{t(msg)}</div>
            )}
          </PixelPanel>
        )}
      </div>
    </div>
  );
}
