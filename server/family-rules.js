// The house family tree: one shared record per house that ANY member may edit.
//
//   tree = {
//     genders:  { [memberId]: 'male' | 'female' | 'other' },
//     parents:  [[parentId, childId], ...],
//     partners: [[a, b], ...],   // pair stored with a < b
//     friends:  [[a, b], ...],   // pair stored with a < b
//   }
//
// Edits are small operations (set a gender, add or remove one relationship) applied to
// the latest stored tree, so two people editing at once both land instead of the later
// save wiping out the earlier one.
//
// This file is plain JS with no imports so the server AND the app (through
// family-rules.d.ts) use exactly the same rules: the app greys out choices the server
// would refuse, and the server is still the one that decides.
//
// What "makes sense":
//   - every person sits on one generation level: a child is exactly one level below
//     each parent, partners and friends are on the SAME level (so friends are always
//     drawn side by side, and nobody can be their own ancestor);
//   - at most two parents, one partner, a handful of friends;
//   - two people have at most one kind of relationship with each other;
//   - brothers and sisters (sharing a parent) are already family, so they can't also
//     be partners or friends.
// Anything else is allowed, so one person can be someone's child, someone else's
// parent, another person's partner and a few people's friend all at once.

export const FAMILY_GENDERS = ['male', 'female', 'other'];
export const FAMILY_RELATIONS = ['parent', 'partner', 'friend'];
export const FAMILY_LIMITS = { parents: 2, children: 8, partners: 1, friends: 5, editsPerRequest: 4 };
const MAX_ID_LENGTH = 64;

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
const pairKey = (a, b) => pair(a, b).join('|');

export function emptyFamilyTree() {
  return { genders: {}, parents: [], partners: [], friends: [] };
}

/**
 * Exactly-shaped copy limited to `memberIds` (a Set): unknown people, self-links,
 * duplicates and bad genders are dropped. Doesn't check the rules (see familyProblem).
 */
export function cleanFamilyTree(raw, memberIds) {
  const tree = emptyFamilyTree();
  if (!isPlainObject(raw)) return tree;
  const member = (id) => isId(id) && memberIds.has(id);
  if (isPlainObject(raw.genders)) {
    for (const [id, gender] of Object.entries(raw.genders)) {
      if (member(id) && FAMILY_GENDERS.includes(gender)) tree.genders[id] = gender;
    }
  }
  const seen = new Set();
  const edges = (list, ordered) => {
    const out = [];
    for (const edge of Array.isArray(list) ? list : []) {
      if (!Array.isArray(edge) || edge.length !== 2) continue;
      const [a, b] = edge;
      if (!member(a) || !member(b) || a === b) continue;
      const key = ordered ? `${a}>${b}` : pairKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ordered ? [a, b] : pair(a, b));
    }
    return out;
  };
  tree.parents = edges(raw.parents, true);
  tree.partners = edges(raw.partners, false);
  tree.friends = edges(raw.friends, false);
  return tree;
}

/**
 * Generation level of every person (0 = top of their branch). Returns null when the
 * relationships can't all hold at once, e.g. someone would be their own grandparent,
 * or two friends would have to sit on different levels.
 */
export function familyLevels(tree, ids) {
  const adjacency = new Map(ids.map((id) => [id, []]));
  const link = (a, b, delta) => {
    if (!adjacency.has(a) || !adjacency.has(b)) return;
    adjacency.get(a).push([b, delta]);
    adjacency.get(b).push([a, -delta]);
  };
  for (const [p, c] of tree.parents) link(p, c, 1);
  for (const [a, b] of tree.partners) link(a, b, 0);
  for (const [a, b] of tree.friends) link(a, b, 0);
  const level = new Map();
  for (const start of ids) {
    if (level.has(start)) continue;
    const component = [start];
    level.set(start, 0);
    for (let i = 0; i < component.length; i += 1) {
      const id = component[i];
      for (const [next, delta] of adjacency.get(id)) {
        const want = level.get(id) + delta;
        if (!level.has(next)) { level.set(next, want); component.push(next); }
        else if (level.get(next) !== want) return null;
      }
    }
    const top = Math.min(...component.map((id) => level.get(id)));
    for (const id of component) level.set(id, level.get(id) - top);
  }
  return level;
}

/** Null when the tree makes sense, otherwise an error code explaining why not. */
export function familyProblem(tree, ids) {
  const count = (list, pick) => {
    const counts = new Map();
    for (const edge of list) for (const id of pick(edge)) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  };
  const over = (counts, max) => [...counts.values()].some((n) => n > max);
  if (over(count(tree.parents, ([, c]) => [c]), FAMILY_LIMITS.parents)) return 'FAMILY_TOO_MANY_PARENTS';
  if (over(count(tree.parents, ([p]) => [p]), FAMILY_LIMITS.children)) return 'FAMILY_TOO_MANY_CHILDREN';
  if (over(count(tree.partners, (e) => e), FAMILY_LIMITS.partners)) return 'FAMILY_PARTNER_TAKEN';
  if (over(count(tree.friends, (e) => e), FAMILY_LIMITS.friends)) return 'FAMILY_TOO_MANY_FRIENDS';

  // One kind of relationship per pair of people.
  const kinds = new Map();
  for (const [a, b] of [...tree.parents, ...tree.partners, ...tree.friends]) {
    const key = pairKey(a, b);
    if (kinds.has(key)) return 'FAMILY_ALREADY_LINKED';
    kinds.set(key, true);
  }

  // Brothers and sisters are already family.
  const parentsOf = new Map();
  for (const [p, c] of tree.parents) parentsOf.set(c, [...(parentsOf.get(c) ?? []), p]);
  const siblings = (a, b) => (parentsOf.get(a) ?? []).some((p) => (parentsOf.get(b) ?? []).includes(p));
  for (const [a, b] of [...tree.partners, ...tree.friends]) if (siblings(a, b)) return 'FAMILY_SIBLINGS';

  if (!familyLevels(tree, ids)) return 'FAMILY_LEVEL_CONFLICT';
  return null;
}

