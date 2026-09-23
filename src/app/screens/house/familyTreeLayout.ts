// Turns every member's own family record into one diagram: who sits in which
// generation, left-to-right order, and the connector lines between them.
import type { FamilyLink, MemberView } from "../../services/house";

export const NODE_W = 84;
export const NODE_H = 92;
const H_GAP = 18;
const COUPLE_GAP = 14;
const ROW_GAP = 46;
const PAD = 12;

export type TreeNode = { id: string; x: number; y: number };
export type TreeLine = { key: string; points: [number, number][] };
export type TreeLayout = {
  nodes: TreeNode[];
  lines: TreeLine[];
  width: number;
  height: number;
  unplaced: string[];
  parentsOf: Map<string, Set<string>>;
  partnerOf: Map<string, string>;
};

const EMPTY: FamilyLink = { role: null, parentIds: [], partnerId: null, childIds: [] };

export function linkOf(member: MemberView): FamilyLink {
  return member.family ?? EMPTY;
}

/** The merged relations everyone has entered. */
export function familyGraph(members: MemberView[]) {
  const ids = new Set(members.map((m) => m.id));
  const parentsOf = new Map<string, Set<string>>(members.map((m) => [m.id, new Set<string>()]));
  for (const m of members) {
    const link = linkOf(m);
    for (const p of link.parentIds) if (ids.has(p) && p !== m.id) parentsOf.get(m.id)!.add(p);
    for (const c of link.childIds) if (ids.has(c) && c !== m.id) parentsOf.get(c)!.add(m.id);
  }
  // First claim wins if two people name different partners.
  const partnerOf = new Map<string, string>();
  for (const m of members) {
    const p = linkOf(m).partnerId;
    if (!p || !ids.has(p) || p === m.id || partnerOf.has(m.id) || partnerOf.has(p)) continue;
    partnerOf.set(m.id, p);
    partnerOf.set(p, m.id);
  }
  return { parentsOf, partnerOf };
}

