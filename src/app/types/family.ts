import { AvatarConfig } from "./profile";
import type { RoomStyle } from "./roomStyle";

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
    badgeCount: number; 
    badgeTotal: number;
    avatar: AvatarConfig;
}
