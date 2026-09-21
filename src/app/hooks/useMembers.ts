import { useContext, createContext, useMemo } from "react";
import type { FamilyMember } from "../types/family";

export const MembersContext = createContext<FamilyMember[]>([]);

export const useMembers = () => useContext(MembersContext);

export function useMemberMap(): Record<string, FamilyMember> {
  const members = useMembers();
  return useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
}
