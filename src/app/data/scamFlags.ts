import type { DrillFlag } from "../types/drills";

export const RED_FLAGS: DrillFlag[] = [
  { id: "impersonation", name: "IMPERSONATION", explanation: "The real IRS contacts you by postal mail first — never by surprise phone call claiming urgent fraud." },
  { id: "arrest_threat", name: "ARREST THREAT", explanation: "No government agency threatens arrest over the phone. Fake legal threats bypass rational thinking." },
  { id: "gift_card", name: "GIFT CARD DEMAND", explanation: "No legitimate agency accepts gift cards as payment. Gift cards are untraceable — perfect for scammers." },
  { id: "urgency", name: "FAKE URGENCY", explanation: "Pressure to act RIGHT NOW stops you verifying anything. Scammers need you panicked, not thinking." },
  { id: "escalation", name: "FAKE ESCALATION", explanation: "Threatening to send police is a scare tactic. Real law enforcement does not coordinate with phone callers." },
];

export const LIVE_CALL_FLAGS: DrillFlag[] = [
  { id: "official_impersonation", name: "OFFICIAL IMPERSONATION", explanation: "A caller claiming to be an officer is not proof of identity. End the call and contact the organisation through an independently verified number." },
  { id: "otp_request", name: "OTP / SECRET REQUEST", explanation: "Legitimate staff should never ask you to read out an OTP, PIN, password or complete card number." },
  { id: "transfer_pressure", name: "TRANSFER PRESSURE", explanation: "Urgent instructions to move money to a 'safe account' are a common scam pattern. Banks do not protect funds this way." },
  { id: "urgency", name: "FAKE URGENCY", explanation: "Pressure to act immediately is designed to stop you checking the story with a trusted person or official channel." },
];

export const SMS_FLAGS: DrillFlag[] = [
  { id: "sms_sender", name: "UNKNOWN SENDER", explanation: "Legitimate delivery companies use official sender IDs, not random numbers or unrecognised names." },
  { id: "sms_urgency", name: "FAKE URGENCY", explanation: "Deadlines pressure you to act without thinking. Real parcels give you more than a few hours." },
  { id: "sms_link", name: "SUSPICIOUS LINK", explanation: "Real organisations rarely ask you to update payment details through random shortened links." },
  { id: "sms_payment", name: "SMALL PAYMENT TRICK", explanation: "Scammers use tiny fees like $1.99 to make the request feel harmless — but they want your card details." },
  { id: "sms_card", name: "CARD DETAILS REQUEST", explanation: "Never enter card details on a page reached through an SMS link. Use the official website directly." },
];

export const EMAIL_FLAGS: DrillFlag[] = [
  { id: "email_domain", name: "SUSPICIOUS DOMAIN", explanation: "The sender domain 'campus-secure.example' is not an official institution address. Always verify the full email." },
  { id: "email_reward", name: "TOO GOOD TO BE TRUE", explanation: "Unexpected cash rewards are a classic lure. Legitimate programmes do not contact you out of the blue." },
  { id: "email_urgency", name: "FAKE URGENCY", explanation: "Scammers create time pressure — '30 minutes only' — so you act before checking if it is real." },
  { id: "email_verify", name: "CREDENTIAL THEFT", explanation: "'Verify your account' often leads to fake login pages designed to steal your password and ID." },
  { id: "email_attachment", name: "DANGEROUS ATTACHMENT", explanation: "ZIP files can hide malware, ransomware, or fake forms. Never open unexpected attachments." },
  { id: "email_threat", name: "THREAT LANGUAGE", explanation: "Warnings like 'reward will be reassigned' are designed to scare you into acting without thinking." },
];

export const FLAG_MAP: Record<string, DrillFlag> = Object.fromEntries(
  [...RED_FLAGS, ...SMS_FLAGS, ...EMAIL_FLAGS].map((f) => [f.id, f])
);