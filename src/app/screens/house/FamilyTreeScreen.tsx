import { useMemo, useState } from "react";
import type { FamilyEdit, FamilyGender, HouseView, MemberView } from "../../services/house";
import { IconTree } from "../../components/icons";
import { PixelButton, PixelPanel } from "../../components/ui";
import { NODE_H, NODE_W, SHAPE, layoutFamilyTree, linkOf, relationLabels, roleBase, treeFromMembers, withTree } from "./familyTreeLayout";
import { applyFamilyEdit, familyLinkFor, familyProblem } from "../../../../server/family-rules.js";
import { useI18n, useT } from "../../i18n";

const MONO = "'Share Tech Mono', monospace";
const SHAPE_COLOR = { male: "#4ecdc4", female: "#ff6b9d", other: "#ffe66d", none: "#9bb0c8" } as const;
const GENDERS: { id: FamilyGender; label: string }[] = [
  { id: "male", label: "MALE" },
  { id: "female", label: "FEMALE" },
  { id: "other", label: "OTHERS" },
];
/** What the selected person is to someone else. "child" = they are a child of that person. */
type Relation = "child" | "parent" | "partner" | "friend";
const RELATIONS: { id: Relation; label: string }[] = [
  { id: "child", label: "CHILD OF" },
  { id: "parent", label: "PARENT OF" },
  { id: "partner", label: "PARTNER OF" },
  { id: "friend", label: "FRIEND OF" },
];
/** The server edit that makes `person` the `relation` of `other` (add or remove). */
function relationEdit(kind: "add" | "remove", relation: Relation, person: string, other: string): FamilyEdit {
  if (relation === "child") return { kind, relation: "parent", a: other, b: person };
  if (relation === "parent") return { kind, relation: "parent", a: person, b: other };
  return { kind, relation, a: person, b: other };
}

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

