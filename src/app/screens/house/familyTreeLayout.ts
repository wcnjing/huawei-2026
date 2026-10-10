// The family tree diagram. Every member records only their own place (gender plus who
// they are a child, partner, parent or friend of); this merges those records into one
// tree, names everyone from where they sit (Mum, Grandpa, Son…) and lays it out with
// tidy right-angled connectors: couple line → one drop → sibling bar → one drop per
// child. Friends stand beside the person they're friends with, joined by a dashed line.
import type { FamilyGender, FamilyLink, MemberView } from "../../services/house";
import { emptyFamilyTree, familyLevels, familyLinkFor, type FamilyTree } from "../../../../server/family-rules.js";

/** The shape (square, circle, triangle) is SHAPE px; name and label sit underneath. */
export const SHAPE = 44;
export const NODE_W = 82;
export const NODE_H = SHAPE + 34;
const SHAPE_MID = SHAPE / 2;
const H_GAP = 14;
const COUPLE_GAP = 20;
const ROW_GAP = 40;
const PAD = 12;

export type TreeNode = { id: string; x: number; y: number };
export type TreeSegment = { key: string; x1: number; y1: number; x2: number; y2: number; dashed?: boolean };
export type TreeLayout = { nodes: TreeNode[]; segments: TreeSegment[]; width: number; height: number; unplaced: string[] };

const EMPTY: FamilyLink = { gender: null, parentIds: [], partnerId: null, childIds: [], friendIds: [] };
export const linkOf = (m: MemberView): FamilyLink => {
  const link = { ...EMPTY, ...(m.family ?? {}) };
  return { ...link, friendIds: link.friendIds ?? [] };
};

