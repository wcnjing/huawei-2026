export interface ScenarioContent {
  id: string;
  orgName: string;
  subject: string;
  redFlags: string[];
  realConsequence: string;
  whatWentRight: string[];
  legitReason: string;
}

export const SCENARIOS: Record<string, ScenarioContent> = {
  dbs: {
    id: "dbs",
    orgName: "DBS Bank",
    subject: "Urgent: Verify Your Account Now",
    redFlags: [
      "Sender domain was dbs-verification-alert.com, not dbs.com.sg",
      "Artificial urgency — a 24-hour suspension threat",
      "Generic greeting (\"Dear Customer\") instead of your actual name",
      "Link text didn't match its real destination",
    ],
    realConsequence:
      "your DBS login credentials would have been sent straight to an attacker, who could log in to your real account before you noticed.",
    whatWentRight: [
      "You checked the sender address before trusting the message",
      "You hovered the link and saw it didn't point to dbs.com.sg",
      "You reported it instead of engaging further",
    ],
    legitReason:
      "the sender domain matched DBS exactly and the message contained no request for credentials or urgent action.",
  },
  msft: {
    id: "msft",
    orgName: "Microsoft",
    subject: "Action required: your password expires today",
    redFlags: [
      "Sender domain was micr0soft-support.net (a zero, not an \"o\")",
      "An attachment disguised with a double extension (.pdf.exe)",
      "False urgency around password expiry",
      "A reset link pointing to a non-Microsoft domain",
    ],
    realConsequence:
      "opening that attachment would have installed malware on your device, and submitting your password would have handed over your Microsoft account.",
    whatWentRight: [
      "You checked the sender address before trusting the message",
      "You hovered the link and noticed the misspelled domain",
      "You avoided opening the disguised attachment",
    ],
    legitReason:
      "the sender domain matched Microsoft exactly and there was no attachment or unusual urgency.",
  },
  shopee: {
    id: "shopee",
    orgName: "Shopee",
    subject: "Your package is out for delivery",
    redFlags: [],
    realConsequence: "",
    whatWentRight: [
      "You correctly identified a legitimate transactional email",
      "The sender domain and order details were consistent with a real Shopee notification",
    ],
    legitReason:
      "the sender domain (shopee.sg) and order reference matched a real Shopee notification, with no request for credentials or payment.",
  },
  nus: {
    id: "nus",
    orgName: "NUS Registrar",
    subject: "AY2025/26 Sem 1 Module Registration opens Monday",
    redFlags: [],
    realConsequence: "",
    whatWentRight: [
      "You correctly identified a legitimate institutional email",
      "The sender domain and content matched a real NUS registrar notice",
    ],
    legitReason:
      "the sender domain (nus.edu.sg) was correct and the email only pointed to the university's own registration portal.",
  },
};

export const DEFAULT_SCENARIO: ScenarioContent = {
  id: "generic",
  orgName: "the sender",
  subject: "this email",
  redFlags: [
    "A sender domain that didn't match the real organisation",
    "Urgency designed to rush your decision",
    "A link or attachment that didn't match what it claimed to be",
  ],
  realConsequence:
    "your credentials or device could have been compromised by an attacker.",
  whatWentRight: ["You engaged with the simulation and generated a result to learn from"],
  legitReason: "the sender domain and content matched the real organisation.",
};

export function getScenario(id: string | undefined): ScenarioContent {
  if (!id) return DEFAULT_SCENARIO;
  return SCENARIOS[id] ?? DEFAULT_SCENARIO;
}
