// The family tree diagram. Every member records only their own place (gender plus who
// they are a child, partner or parent of); this merges those records into one tree,
// names everyone from where they sit (Mum, Grandpa, Son…) and lays it out with tidy
// right-angled connectors: couple line → one drop → sibling bar → one drop per child.
import type { FamilyGender, FamilyLink, MemberView } from "../../services/house";

export const NODE_W = 92;
export const NODE_H = 92;
const H_GAP = 20;
const COUPLE_GAP = 24;
const ROW_GAP = 60;
const PAD = 14;

export type TreeNode = { id: string; x: number; y: number };
export type TreeSegment = { key: string; x1: number; y1: number; x2: number; y2: number };
export type TreeLayout = { nodes: TreeNode[]; segments: TreeSegment[]; width: number; height: number; unplaced: string[] };

const EMPTY: FamilyLink = { role: null, gender: null, parentIds: [], partnerId: null, childIds: [] };
export const linkOf = (m: MemberView): FamilyLink => ({ ...EMPTY, ...(m.family ?? {}) });

/** Everyone's records merged: parent sets and (first-claim-wins) partners. */
export function familyGraph(members: MemberView[]) {
  const ids = new Set(members.map((m) => m.id));
  const parentsOf = new Map<string, Set<string>>(members.map((m) => [m.id, new Set<string>()]));
  for (const m of members) {
    const link = linkOf(m);
    for (const p of link.parentIds) if (ids.has(p) && p !== m.id) parentsOf.get(m.id)!.add(p);
    for (const c of link.childIds) if (ids.has(c) && c !== m.id) parentsOf.get(c)!.add(m.id);
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
  return { parentsOf, partnerOf, familyOf, childrenOf };
}

/** Mum, Dad, Grandma, Son… worked out from each person's place on the tree. */
export function familyLabels(members: MemberView[]): Map<string, string> {
  const { parentsOf, partnerOf, childrenOf } = familyGraph(members);
  const memo = new Map<string, number>();
  const depth = (id: string, seen = new Set<string>()): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const d = Math.max(0, ...childrenOf(id).map((c) => depth(c, seen) + 1));
    memo.set(id, d);
    return d;
  };
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
    labels.set(m.id, label);
  }
  return labels;
}

export function layoutFamilyTree(members: MemberView[]): TreeLayout {
  const { parentsOf, partnerOf, familyOf } = familyGraph(members);
  const order = new Map(members.map((m, i) => [m.id, i]));

  const placedSet = new Set<string>();
  for (const m of members) if (linkOf(m).gender) placedSet.add(m.id);
  for (const [c, ps] of parentsOf) if (ps.size) { placedSet.add(c); ps.forEach((p) => placedSet.add(p)); }
  partnerOf.forEach((_, id) => placedSet.add(id));
  const placed = members.map((m) => m.id).filter((id) => placedSet.has(id));
  const unplaced = members.map((m) => m.id).filter((id) => !placedSet.has(id));

  // Generations: below every parent, level with your partner.
  const gen = new Map(placed.map((id) => [id, 0]));
  for (let pass = 0; pass < placed.length * 3 + 2; pass += 1) {
    let changed = false;
    for (const [c, ps] of parentsOf) for (const p of ps) {
      if ((gen.get(c) ?? 0) < (gen.get(p) ?? 0) + 1) { gen.set(c, (gen.get(p) ?? 0) + 1); changed = true; }
    }
    for (const [a, b] of partnerOf) {
      const g = Math.max(gen.get(a) ?? 0, gen.get(b) ?? 0);
      if (gen.get(a) !== g) { gen.set(a, g); changed = true; }
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
    for (const id of row.sort((a, b) => order.get(a)! - order.get(b)!)) {
      if (seen.has(id)) continue;
      seen.add(id);
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

  const all = [...pos.values()];
  const minLeft = all.length ? Math.min(...all.map((p) => p.x - NODE_W / 2)) : 0;
  const maxRight = all.length ? Math.max(...all.map((p) => p.x + NODE_W / 2)) : NODE_W;
  for (const p of all) { p.x += PAD - minLeft; p.y += PAD; }
  const width = maxRight - minLeft + PAD * 2;
  const height = rowCount ? PAD * 2 + rowCount * NODE_H + (rowCount - 1) * ROW_GAP : 0;

  const segments: TreeSegment[] = [];
  const seg = (key: string, x1: number, y1: number, x2: number, y2: number) => segments.push({ key, x1, y1, x2, y2 });
  const at = (id: string) => pos.get(id)!;

  // Couple lines.
  for (const units of rowUnits) for (const u of units) {
    if (u.length !== 2) continue;
    const [l, r] = [at(u[0]), at(u[1])].sort((a, b) => a.x - b.x);
    seg(`couple-${u.join("-")}`, l.x + NODE_W / 2, l.y + NODE_H / 2, r.x - NODE_W / 2, l.y + NODE_H / 2);
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
      const offset = (i - (keys.length - 1) / 2) * 8;
      const barY = PAD + row * (NODE_H + ROW_GAP) - ROW_GAP / 2 + offset;
      const couple = parents.length === 2 && partnerOf.get(parents[0]) === parents[1];
      const origins: [number, number][] = couple
        ? [[(at(parents[0]).x + at(parents[1]).x) / 2, at(parents[0]).y + NODE_H / 2]]
        : parents.map((p) => [at(p).x, at(p).y + NODE_H]);
      origins.forEach(([ox, oy], k) => seg(`drop-${key}-${k}`, ox, oy, ox, barY));
      const xs = [...kids.map((k) => at(k).x), ...origins.map(([ox]) => ox)];
      if (Math.max(...xs) - Math.min(...xs) > 0.5) seg(`bar-${key}`, Math.min(...xs), barY, Math.max(...xs), barY);
      for (const k of kids) seg(`kid-${key}-${k}`, at(k).x, barY, at(k).x, at(k).y);
    });
  }

  return { nodes: placed.map((id) => ({ id, ...at(id) })), segments, width, height, unplaced };
}
