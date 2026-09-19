export interface AppSettings {
    drillFrequency: string;
    familyDrillEnabled: boolean;
    notificationsEnabled: boolean;
    difficulty: string;
    includeSafeMessages: boolean;
    autoExplain: boolean;
    requireLinkInspection: boolean;
    realismMode: boolean;
    // Drill schedule window — when real (surprise) drills are allowed to fire.
    // drillDays is indexed by JS getDay(): 0 = Sunday … 6 = Saturday.
    drillDays: boolean[];
    drillStartHour: number; // 0–23, inclusive
    drillEndHour: number;   // 0–23, exclusive
}

export interface AccessibilityPrefs {
    reduceMotion: boolean;
    largerText: boolean;
    highContrast: boolean;
    disableScanlines: boolean;
}