/** Exactly-shaped edit, or null. Membership is checked by the caller. */
export function cleanFamilyEdit(input) {
  if (!isPlainObject(input)) return null;
  if (input.kind === 'gender') {
    const gender = input.gender ?? null;
    if (!isId(input.id) || (gender !== null && !FAMILY_GENDERS.includes(gender))) return null;
    return { kind: 'gender', id: input.id, gender };
  }
  if (input.kind === 'add' || input.kind === 'remove') {
    if (!FAMILY_RELATIONS.includes(input.relation) || !isId(input.a) || !isId(input.b) || input.a === input.b) return null;
    return { kind: input.kind, relation: input.relation, a: input.a, b: input.b };
  }
  return null;
}

/** Ids an edit refers to. */
export const familyEditIds = (edit) => (edit.kind === 'gender' ? [edit.id] : [edit.a, edit.b]);

/**
 * The tree after one edit (a new object). For a parent link, `a` is the parent and `b`
 * the child. Adding what's already there, or removing what isn't, changes nothing.
 */
export function applyFamilyEdit(tree, edit) {
  const next = {
    genders: { ...tree.genders },
    parents: tree.parents.map((e) => [...e]),
    partners: tree.partners.map((e) => [...e]),
    friends: tree.friends.map((e) => [...e]),
  };
  if (edit.kind === 'gender') {
    if (edit.gender) next.genders[edit.id] = edit.gender;
    else delete next.genders[edit.id];
    return next;
  }
  const listName = edit.relation === 'parent' ? 'parents' : edit.relation === 'partner' ? 'partners' : 'friends';
  const edge = edit.relation === 'parent' ? [edit.a, edit.b] : pair(edit.a, edit.b);
  const same = (e) => e[0] === edge[0] && e[1] === edge[1];
  const list = next[listName].filter((e) => !same(e));
  if (edit.kind === 'add') list.push(edge);
  next[listName] = list;
  return next;
}

/** One person's view of the tree, in the shape the app has always used. */
export function familyLinkFor(tree, id) {
  const partner = tree.partners.find((e) => e.includes(id));
  return {
    gender: tree.genders[id] ?? null,
    parentIds: tree.parents.filter(([, c]) => c === id).map(([p]) => p),
    partnerId: partner ? (partner[0] === id ? partner[1] : partner[0]) : null,
    childIds: tree.parents.filter(([p]) => p === id).map(([, c]) => c),
    friendIds: tree.friends.filter((e) => e.includes(id)).map((e) => (e[0] === id ? e[1] : e[0])),
  };
}

/** Every relationship a link describes, as add-edits for `id`. */
function editsForLink(id, link) {
  const edits = [];
  for (const p of link?.parentIds ?? []) edits.push({ kind: 'add', relation: 'parent', a: p, b: id });
  if (link?.partnerId) edits.push({ kind: 'add', relation: 'partner', a: id, b: link.partnerId });
  for (const c of link?.childIds ?? []) edits.push({ kind: 'add', relation: 'parent', a: id, b: c });
  for (const f of link?.friendIds ?? []) edits.push({ kind: 'add', relation: 'friend', a: id, b: f });
  return edits.filter((e) => isId(e.a) && isId(e.b) && e.a !== e.b);
}

/** Add each edit that keeps the tree sensible; quietly skip the ones that wouldn't. */
function addWhereSensible(tree, edits, ids) {
  let current = tree;
  for (const edit of edits) {
    const next = applyFamilyEdit(current, edit);
    if (!familyProblem(next, ids)) current = next;
  }
  return current;
}

/**
 * The shared tree built from the old per-member records (each member placed only
 * themself). Used once per house, the first time the shared tree is read.
 * `rows` is [{ id, link }].
 */
export function familyTreeFromLinks(rows) {
  const ids = rows.map((row) => row.id);
  const memberIds = new Set(ids);
  let tree = emptyFamilyTree();
  for (const { id, link } of rows) {
    if (isPlainObject(link) && FAMILY_GENDERS.includes(link.gender)) tree.genders[id] = link.gender;
  }
  const edits = rows.flatMap(({ id, link }) => editsForLink(id, isPlainObject(link) ? link : null))
    .filter((e) => memberIds.has(e.a) && memberIds.has(e.b));
  tree = addWhereSensible(tree, edits, ids);
  return cleanFamilyTree(tree, memberIds);
}

/**
 * Replace everything about `id` with what `link` says (the older app's "save my
 * branch"). Returns the new tree; the caller still checks familyProblem().
 */
export function replaceFamilyLink(tree, id, link) {
  let next = {
    genders: { ...tree.genders },
    parents: tree.parents.filter((e) => !e.includes(id)),
    partners: tree.partners.filter((e) => !e.includes(id)),
    friends: tree.friends.filter((e) => !e.includes(id)),
  };
  if (link.gender) next.genders[id] = link.gender;
  else delete next.genders[id];
  for (const edit of editsForLink(id, link)) next = applyFamilyEdit(next, edit);
  return next;
}