/** The house's shared tree, rebuilt from each member's view of it. */
export function treeFromMembers(members: MemberView[]): FamilyTree {
  const tree = emptyFamilyTree();
  const ids = new Set(members.map((m) => m.id));
  const seen = new Set<string>();
  const add = (list: [string, string][], a: string, b: string, ordered: boolean) => {
    if (!ids.has(a) || !ids.has(b) || a === b) return;
    const edge: [string, string] = ordered || a < b ? [a, b] : [b, a];
    const key = `${list === tree.parents ? "p" : list === tree.partners ? "s" : "f"}:${edge.join("|")}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push(edge);
  };
  for (const m of members) {
    const link = linkOf(m);
    if (link.gender) tree.genders[m.id] = link.gender;
    for (const p of link.parentIds) add(tree.parents, p, m.id, true);
    for (const c of link.childIds) add(tree.parents, m.id, c, true);
    if (link.partnerId) add(tree.partners, m.id, link.partnerId, false);
    for (const f of link.friendIds) add(tree.friends, m.id, f, false);
  }
  return tree;
}

/** The members as they'd look with `tree` as the house's family tree. */
export const withTree = (members: MemberView[], tree: FamilyTree): MemberView[] =>
  members.map((m) => ({ ...m, family: familyLinkFor(tree, m.id) }));

/** Everyone's records merged: parent sets, (first-claim-wins) partners and friends. */
export function familyGraph(members: MemberView[]) {
  const ids = new Set(members.map((m) => m.id));
  const parentsOf = new Map<string, Set<string>>(members.map((m) => [m.id, new Set<string>()]));
  const friendsOf = new Map<string, Set<string>>(members.map((m) => [m.id, new Set<string>()]));
  for (const m of members) {
    const link = linkOf(m);
    for (const p of link.parentIds) if (ids.has(p) && p !== m.id) parentsOf.get(m.id)!.add(p);
    for (const c of link.childIds) if (ids.has(c) && c !== m.id) parentsOf.get(c)!.add(m.id);
    for (const f of link.friendIds) if (ids.has(f) && f !== m.id) { friendsOf.get(m.id)!.add(f); friendsOf.get(f)!.add(m.id); }
  }
  const partnerOf = new Map<string, string>();
  for (const m of members) {
    const p = linkOf(m).partnerId;
    if (!p || !ids.has(p) || p === m.id || partnerOf.has(m.id) || partnerOf.has(p)) continue;
    partnerOf.set(m.id, p);
    partnerOf.set(p, m.id);
  }
  // A child of one partner is shown as the child of the couple.
  const familyOf = (child: string): string[] => {
    const ps = [...(parentsOf.get(child) ?? [])];
    if (ps.length === 1 && partnerOf.has(ps[0])) ps.push(partnerOf.get(ps[0])!);
    return ps.sort();
  };
  const childrenOf = (id: string): string[] =>
    [...parentsOf.keys()].filter((c) => familyOf(c).includes(id));
  /** In the family by blood or marriage, rather than only as someone's friend. */
  const isFamily = (id: string) =>
    (parentsOf.get(id)?.size ?? 0) > 0 || partnerOf.has(id) || childrenOf(id).length > 0;
  return { parentsOf, partnerOf, friendsOf, familyOf, childrenOf, isFamily };
}

/** Mum, Dad, Grandma, Son, Friend… worked out from each person's place on the tree. */
export function familyLabels(members: MemberView[]): Map<string, string> {
  const { parentsOf, partnerOf, friendsOf, childrenOf } = familyGraph(members);
  const memo = new Map<string, number>();
  const depth = (id: string, seen = new Set<string>()): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const d = Math.max(0, ...childrenOf(id).map((c) => depth(c, seen) + 1));
    memo.set(id, d);
    return d;
  };
  // Members whose gender is "other" (triangle) get the neutral word, as do those with none set.
  const pick = (g: FamilyGender | null, male: string, female: string, other: string) =>
    g === "male" ? male : g === "female" ? female : other;
  const labels = new Map<string, string>();
  for (const m of members) {
    const g = linkOf(m).gender;
    const d = depth(m.id);
    let label = "";
    if (d >= 3) label = pick(g, "GREAT-GRANDPA", "GREAT-GRANDMA", "GREAT-GRANDPARENT");
    else if (d === 2) label = pick(g, "GRANDPA", "GRANDMA", "GRANDPARENT");
    else if (d === 1) label = pick(g, "DAD", "MUM", "PARENT");
    else if ((parentsOf.get(m.id)?.size ?? 0) > 0) label = pick(g, "SON", "DAUGHTER", "CHILD");
    else if (partnerOf.has(m.id)) label = pick(g, "HUSBAND", "WIFE", "PARTNER");
    else if ((friendsOf.get(m.id)?.size ?? 0) > 0) label = "FRIEND";
    labels.set(m.id, label);
  }
  return labels;
}

/**
 * Each person's role as it relates to `viewerId` — "SON-IN-LAW", "AUNTIE", "COUSIN"… —
 * found from the shortest chain of parent (P), child (C), partner (S) and friend (F)
 * steps between them. People the viewer isn't connected to keep their place-in-tree
 * label from familyLabels(). The viewer themself maps to "".
 */
export function relationLabels(members: MemberView[], viewerId: string): Map<string, string> {
  const { partnerOf, friendsOf, familyOf, childrenOf } = familyGraph(members);
  const fallback = familyLabels(members);
  const genderOf = new Map(members.map((m) => [m.id, linkOf(m).gender]));
  const steps = (id: string): [string, string][] => [
    ...familyOf(id).map((p): [string, string] => ["P", p]),
    ...childrenOf(id).map((c): [string, string] => ["C", c]),
    ...(partnerOf.has(id) ? [["S", partnerOf.get(id)!] as [string, string]] : []),
    ...[...(friendsOf.get(id) ?? [])].map((f): [string, string] => ["F", f]),
  ];
  const COST: Record<string, number> = { P: 1, C: 1, S: 1.2, F: 2 };
  const best = new Map<string, { path: string; cost: number; first: string }>();
  const walk = (id: string, path: string, cost: number, seen: Set<string>, first = "") => {
    if (path.length >= 5) return;
    for (const [step, next] of steps(id)) {
      if (seen.has(next)) continue;
      const p = path + step;
      const c = cost + COST[step];
      const current = best.get(next);
      const f = first || next;
      if (!current || c < current.cost - 1e-9) best.set(next, { path: p, cost: c, first: f });
      seen.add(next);
      walk(next, p, c, seen, f);
      seen.delete(next);
    }
  };
  if (members.some((m) => m.id === viewerId)) walk(viewerId, "", 0, new Set([viewerId]));

  const labels = new Map<string, string>();
  for (const m of members) {
    if (m.id === viewerId) { labels.set(m.id, ""); continue; }
    const found = best.get(m.id);
    labels.set(m.id, found
      ? kinTerm(found.path, genderOf.get(m.id) ?? null, genderOf.get(found.first) ?? null)
      : fallback.get(m.id) ?? "");
  }
  return labels;
}

/** The English role, without the " · FATHER'S SIDE"-style detail that only translations use. */
export const roleBase = (key: string) => key.split(" · ")[0];

/**
 * Name for the person at the end of a P/C/S/F path, in their gender. `via` is the gender
 * of the first person on the path (your parent or your partner): Chinese and Tamil name
 * father's-side and mother's-side relatives differently, so those keys carry a
 * " · FATHER'S SIDE" suffix. English shows roleBase(key); the i18n tables translate the
 * full key.
 */
export function kinTerm(path: string, g: FamilyGender | null, via: FamilyGender | null = null): string {
  const pick = (male: string, female: string, other: string) => (g === "male" ? male : g === "female" ? female : other);
  const side = via === "male" ? " · FATHER'S SIDE" : via === "female" ? " · MOTHER'S SIDE" : "";
  const spouseSide = via === "male" ? " · HUSBAND'S SIDE" : via === "female" ? " · WIFE'S SIDE" : "";
  const withSide = (term: string, suffix: string) => (g === "male" || g === "female" ? term + suffix : term);
  switch (path) {
    case "PP": return withSide(pick("GRANDPA", "GRANDMA", "GRANDPARENT"), side);
    case "PPC": return withSide(pick("UNCLE", "AUNTIE", "PARENT'S SIBLING"), side);
    case "PPCS": return withSide(pick("UNCLE", "AUNTIE", "PARENT'S SIBLING"), side ? `${side} · BY MARRIAGE` : "");
    case "SP": return withSide(pick("FATHER-IN-LAW", "MOTHER-IN-LAW", "PARENT-IN-LAW"), spouseSide);
    case "P": return pick("DAD", "MUM", "PARENT");
    case "C": return pick("SON", "DAUGHTER", "CHILD");
    case "S": return pick("HUSBAND", "WIFE", "PARTNER");
    case "PC": return pick("BROTHER", "SISTER", "SIBLING");
    case "CC": return pick("GRANDSON", "GRANDDAUGHTER", "GRANDCHILD");
    case "PPP": return pick("GREAT-GRANDPA", "GREAT-GRANDMA", "GREAT-GRANDPARENT");
    case "CCC": return pick("GREAT-GRANDSON", "GREAT-GRANDDAUGHTER", "GREAT-GRANDCHILD");
    case "PCC": case "SPCC": return pick("NEPHEW", "NIECE", "SIBLING'S CHILD");
    case "PPCC": return "COUSIN";
    case "CS": return pick("SON-IN-LAW", "DAUGHTER-IN-LAW", "CHILD-IN-LAW");
    case "CCS": return pick("GRANDSON-IN-LAW", "GRANDDAUGHTER-IN-LAW", "GRANDCHILD-IN-LAW");
    case "SPP": return pick("GRANDPA-IN-LAW", "GRANDMA-IN-LAW", "GRANDPARENT-IN-LAW");
    case "SPC": case "PCS": return pick("BROTHER-IN-LAW", "SISTER-IN-LAW", "SIBLING-IN-LAW");
    case "SC": return pick("STEPSON", "STEPDAUGHTER", "STEPCHILD");
    case "PS": return pick("STEPDAD", "STEPMUM", "STEP-PARENT");
    case "F": return "FRIEND";
    default:
      if (path.includes("F")) return "FAMILY FRIEND";
      if (path.includes("S")) return "IN-LAW";
      return "RELATIVE";
  }
}

export function layoutFamilyTree(members: MemberView[]): TreeLayout {
  const { parentsOf, partnerOf, friendsOf, familyOf, isFamily } = familyGraph(members);
  const order = new Map(members.map((m, i) => [m.id, i]));

  const placedSet = new Set<string>();
  for (const m of members) if (linkOf(m).gender) placedSet.add(m.id);
  for (const [c, ps] of parentsOf) if (ps.size) { placedSet.add(c); ps.forEach((p) => placedSet.add(p)); }
  partnerOf.forEach((_, id) => placedSet.add(id));
  friendsOf.forEach((fs, id) => { if (fs.size) placedSet.add(id); });
  const placed = members.map((m) => m.id).filter((id) => placedSet.has(id));
  const unplaced = members.map((m) => m.id).filter((id) => !placedSet.has(id));

  // Someone who is only a friend stands next to the first friend who is in the family.
  const friendAnchor = new Map<string, string>();
  for (const id of placed) {
    if (isFamily(id)) continue;
    const anchor = [...(friendsOf.get(id) ?? [])].sort((a, b) => order.get(a)! - order.get(b)!).find(isFamily)
      ?? [...(friendsOf.get(id) ?? [])].sort((a, b) => order.get(a)! - order.get(b)!)[0];
    if (anchor) friendAnchor.set(id, anchor);
  }

  // Generations: exactly one below each parent, level with your partner and your
  // friends (the server only accepts trees where that all holds at once).
  const levels = familyLevels(treeFromMembers(members), placed);
  const gen = new Map(placed.map((id) => [id, levels?.get(id) ?? 0]));
  for (let pass = 0; !levels && pass < placed.length * 3 + 2; pass += 1) {
    let changed = false;
    for (const [c, ps] of parentsOf) for (const p of ps) {
      if ((gen.get(c) ?? 0) < (gen.get(p) ?? 0) + 1) { gen.set(c, (gen.get(p) ?? 0) + 1); changed = true; }
    }
    for (const [a, b] of partnerOf) {
      const g = Math.max(gen.get(a) ?? 0, gen.get(b) ?? 0);
      if (gen.get(a) !== g) { gen.set(a, g); changed = true; }
    }
    for (const [f, a] of friendAnchor) {
      if (gen.get(f) !== gen.get(a)) { gen.set(f, gen.get(a) ?? 0); changed = true; }
    }
    if (!changed) break;
  }
  const rowCount = placed.length ? Math.max(...gen.values()) + 1 : 0;
  const rows: string[][] = Array.from({ length: rowCount }, () => []);
  for (const id of placed) rows[gen.get(id)!].push(id);

  const pos = new Map<string, { x: number; y: number }>();
  const rowUnits: string[][][] = [];
  const unitW = (u: string[]) => u.length * NODE_W + (u.length - 1) * COUPLE_GAP;
  const hasParents = (id: string) => (parentsOf.get(id)?.size ?? 0) > 0;

  rows.forEach((row, g) => {
    const seen = new Set<string>();
    const units: string[][] = [];
    const tagalongs: string[] = [];
    for (const id of row.sort((a, b) => order.get(a)! - order.get(b)!)) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (friendAnchor.has(id)) { tagalongs.push(id); continue; }
      const partner = partnerOf.get(id);
      if (partner && row.includes(partner) && !seen.has(partner)) { seen.add(partner); units.push([id, partner]); }
      else units.push([id]);
    }
    if (g > 0) {
      // Siblings together, each family under its parents.
      const blood = (u: string[]) => u.find(hasParents);
      const anchor = (u: string[]) => {
        const b = blood(u);
        if (!b) return null;
        const xs = familyOf(b).map((p) => pos.get(p)?.x).filter((x): x is number => x !== undefined);
        return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
      };
      const keyed = units.map((u, i) => ({ u, i, a: anchor(u), f: blood(u) ? familyOf(blood(u)!).join() : "" }));
      keyed.sort((l, r) => (l.a ?? Infinity) - (r.a ?? Infinity) || l.f.localeCompare(r.f) || l.i - r.i);
      units.splice(0, units.length, ...keyed.map((k) => k.u));
      // In a couple, the partner born into the tree stands next to their siblings.
      units.forEach((u, i) => {
        if (u.length !== 2 || hasParents(u[0]) === hasParents(u[1])) return;
        const b = hasParents(u[0]) ? u[0] : u[1];
        const other = b === u[0] ? u[1] : u[0];
        const fam = familyOf(b).join();
        const sibling = (unit?: string[]) => !!unit && unit.some((id) => id !== b && hasParents(id) && familyOf(id).join() === fam);
        if (sibling(units[i + 1])) units[i] = [other, b];
        else if (sibling(units[i - 1])) units[i] = [b, other];
        else {
          const a = anchor(u);
          if (a !== null) units[i] = a > 0 ? [other, b] : [b, other];
        }
      });
    }
    // Friends stand right beside the person they're friends with: on the outer side of a
    // couple (so the dashed line never runs across the partner), otherwise to the right.
    for (const f of tagalongs) {
      const a = friendAnchor.get(f)!;
      const at = units.findIndex((u) => u.includes(a));
      if (at < 0) { units.push([f]); continue; }
      const onLeft = units[at].length === 2 && units[at][0] === a;
      if (onLeft) {
        let insertAt = at;
        while (insertAt > 0 && friendAnchor.get(units[insertAt - 1][0]) === a) insertAt -= 1;
        units.splice(insertAt, 0, [f]);
      } else {
        let insertAt = at + 1;
        while (insertAt < units.length && friendAnchor.get(units[insertAt][0]) === a) insertAt += 1;
        units.splice(insertAt, 0, [f]);
      }
    }
    const total = units.reduce((w, u) => w + unitW(u), 0) + H_GAP * Math.max(0, units.length - 1);
    let x = -total / 2;
    const y = g * (NODE_H + ROW_GAP);
    for (const u of units) {
      u.forEach((id, k) => pos.set(id, { x: x + NODE_W / 2 + k * (NODE_W + COUPLE_GAP), y }));
      x += unitW(u) + H_GAP;
    }
    rowUnits.push(units);
  });

  // Bottom-up: centre each parent unit over its children, sweeping right to avoid overlap.
  for (let g = rowUnits.length - 2; g >= 0; g -= 1) {
    let right = -Infinity;
    for (const u of rowUnits[g]) {
      const kids = [...parentsOf.keys()].filter((c) => pos.has(c) && familyOf(c).some((p) => u.includes(p)));
      let left = pos.get(u[0])!.x - NODE_W / 2;
      if (kids.length) {
        const xs = kids.map((k) => pos.get(k)!.x);
        left = (Math.min(...xs) + Math.max(...xs)) / 2 - unitW(u) / 2;
      }
      left = Math.max(left, right + H_GAP);
      u.forEach((id, k) => { pos.get(id)!.x = left + NODE_W / 2 + k * (NODE_W + COUPLE_GAP); });
      right = left + unitW(u);
    }
  }

  // Top-down: slide each group of siblings back under its parents where there's room
  // (a friend standing beside a parent can push the parents off-centre above).
  for (let g = 1; g < rowUnits.length; g += 1) {
    let right = -Infinity;
    const units = rowUnits[g];
    let i = 0;
    while (i < units.length) {
      const blood = units[i].find(hasParents);
      const fam = blood ? familyOf(blood).join() : null;
      let j = i + 1;
      const inGroup = (u: string[], upTo: number) =>
        u.some((id) => hasParents(id) && familyOf(id).join() === fam)
        // a friend standing beside someone in this group moves with it
        || (friendAnchor.has(u[0]) && units.slice(i, upTo).some((v) => v.includes(friendAnchor.get(u[0])!)));
      while (fam && j < units.length && inGroup(units[j], j)) j += 1;
      const group = units.slice(i, j);
      const groupW = group.reduce((w, u) => w + unitW(u), 0) + H_GAP * (group.length - 1);
      let left = pos.get(group[0][0])!.x - NODE_W / 2;
      const parentXs = fam ? familyOf(blood!).map((p) => pos.get(p)?.x).filter((x): x is number => x !== undefined) : [];
      if (parentXs.length) left = (Math.min(...parentXs) + Math.max(...parentXs)) / 2 - groupW / 2;
      left = Math.max(left, right + H_GAP);
      for (const u of group) {
        u.forEach((id, k) => { pos.get(id)!.x = left + NODE_W / 2 + k * (NODE_W + COUPLE_GAP); });
        left += unitW(u) + H_GAP;
      }
      right = left - H_GAP;
      i = j;
    }
  }

  const all = [...pos.values()];
  const minLeft = all.length ? Math.min(...all.map((p) => p.x - NODE_W / 2)) : 0;
  const maxRight = all.length ? Math.max(...all.map((p) => p.x + NODE_W / 2)) : NODE_W;
  for (const p of all) { p.x += PAD - minLeft; p.y += PAD; }
  const width = maxRight - minLeft + PAD * 2;
  const height = rowCount ? PAD * 2 + rowCount * NODE_H + (rowCount - 1) * ROW_GAP : 0;

  const segments: TreeSegment[] = [];
  const seg = (key: string, x1: number, y1: number, x2: number, y2: number, dashed = false) =>
    segments.push({ key, x1, y1, x2, y2, dashed });
  const at = (id: string) => pos.get(id)!;
  const half = SHAPE / 2;

  // Couple lines, shape edge to shape edge.
  for (const units of rowUnits) for (const u of units) {
    if (u.length !== 2) continue;
    const [l, r] = [at(u[0]), at(u[1])].sort((a, b) => a.x - b.x);
    seg(`couple-${u.join("-")}`, l.x + half, l.y + SHAPE_MID, r.x - half, l.y + SHAPE_MID);
  }

  // Friend lines (dashed), always between two people on the same row: straight across
  // when they stand side by side, otherwise a bracket over the heads of whoever is between.
  const drawn = new Set<string>();
  const bracketsOnRow = new Map<number, number>();
  for (const [a, fs] of friendsOf) for (const b of fs) {
    const key = [a, b].sort().join("~");
    if (drawn.has(key) || !pos.has(a) || !pos.has(b)) continue;
    drawn.add(key);
    const [l, r] = [at(a), at(b)].sort((p, q) => p.x - q.x);
    if (l.y !== r.y) { seg(`friend-${key}`, l.x, l.y + SHAPE_MID, r.x, r.y + SHAPE_MID, true); continue; }
    const between = [...pos.values()].some((p) => p.y === l.y && p.x > l.x + 0.5 && p.x < r.x - 0.5);
    if (!between) { seg(`friend-${key}`, l.x + half, l.y + SHAPE_MID, r.x - half, r.y + SHAPE_MID, true); continue; }
    const n = bracketsOnRow.get(l.y) ?? 0;
    bracketsOnRow.set(l.y, n + 1);
    const top = l.y - 7 - n * 5;
    seg(`friend-${key}-l`, l.x, l.y, l.x, top, true);
    seg(`friend-${key}-t`, l.x, top, r.x, top, true);
    seg(`friend-${key}-r`, r.x, top, r.x, r.y, true);
  }

  // One connector per family: drop from the parents, a bar over the children, a drop to each.
  const families = new Map<string, { parents: string[]; kids: string[] }>();
  for (const [c, ps] of parentsOf) {
    if (!ps.size || !pos.has(c)) continue;
    const parents = familyOf(c).filter((p) => pos.has(p));
    const key = parents.join("|");
    if (!families.has(key)) families.set(key, { parents, kids: [] });
    families.get(key)!.kids.push(c);
  }
  const byRow = new Map<number, string[]>();
  for (const [key, f] of families) {
    const row = Math.min(...f.kids.map((k) => gen.get(k)!));
    byRow.set(row, [...(byRow.get(row) ?? []), key]);
  }
  for (const [row, keys] of byRow) {
    keys.forEach((key, i) => {
      const { parents, kids } = families.get(key)!;
      const offset = (i - (keys.length - 1) / 2) * 6;
      const barY = PAD + row * (NODE_H + ROW_GAP) - ROW_GAP / 2 + offset;
      const couple = parents.length === 2 && partnerOf.get(parents[0]) === parents[1];
      const origins: [number, number][] = couple
        ? [[(at(parents[0]).x + at(parents[1]).x) / 2, at(parents[0]).y + SHAPE_MID]]
        : parents.map((p) => [at(p).x, at(p).y + NODE_H]);
      origins.forEach(([ox, oy], k) => seg(`drop-${key}-${k}`, ox, oy, ox, barY));
      const xs = [...kids.map((k) => at(k).x), ...origins.map(([ox]) => ox)];
      if (Math.max(...xs) - Math.min(...xs) > 0.5) seg(`bar-${key}`, Math.min(...xs), barY, Math.max(...xs), barY);
      for (const k of kids) seg(`kid-${key}-${k}`, at(k).x, barY, at(k).x, at(k).y);
    });
  }

  return { nodes: placed.map((id) => ({ id, ...at(id) })), segments, width, height, unplaced };
}