export function layoutFamilyTree(members: MemberView[]): TreeLayout {
  const { parentsOf, partnerOf } = familyGraph(members);
  const order = new Map(members.map((m, i) => [m.id, i]));

  const linked = new Set<string>();
  for (const [child, parents] of parentsOf) {
    if (parents.size) { linked.add(child); parents.forEach((p) => linked.add(p)); }
  }
  partnerOf.forEach((_, id) => linked.add(id));
  const placed = members.map((m) => m.id).filter((id) => linked.has(id));
  const unplaced = members.map((m) => m.id).filter((id) => !linked.has(id));

  // Generations: children sit below their parents; partners share a row.
  const gen = new Map(placed.map((id) => [id, 0]));
  for (let pass = 0; pass < placed.length * 3 + 2; pass += 1) {
    let changed = false;
    for (const [child, parents] of parentsOf) {
      for (const p of parents) {
        const want = (gen.get(p) ?? 0) + 1;
        if ((gen.get(child) ?? 0) < want) { gen.set(child, want); changed = true; }
      }
    }
    for (const [a, b] of partnerOf) {
      const g = Math.max(gen.get(a) ?? 0, gen.get(b) ?? 0);
      if (gen.get(a) !== g) { gen.set(a, g); changed = true; }
    }
    if (!changed) break;
  }
  const maxGen = Math.max(0, ...gen.values());

  const rows: string[][] = Array.from({ length: maxGen + 1 }, () => []);
  for (const id of placed) rows[gen.get(id)!].push(id);

  const pos = new Map<string, { x: number; y: number }>();
  const rowUnits: string[][][] = [];

  rows.forEach((row, g) => {
    // Group partners into one unit.
    const seen = new Set<string>();
    const units: string[][] = [];
    for (const id of row.sort((a, b) => order.get(a)! - order.get(b)!)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const partner = partnerOf.get(id);
      if (partner && row.includes(partner) && !seen.has(partner)) { seen.add(partner); units.push([id, partner]); }
      else units.push([id]);
    }
    // Under their parents: order units by where their parents sit.
    const anchor = (unit: string[]) => {
      const xs: number[] = [];
      for (const id of unit) for (const p of parentsOf.get(id) ?? []) { const at = pos.get(p); if (at) xs.push(at.x); }
      return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
    };
    if (g > 0) {
      const keyed = units.map((u, i) => ({ u, i, a: anchor(u) }));
      keyed.sort((l, r) => (l.a ?? Infinity) - (r.a ?? Infinity) || l.i - r.i);
      units.splice(0, units.length, ...keyed.map((k) => k.u));
      // Inside a couple, the one with parents on the tree sits next to their siblings.
      const shareParent = (id: string, unit: string[] | undefined) =>
        !!unit && unit.some((o) => [...(parentsOf.get(id) ?? [])].some((p) => parentsOf.get(o)?.has(p)));
      units.forEach((u, i) => {
        if (u.length !== 2) return;
        const [a, b] = u;
        const aHas = (parentsOf.get(a)?.size ?? 0) > 0;
        const bHas = (parentsOf.get(b)?.size ?? 0) > 0;
        if (aHas === bHas) return;
        const p = aHas ? a : b;
        const other = aHas ? b : a;
        if (shareParent(p, units[i + 1])) units[i] = [other, p];
        else if (shareParent(p, units[i - 1])) units[i] = [p, other];
      });
    }
    // Lay the row out centred on x = 0 so rows line up before the final shift.
    const rowWidth = units.reduce((w, u) => w + u.length * NODE_W + (u.length - 1) * COUPLE_GAP, 0) + H_GAP * Math.max(0, units.length - 1);
    let x = -rowWidth / 2;
    for (const unit of units) {
      unit.forEach((id, k) => {
        pos.set(id, { x: x + NODE_W / 2, y: g * (NODE_H + ROW_GAP) });
        x += NODE_W + (k < unit.length - 1 ? COUPLE_GAP : 0);
      });
      x += H_GAP;
    }
    rowUnits.push(units);
  });

  // Bottom-up: centre each parent unit over its children, then push apart any overlap.
  const unitWidth = (u: string[]) => u.length * NODE_W + (u.length - 1) * COUPLE_GAP;
  for (let g = rowUnits.length - 2; g >= 0; g -= 1) {
    let right = -Infinity;
    for (const unit of rowUnits[g]) {
      const kids = new Set<string>();
      for (const [child, parents] of parentsOf) if (unit.some((id) => parents.has(id)) && pos.has(child)) kids.add(child);
      const current = pos.get(unit[0])!.x - NODE_W / 2;
      let left = current;
      if (kids.size) {
        const xs = [...kids].map((k) => pos.get(k)!.x);
        left = (Math.min(...xs) + Math.max(...xs)) / 2 - unitWidth(unit) / 2;
      }
      left = Math.max(left, right + H_GAP);
      unit.forEach((id, k) => { pos.get(id)!.x = left + NODE_W / 2 + k * (NODE_W + COUPLE_GAP); });
      right = left + unitWidth(unit);
    }
  }

  const all = [...pos.values()];
  const minLeft = all.length ? Math.min(...all.map((p) => p.x - NODE_W / 2)) : 0;
  const maxRight = all.length ? Math.max(...all.map((p) => p.x + NODE_W / 2)) : NODE_W;
  const width = maxRight - minLeft + PAD * 2;
  for (const at of all) { at.x += PAD - minLeft; at.y += PAD; }

  const lines: TreeLine[] = [];
  const midY = (id: string) => pos.get(id)!.y + NODE_H / 2;
  for (const units of rowUnits) {
    for (const u of units) {
      if (u.length !== 2) continue;
      const [a, b] = u.map((id) => pos.get(id)!);
      const left = Math.min(a.x, b.x) + NODE_W / 2;
      const right = Math.max(a.x, b.x) - NODE_W / 2;
      lines.push({ key: `couple-${u.join("-")}`, points: [[left, midY(u[0])], [right, midY(u[0])]] });
    }
  }
  for (const [child, parents] of parentsOf) {
    if (!parents.size || !pos.has(child)) continue;
    const c = pos.get(child)!;
    const busY = c.y - ROW_GAP / 2;
    const list = [...parents];
    const couple = list.length === 2 && partnerOf.get(list[0]) === list[1];
    const origins: [number, number][] = couple
      ? [[(pos.get(list[0])!.x + pos.get(list[1])!.x) / 2, midY(list[0])]]
      : list.filter((p) => pos.has(p)).map((p) => [pos.get(p)!.x, pos.get(p)!.y + NODE_H]);
    origins.forEach(([ox, oy], i) => {
      lines.push({
        key: `child-${child}-${i}`,
        points: [[ox, oy], [ox, busY], [c.x, busY], [c.x, c.y]],
      });
    });
  }

  const height = rows.length ? PAD * 2 + rows.length * NODE_H + (rows.length - 1) * ROW_GAP : 0;
  return {
    nodes: placed.map((id) => ({ id, ...pos.get(id)! })),
    lines,
    width,
    height,
    unplaced,
    parentsOf,
    partnerOf,
  };
}
