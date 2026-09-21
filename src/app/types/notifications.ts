export type NotificationKind =
    | "drill-win-call" | "drill-win-sms" | "drill-win-email"
    | "drill-lose-call" | "drill-lose-sms" | "drill-lose-email"
    | "family-drill-complete"
    | "payday"
    | "daily-reward"
    | "house";

export interface Notification {
    id: string;
    kind: NotificationKind;
    memberId: string; // "family" for household-wide events
    title: string;
    body: string;
    timestamp: number;
    read: boolean;
}
