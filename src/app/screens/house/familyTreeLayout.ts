// Builds the family diagram from each member's chosen role alone: grandparents on top,
// parents (and uncles/aunties) in the middle, children (and cousins) at the bottom.
// Couples share a marriage line; each generation hangs from the couple above it.
import type { FamilyRole, MemberView } from "../../services/house";

export const NODE_W = 92;
export const NODE_H = 92;
const H_GAP = 18;
const COUPLE_GAP = 16;
const ROW_GAP = 46;
const PAD = 12;

export type Gender = "male" | "female" | "unknown";
export type TreeNode = { id: string; x: number; y: number };
export type TreeLine = { key: string; points: [number, number][] };
export type TreeLayout = { nodes: TreeNode[]; lines: TreeLine[]; width: number; height: number; unplaced: string[] };

const MALE = new Set<FamilyRole>(["GRANDPA", "DAD", "SON", "BROTHER", "UNCLE", "HUSBAND"]);
const FEMALE = new Set<FamilyRole>(["GRANDMA", "MUM", "DAUGHTER", "SISTER", "AUNTIE", "WIFE"]);

export function genderOf(role: FamilyRole | null | undefined): Gender {
  if (!role) return "unknown";
  return MALE.has(role) ? "male" : FEMALE.has(role) ? "female" : "unknown";
}

type Unit = string[]; // one person, or a couple

/** Pair the first of `a` with the first of `b`; everyone left over stands alone. */
function pairUp(a: string[], b: string[]): { couples: Unit[]; singles: Unit[] } {
  const couples: Unit[] = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) couples.push([a[i], b[i]]);
  return { couples, singles: [...a.slice(n), ...b.slice(n)].map((id) => [id]) };
}

export function layoutFamilyTree(members: MemberView[]): TreeLayout {
  const by = (roles: FamilyRole[]) => members.filter((m) => m.family?.role && roles.includes(m.family.role)).map((m) => m.id);

  // Generation 0: grandparents.
  const gp = pairUp(by(["GRANDPA"]), by(["GRANDMA"]));
  const gen0: Unit[] = [...gp.couples, ...gp.singles];

  // Generation 1: the parents' couple first, then guardians, then uncles and aunties.
  const parents = pairUp(by(["DAD", "HUSBAND"]), by(["MUM", "WIFE"]));
  const mainUnits: Unit[] = [...parents.couples, ...parents.singles];
  const partners = by(["PARTNER"]);
  for (const p of partners) {
    const lone = mainUnits.find((u) => u.length === 1);
    if (lone) lone.push(p); else mainUnits.push([p]);
  }
  const guardians = by(["GUARDIAN"]).map((id) => [id]);
  const relatives = by(["UNCLE", "AUNTIE"]).map((id) => [id]);
  const extended = by(["OTHER"]).map((id) => [id]);
  const gen1: Unit[] = [...mainUnits, ...guardians, ...relatives, ...extended];

  // Generation 2: children and siblings, then cousins.
  const kids = by(["SON", "DAUGHTER", "BROTHER", "SISTER"]).map((id) => [id]);
  const cousins = by(["COUSIN"]).map((id) => [id]);
  const gen2: Unit[] = [...kids, ...cousins];

  const rows = [gen0, gen1, gen2].filter((r) => r.length);
  const placed = new Set(rows.flat(2));
  const unplaced = members.map((m) => m.id).filter((id) => !placed.has(id));

  // Position: every row centred on the widest.
  const unitW = (u: Unit) => u.length * NODE_W + (u.length - 1) * COUPLE_GAP;
  const rowW = (r: Unit[]) => r.reduce((w, u) => w + unitW(u), 0) + H_GAP * (r.length - 1);
  let width = Math.max(NODE_W, ...rows.map(rowW)) + PAD * 2;
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((row, g) => {
    let x = (width - rowW(row)) / 2;
    const y = PAD + g * (NODE_H + ROW_GAP);
    for (const unit of row) {
      unit.forEach((id, k) => pos.set(id, { x: x + NODE_W / 2 + k * (NODE_W + COUPLE_GAP), y }));
      x += unitW(unit) + H_GAP;
    }
  });
  // Slide the children's row so it sits centred under the parents it hangs from.
  const kidsParent = mainUnits[0] ?? guardians[0];
  if (kids.length && kidsParent && gen2.length) {
    const parentX = kidsParent.reduce((sum, id) => sum + pos.get(id)!.x, 0) / kidsParent.length;
    const kidsW = rowW(kids);
    const firstLeft = pos.get(gen2[0][0])!.x - NODE_W / 2;
    const shift = Math.max(PAD, parentX - kidsW / 2) - firstLeft;
    for (const u of gen2) for (const id of u) pos.get(id)!.x += shift;
    width = Math.max(width, ...[...pos.values()].map((p) => p.x + NODE_W / 2 + PAD));
  }
  const height = rows.length ? PAD * 2 + rows.length * NODE_H + (rows.length - 1) * ROW_GAP : 0;

  const lines: TreeLine[] = [];
  const at = (id: string) => pos.get(id)!;
  const centreX = (u: Unit) => u.reduce((s, id) => s + at(id).x, 0) / u.length;
  // Where lines to a unit's children start: the marriage line's middle, or under a single.
  const origin = (u: Unit): [number, number] =>
    u.length === 2 ? [centreX(u), at(u[0]).y + NODE_H / 2] : [at(u[0]).x, at(u[0]).y + NODE_H];
  // Where a line into a unit ends: a couple is joined at its marriage line.
  const target = (u: Unit): [number, number] =>
    u.length === 2 ? [centreX(u), at(u[0]).y + NODE_H / 2] : [at(u[0]).x, at(u[0]).y];
  const connect = (from: Unit | undefined, to: Unit[], tag: string) => {
    if (!from) return;
    const [ox, oy] = origin(from);
    for (const u of to) {
      const [tx, ty] = target(u);
      const busY = at(u[0]).y - ROW_GAP / 2;
      lines.push({ key: `${tag}-${u.join("-")}`, points: [[ox, oy], [ox, busY], [tx, busY], [tx, ty]] });
    }
  };

  for (const u of [...gen0, ...gen1]) {
    if (u.length !== 2) continue;
    const y = at(u[0]).y + NODE_H / 2;
    lines.push({ key: `couple-${u.join("-")}`, points: [[at(u[0]).x + NODE_W / 2, y], [at(u[1]).x - NODE_W / 2, y]] });
  }
  connect(gen0[0], [...mainUnits, ...relatives], "gp");
  connect(mainUnits[0] ?? guardians[0], kids, "kid");
  connect(relatives[0], cousins, "cousin");

  return { nodes: [...placed].map((id) => ({ id, ...at(id) })), lines, width, height, unplaced };
}
