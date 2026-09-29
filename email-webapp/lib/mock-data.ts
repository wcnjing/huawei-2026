import { ScamEmail, UserProfile } from "./types";

// ---------------------------------------------------------------------------
// In production, this would come from the AI Email Generator (OpenAI) and be
// stored in Supabase (`scenarios` / `activities` tables). See lib/ai-coach.ts
// for where the real OpenAI call would slot in.
// ---------------------------------------------------------------------------

export const EMAILS: ScamEmail[] = [
  {
    id: "dbs",
    folder: "primary",
    phishing: true,
    fromName: "DBS Security",
    fromAddrDisplay: "security@dbs.com.sg",
    fromAddrReal: "alert@dbs-verification-alert.com",
    subject: "Urgent: Verify Your Account Now",
    snippet:
      "We noticed unusual activity on your account. Verify within 24 hours to avoid suspension.",
    time: "09:22",
    bodyHtml: `
      <p>Dear Customer,</p>
      <p>We have detected <b>unusual sign-in activity</b> on your DBS account. For your protection, your account access will be <b>suspended within 24 hours</b> unless you verify your identity.</p>
      <p>Please confirm your details immediately to avoid any disruption to your banking services.</p>
    `,
    linkTarget: "fake-dbs",
  },
  {
    id: "shopee",
    folder: "primary",
    phishing: false,
    fromName: "Shopee",
    fromAddrDisplay: "order-update@shopee.sg",
    fromAddrReal: "order-update@shopee.sg",
    subject: "Your package is out for delivery",
    snippet:
      "Order #SPX88213904SG is on its way and should arrive today between 2–6pm.",
    time: "09:31",
    bodyHtml: `
      <p>Hi there,</p>
      <p>Good news — your order <b>#SPX88213904SG</b> is out for delivery and should arrive <b>today between 2–6pm</b>.</p>
      <p>You can track its progress in real time below.</p>
    `,
    linkTarget: "legit-shopee",
  },
  {
    id: "msft",
    folder: "primary",
    phishing: true,
    fromName: "Microsoft Account Team",
    fromAddrDisplay: "account-security@microsoft.com",
    fromAddrReal: "account-security@micr0soft-support.net",
    subject: "Action required: your password expires today",
    snippet:
      "Your Microsoft account password will expire today. Reset now to keep access.",
    time: "09:40",
    bodyHtml: `
      <p>Dear User,</p>
      <p>Our records show that your <b>Microsoft account password expires today</b>. To avoid losing access to Outlook, Teams and OneDrive, please reset it now using the attached instructions.</p>
    `,
    linkTarget: "fake-msft",
    hasAttachment: true,
    attachmentLabel: "Password_Reset_Instructions.pdf.exe — 214 KB",
  },
  {
    id: "nus",
    folder: "primary",
    phishing: false,
    fromName: "NUS Registrar",
    fromAddrDisplay: "registrar@nus.edu.sg",
    fromAddrReal: "registrar@nus.edu.sg",
    subject: "AY2025/26 Sem 1 Module Registration opens Monday",
    snippet:
      "Module registration for Semester 1 opens on Monday, 9am. Plan your timetable ahead of time.",
    time: "09:55",
    bodyHtml: `
      <p>Dear Student,</p>
      <p>Module registration for <b>AY2025/26 Semester 1</b> opens <b>Monday at 9:00am</b>. We recommend reviewing your study plan and preparing a shortlist of modules in advance.</p>
    `,
    linkTarget: "legit-nus",
  },
];

export const MOCK_PROFILE: UserProfile = {
  name: "Alex Tan",
  level: 4,
  xp: 640,
  xpToNextLevel: 1000,
  streakDays: 6,
  accuracy: 78,
  badges: ["Sender Sleuth", "Link Inspector", "5-Day Streak"],
  recentAssessments: [
    { id: "a1", label: "Email Drill · Simulation #23", score: 74, date: "Yesterday" },
    { id: "a2", label: "Live Assessment · DBS scenario", score: 91, date: "3 days ago" },
    { id: "a3", label: "Email Drill · Simulation #21", score: 58, date: "5 days ago" },
  ],
};
