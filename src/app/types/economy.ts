export type CoinTxReason =
    | "drill-win-call" | "drill-win-sms" | "drill-win-email"
    | "drill-lose-call" | "drill-lose-sms" | "drill-lose-email"
    | "family-drill-correct" | "family-drill-wrong"
    | "sell-furniture" | "buy-furniture"
    | "daily-reward"
    | "payday-base" 
    | "payday-bonus";

export interface CoinTx {
    id: string;
    memberId: string;
    delta: number;
    reason: CoinTxReason;
    label: string;
    timestamp: number;
};

export interface HomeInventory {
    coins: Record<string, number>;
    soldItems: string[];
    purchasedItems: Record<string, string[]>;
    roomLayouts: import("./roomLayout").RoomLayouts;
};

export interface RewardClaims {
    dailyByMember: Record<string, string>;
    paydayWeek: string | null;
};
