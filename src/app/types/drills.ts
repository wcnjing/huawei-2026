import type { Screen } from "./navigation";

export interface DrillFlag { 
    id: string; 
    name: string; 
    explanation: string 
}

export interface Highlight { 
    phrase: string; 
    flagId: string 
}

export interface ConversationLine { 
    who: string; 
    text: string; 
    highlights?: Highlight[] 
}

export type DrillType = "call" | "sms" | "email";

export type SmsOutcome = 
    | "reported" 
    | "asked-family" 
    | "clicked-link" 
    | "closed-page";

export type EmailOutcome = 
    | "reported" 
    | "asked-family" 
    | "submitted-details" 
    | "opened-attachment" 
    | "cancelled-download";

export type CallOutcome =
    | "hung_up"
    | "disengaged"
    | "caught_flag"
    | "complied"
    | "shared_data"
    | "distress_offramp"
    | "no_answer"
    | "voicemail"
    | "unscored";

export interface RealDrillCompletion { 
    ok: boolean; 
    error?: string 
}

export interface DrillResultRecord {
    id?: string;
    drillId?: string;
    attemptId?: string;
    outcome?: string | null;
    result?: string;
    screen?: Screen | null;
    xpGained?: number;
    channel?: DrillType;
    unscoredReason?: string;
}

export interface NeutralResultNotice { 
    id: string; 
    message: string 
}

export interface FamilyClue {
    label: string;
    text: string;
    explanation: string;
}

export interface FamilyScenario {
    id: number;
    targetMember: string;
    type: "sms" | "email" | "notification";
    isScam: boolean;
    sender: string;
    senderEmail?: string;
    senderDomain?: string;
    senderWarning?: string;
    subject?: string;
    timestamp: string;
    message: string;
    invoiceDetails?: { 
        amount: string; 
        noteFromSeller: string; 
        invoiceNumber: string 
    };
    buttonLabel?: string;
    buttonUrl?: string;
    correctAction: string;
    actions: string[];
    clues: FamilyClue[];
    explanation: string;
}

export type FamilyOutcome = 
    | "correct" 
    | "cautious" 
    | "wrong";