// ─────────────────────────────────────────────────────────────────────────
// TAB: FAMILY TREE — one shared tree for the house that every member can edit.
// Tap anyone on the tree to change their gender or their relationships.
// ─────────────────────────────────────────────────────────────────────────
export function FamilyTreeTab({ house, selfId, onEdit }: {
  house: HouseView;
  selfId: string;
  /** Applies the edits to the latest saved tree; resolves to an error message or null. */
  onEdit: (edits: FamilyEdit[]) => Promise<string | null>;
}) {
  const members = house.members;
  const ids = useMemo(() => members.map((m) => m.id), [members]);
  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  const tree = useMemo(() => treeFromMembers(members), [members]);
  const layout = useMemo(() => layoutFamilyTree(members), [members]);
  const labels = useMemo(() => relationLabels(members, selfId), [members, selfId]);

  const [selectedId, setSelectedId] = useState(selfId);
  const selected = byId[selectedId] ? selectedId : selfId;
  const person = byId[selected];
  const link = familyLinkFor(tree, selected);
  const [relation, setRelation] = useState<Relation | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [withPartner, setWithPartner] = useState(true);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const { language, t } = useI18n();
  // Role keys may carry a " · FATHER'S SIDE" detail for languages that name each side
  // differently; English (and any missing translation) falls back to the plain role.
  const roleText = (key: string) => {
    if (!key) return "";
    if (language === "en") return roleBase(key);
    const full = t(key);
    return full !== key ? full : t(roleBase(key));
  };

  const select = (id: string) => { setSelectedId(id); setRelation(null); setTarget(null); setMsg(""); };
  const run = async (edits: FamilyEdit[], after?: () => void) => {
    setBusy(true); setMsg("");
    const error = await onEdit(edits);
    setBusy(false);
    if (error) { setMsg(error); return; }
    setMsg("SAVED");
    after?.();
  };

  // Would these edits still leave a tree that makes sense? (The server checks again.)
  const sensible = (edits: FamilyEdit[]) => !familyProblem(edits.reduce(applyFamilyEdit, tree), ids);
  /** What `selected` already is to `other`, if anything. */
  const currentRelation = (other: string): Relation | null =>
    link.parentIds.includes(other) ? "child"
      : link.childIds.includes(other) ? "parent"
      : link.partnerId === other ? "partner"
      : link.friendIds.includes(other) ? "friend" : null;
  const linked = (a: string, b: string) => {
    const l = familyLinkFor(tree, a);
    return l.parentIds.includes(b) || l.childIds.includes(b) || l.partnerId === b || l.friendIds.includes(b);
  };
  /** Make `selected` the chosen relation of `other`, replacing whatever they were before. */
  const setEdits = (r: Relation, other: string): FamilyEdit[] => {
    const before = currentRelation(other);
    return [
      ...(before && before !== r ? [relationEdit("remove", before, selected, other)] : []),
      relationEdit("add", r, selected, other),
    ];
  };

  // "Child of X": X's partner usually becomes the other parent too.
  const targetPartner = relation === "child" && target ? familyLinkFor(tree, target).partnerId : null;
  const partnerEdit = targetPartner && targetPartner !== selected && !linked(selected, targetPartner)
    ? relationEdit("add", "child", selected, targetPartner) : null;
  const addEdits = (): FamilyEdit[] => {
    if (!relation || !target) return [];
    const main = setEdits(relation, target);
    return partnerEdit && withPartner && sensible([...main, partnerEdit]) ? [...main, partnerEdit] : main;
  };
  const replacing = target ? currentRelation(target) : null;
  const preview = (() => {
    if (!relation || !target) return "";
    const next = withTree(members, addEdits().reduce(applyFamilyEdit, tree));
    return relationLabels(next, target).get(selected) ?? "";
  })();

  const relationships: { relation: Relation; other: string }[] = [
    ...link.parentIds.map((other) => ({ relation: "child" as Relation, other })),
    ...link.childIds.map((other) => ({ relation: "parent" as Relation, other })),
    ...(link.partnerId ? [{ relation: "partner" as Relation, other: link.partnerId }] : []),
    ...link.friendIds.map((other) => ({ relation: "friend" as Relation, other })),
  ];
  const relationName = (r: Relation) => t(RELATIONS.find((x) => x.id === r)!.label);
  const others = members.filter((m) => m.id !== selected);

  const label = (text: string) => (
    <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#9bb0c8", margin: "14px 0 6px" }}>{text}</div>
  );
  const legend = (content: React.ReactNode, text: string) => (
    <div key={text} style={{ display: "flex", alignItems: "center", gap: 5 }}>
      {content}
      <span style={{ fontFamily: MONO, fontSize: "var(--text-caption)", color: "#9bb0c8" }}>{text}</span>
    </div>
  );
  const node = (id: string) => (
    <MemberNode
      member={byId[id]}
      label={roleText(labels.get(id) ?? "")}
      isSelf={id === selfId}
      picked={id === selected}
      onPick={() => select(id)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <PixelPanel accent="#00ff88" className="w-full">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IconTree size={18} color="#00ff88" />
          <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#00ff88" }}>{house.name}</div>
        </div>
        {layout.nodes.length ? (
          <div style={{ overflowX: "auto", scrollbarWidth: "thin" }}>
            <div style={{ position: "relative", width: layout.width, height: layout.height, margin: "0 auto" }}>
              <svg width={layout.width} height={layout.height} style={{ position: "absolute", inset: 0, overflow: "visible" }} aria-hidden>
                {layout.segments.map((s) => (
                  <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke={s.dashed ? "#ffe66d" : "#6b8ba4"} strokeWidth={2}
                    strokeDasharray={s.dashed ? "4 4" : undefined} strokeLinecap="square" />
                ))}
              </svg>
              {layout.nodes.map((n) => byId[n.id] && (
                <div key={n.id} style={{ position: "absolute", left: n.x - NODE_W / 2, top: n.y }}>{node(n.id)}</div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#9bb0c8", lineHeight: 1.5 }}>
            {t("The tree is empty. Tap someone below to start it.")}
          </div>
        )}
        {layout.unplaced.length > 0 && (
          <>
            {label(t("NOT ON THE TREE YET"))}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {layout.unplaced.map((id) => byId[id] && <div key={id}>{node(id)}</div>)}
            </div>
          </>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 10 }}>
          {GENDERS.map((g) => legend(<Shape gender={g.id} size={12} strokeWidth={2} stroke={SHAPE_COLOR[g.id]} fill="none" />, t(g.label)))}
          {legend(<svg width={16} height={4} aria-hidden><line x1={0} y1={2} x2={16} y2={2} stroke="#ffe66d" strokeWidth={2} strokeDasharray="3 3" /></svg>, t("FRIEND"))}
        </div>
      </PixelPanel>

      {person && (
        <PixelPanel accent="#c77dff" className="w-full">
          <div style={{ fontFamily: MONO, fontSize: "var(--text-label)", color: "#9bb0c8", marginBottom: 6 }}>{t("GENDER")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {GENDERS.map((g) => (
              <Chip key={g.id} label={t(g.label)} gender={g.id} color={SHAPE_COLOR[g.id]} active={link.gender === g.id}
                onClick={() => { if (!busy && link.gender !== g.id) void run([{ kind: "gender", id: selected, gender: g.id }]); }} />
            ))}
          </div>

          {label(t("RELATIONSHIPS"))}
          {relationships.length ? relationships.map(({ relation: r, other }) => byId[other] && (
            <div key={`${r}-${other}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "2px solid #2a3a5c" }}>
              <div style={{ flex: 1, fontFamily: MONO, fontSize: "var(--text-body)", color: "#e8f4f8" }}>
                {relationName(r)} <span style={{ color: "#ffe66d" }}>{byId[other].name}</span>
              </div>
              <button type="button" disabled={busy}
                onClick={() => void run([relationEdit("remove", r, selected, other)])}
                aria-label={t("Remove {relation} {name}", { relation: relationName(r), name: byId[other].name })}
                style={{ minWidth: 40, minHeight: 36, background: "none", border: "2px solid #2a3a5c", color: "#ff6b35", fontFamily: MONO, cursor: "pointer" }}>✕</button>
            </div>
          )) : (
            <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#6b8ba4" }}>{t("No relationships yet.")}</div>
          )}

          {others.length > 0 && (
            <>
              {label(t("ADD A RELATIONSHIP"))}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                {RELATIONS.map((r) => (
                  <Chip key={r.id} label={t(r.label)} color="#c77dff" active={relation === r.id}
                    onClick={() => { setRelation(r.id); setTarget(null); setMsg(""); }} />
                ))}
              </div>
              {relation && (
                <>
                  {label(t("WHO?"))}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {others.map((m) => {
                      // Someone already linked can be tapped to change that relationship.
                      const ok = currentRelation(m.id) !== relation && sensible(setEdits(relation, m.id));
                      return (
                        <button key={m.id} type="button" disabled={!ok} aria-pressed={target === m.id}
                          onClick={() => setTarget(m.id)}
                          style={{
                            fontFamily: MONO, fontSize: "var(--text-caption)", padding: "8px 10px",
                            backgroundColor: target === m.id ? "#ffe66d" : "#0a0e1a",
                            color: target === m.id ? "#0a0e1a" : ok ? "#e8f4f8" : "#4a5a78",
                            border: `2px solid ${target === m.id ? "#ffe66d" : "#2a3a5c"}`,
                            textDecoration: ok ? "none" : "line-through", cursor: ok ? "pointer" : "not-allowed",
                          }}>{m.name}</button>
                      );
                    })}
                  </div>
                  {partnerEdit && targetPartner && byId[targetPartner] && sensible([...setEdits("child", target!), partnerEdit]) && (
                    <div style={{ marginTop: 8 }}>
                      <Chip label={t("ALSO {name}'S CHILD", { name: byId[targetPartner].name })} color="#00ff88"
                        active={withPartner} onClick={() => setWithPartner(!withPartner)} />
                    </div>
                  )}
                  {target && byId[target] && (
                    <div style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: "#00ff88", marginTop: 12 }}>
                      {preview
                        ? t("{person} WILL BE {name}'S {role}", { person: person.name, name: byId[target].name, role: roleText(preview) })
                        : `${person.name} · ${relationName(relation)} ${byId[target].name}`}
                      {replacing && (
                        <div style={{ color: "#ffe66d", marginTop: 4 }}>
                          {t("INSTEAD OF {relation} {name}", { relation: relationName(replacing), name: byId[target].name })}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={{ height: 12 }} />
                  <PixelButton onClick={() => void run(addEdits(), () => { setRelation(null); setTarget(null); })}
                    color="#00ff88" size="md" full disabled={!target || busy}>
                    {busy ? t("SAVING…") : replacing ? t("[ CHANGE ]") : t("[ ADD ]")}
                  </PixelButton>
                </>
              )}
            </>
          )}
          {msg && (
            <div role="status" style={{ fontFamily: MONO, fontSize: "var(--text-body)", color: msg === "SAVED" ? "#00ff88" : "#ff6b35", textAlign: "center", marginTop: 10, lineHeight: 1.5 }}>{t(msg)}</div>
          )}
        </PixelPanel>
      )}
    </div>
  );
}
