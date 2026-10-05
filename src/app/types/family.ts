import { AvatarConfig } from "./profile";
import type { RoomStyle } from "./roomStyle";
import type { RoomLayout } from "./roomLayout";

export interface FamilyMember {
    id: string; 
    name: string; 
    role: string;
    level: number; 
    xp: number; 
    xpMax: number;
    streak: number; 
    timesSafe: number; 
    timesScammed: number;
    safeThisWeek: boolean; 
    recentDrillResult: "WON" | "LOST" | null;
    primaryColor: string; 
    roomName: string; 
    roomBg: string;
    roomStyle: RoomStyle;
    /** Furniture this member owns and where it stands, as their housemates see it. */
    roomItems: string[];
    roomLayout?: RoomLayout;
    badgeCount: number; 
    badgeTotal: number;
    avatar: AvatarConfig;
}
