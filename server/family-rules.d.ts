// Types for family-rules.js, which the app imports too (see the header there).
export type FamilyGenderId = "male" | "female" | "other";
export type FamilyRelation = "parent" | "partner" | "friend";
export type FamilyTree = {
  genders: Record<string, FamilyGenderId>;
  parents: [string, string][];
  partners: [string, string][];
  friends: [string, string][];
};
export type FamilyEdit =
  | { kind: "gender"; id: string; gender: FamilyGenderId | null }
  | { kind: "add" | "remove"; relation: FamilyRelation; a: string; b: string };
export type FamilyProblem =
  | "FAMILY_TOO_MANY_PARENTS" | "FAMILY_TOO_MANY_CHILDREN" | "FAMILY_PARTNER_TAKEN"
  | "FAMILY_TOO_MANY_FRIENDS" | "FAMILY_ALREADY_LINKED" | "FAMILY_SIBLINGS" | "FAMILY_LEVEL_CONFLICT";
export type FamilyLinkShape = {
  gender: FamilyGenderId | null; parentIds: string[]; partnerId: string | null; childIds: string[]; friendIds: string[];
};

export const FAMILY_GENDERS: FamilyGenderId[];
export const FAMILY_RELATIONS: FamilyRelation[];
export const FAMILY_LIMITS: { parents: number; children: number; partners: number; friends: number; editsPerRequest: number };
export function emptyFamilyTree(): FamilyTree;
export function cleanFamilyTree(raw: unknown, memberIds: Set<string>): FamilyTree;
export function familyLevels(tree: FamilyTree, ids: string[]): Map<string, number> | null;
export function familyProblem(tree: FamilyTree, ids: string[]): FamilyProblem | null;
export function cleanFamilyEdit(input: unknown): FamilyEdit | null;
export function familyEditIds(edit: FamilyEdit): string[];
export function applyFamilyEdit(tree: FamilyTree, edit: FamilyEdit): FamilyTree;
export function familyLinkFor(tree: FamilyTree, id: string): FamilyLinkShape;
export function familyTreeFromLinks(rows: { id: string; link: unknown }[]): FamilyTree;
export function replaceFamilyLink(tree: FamilyTree, id: string, link: FamilyLinkShape): FamilyTree;
