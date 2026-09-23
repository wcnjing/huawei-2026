// Family tree placement. Each member owns one record on their row:
//   { role, gender, parentIds, partnerId, childIds }
// The app labels people (Mum, Grandpa, Son…) from where they sit on the tree and their
// gender; `role` is an older optional label kept for compatibility.
// Ids must be other members of the same house. The tree everyone sees is the union of
// every member's record, so the rules below (at most two parents, no one their own
// ancestor, a partner is not a parent or child) are checked against that union.

export const FAMILY_ROLES = [
  'GRANDPA', 'GRANDMA', 'DAD', 'MUM', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER',
  'UNCLE', 'AUNTIE', 'COUSIN', 'HUSBAND', 'WIFE', 'PARTNER', 'GUARDIAN', 'OTHER',
];
const ROLE_SET = new Set(FAMILY_ROLES);
const GENDERS = new Set(['male', 'female']);
const MAX_ID_LENGTH = 64;
const MAX_PARENTS = 2;
const MAX_CHILDREN = 5;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function cleanIds(list, max) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > max || !list.every(isId)) return null;
  const unique = [...new Set(list)];
  return unique.length === list.length ? unique : null;
}

/** Exact-shape copy of a placement request, or null. Does not check membership. */
export function cleanFamilyLinkInput(input) {
  if (!isPlainObject(input)) return null;
  const allowed = new Set(['role', 'gender', 'parentIds', 'partnerId', 'childIds']);
  if (Object.keys(input).some((key) => !allowed.has(key))) return null;
  const role = input.role ?? null;
  if (role !== null && !ROLE_SET.has(role)) return null;
  const gender = input.gender ?? null;
  if (gender !== null && !GENDERS.has(gender)) return null;
  const parentIds = cleanIds(input.parentIds, MAX_PARENTS);
  const childIds = cleanIds(input.childIds, MAX_CHILDREN);
  const partnerId = input.partnerId ?? null;
  if (!parentIds || !childIds || (partnerId !== null && !isId(partnerId))) return null;
  return { role, gender, parentIds, partnerId, childIds };
}

/** A stored record limited to ids in `memberIds` (a Set), with self-references dropped. */
export function projectFamilyLink(link, selfId, memberIds) {
  if (!isPlainObject(link)) return null;
  const keep = (id) => isId(id) && id !== selfId && memberIds.has(id);
  return {
    role: ROLE_SET.has(link.role) ? link.role : null,
    gender: GENDERS.has(link.gender) ? link.gender : null,
    parentIds: Array.isArray(link.parentIds) ? link.parentIds.filter(keep).slice(0, MAX_PARENTS) : [],
    partnerId: keep(link.partnerId) ? link.partnerId : null,
    childIds: Array.isArray(link.childIds) ? link.childIds.filter(keep).slice(0, MAX_CHILDREN) : [],
  };
}

/**
 * Check a proposed placement for `selfId` against everyone else's current records.
 * `links` maps member id → projected record (already including the proposal).
 * Returns null when valid, or an error code.
 */
export function familyConflict(selfId, links) {
  const own = links.get(selfId);
  const ids = [own.partnerId, ...own.parentIds, ...own.childIds].filter(Boolean);
  if (ids.length !== new Set(ids).size) return 'FAMILY_LINK_CONFLICT';

  // Merged parent → child edges.
  const parentsOf = new Map([...links.keys()].map((id) => [id, new Set()]));
  for (const [id, link] of links) {
    if (!link) continue;
    for (const p of link.parentIds) parentsOf.get(id)?.add(p);
    for (const c of link.childIds) parentsOf.get(c)?.add(id);
  }
  for (const parents of parentsOf.values()) if (parents.size > MAX_PARENTS) return 'FAMILY_TOO_MANY_PARENTS';

  // No cycles: nobody may be their own ancestor.
  const state = new Map();
  const visit = (id) => {
    if (state.get(id) === 'done') return false;
    if (state.get(id) === 'active') return true;
    state.set(id, 'active');
    for (const p of parentsOf.get(id) ?? []) if (visit(p)) return true;
    state.set(id, 'done');
    return false;
  };
  for (const id of parentsOf.keys()) if (visit(id)) return 'FAMILY_LINK_CYCLE';

  // A partner can't also be an ancestor or descendant.
  if (own.partnerId) {
    const ancestors = (start) => {
      const seen = new Set();
      const stack = [...(parentsOf.get(start) ?? [])];
      while (stack.length) {
        const next = stack.pop();
        if (seen.has(next)) continue;
        seen.add(next);
        stack.push(...(parentsOf.get(next) ?? []));
      }
      return seen;
    };
    if (ancestors(selfId).has(own.partnerId) || ancestors(own.partnerId).has(selfId)) {
      return 'FAMILY_LINK_CONFLICT';
    }
  }
  return null;
}
