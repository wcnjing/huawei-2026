export interface ChatMsg {
    memberId: string;
    text: string;
    time: string;
    isPlayer?: boolean;
    isPixi?: boolean;
    incidentRef?: {
        memberId: string;
        kind: 
            | "drill-win" 
            | "drill-lose" 
            | "family-round" 
            | "payday";
    };
}
