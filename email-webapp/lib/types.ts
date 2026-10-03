export type LandingKind = "fake-dbs" | "fake-msft" | "legit-shopee" | "legit-nus";

export interface ScamEmail {
  id: string;
  folder: "primary";
  phishing: boolean;
  fromName: string;
  fromAddrDisplay: string;
  fromAddrReal: string;
  subject: string;
  snippet: string;
  time: string;
  bodyHtml: string;
  linkTarget: LandingKind;
  hasAttachment?: boolean;
  attachmentLabel?: string;
}

export interface FeedEntry {
  ts: string;
  text: string;
  pts: number;
}

export interface DrillState {
  score: number;
  read: Record<string, boolean>;
  inspected: Record<string, boolean>;
  hovered: Record<string, boolean>;
  reported: Record<string, boolean>;
  deleted: Record<string, boolean>;
  feed: FeedEntry[];
  clockMin: number;
}

export interface UserProfile {
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  streakDays: number;
  accuracy: number; // 0-100
  badges: string[];
  recentAssessments: {
    id: string;
    label: string;
    score: number;
    date: string;
  }[];
}
