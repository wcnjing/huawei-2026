import type { DrillFlag } from "../types/drills";

// These clues describe the allow-listed messages that the email relay sends. The
// result screen only uses the clue set for the scenario id returned by that relay.
const SCENARIO_FLAGS: Record<string, DrillFlag[]> = {
  bank: [
    { id: "bank-transfer", name: "UNEXPECTED TRANSFER ALERT", explanation: "The email says a transfer to a new payee is awaiting review. Check bank activity in the official app or by calling the number on your card." },
    { id: "bank-pressure", name: "ACT NOW / ACCOUNT RESTRICTION", explanation: "It pressures you to review immediately to avoid account restrictions. Urgent account warnings should be checked through the bank's official app or website." },
  ],
  parcel: [
    { id: "parcel-fee", name: "UNEXPECTED DELIVERY FEE", explanation: "The email claims a small customs fee is holding a parcel. Check tracking through the delivery company's official website instead of following its payment link." },
    { id: "parcel-deadline", name: "PAY TODAY OR LOSE THE PARCEL", explanation: "A same-day deadline and threat to return the parcel pressure you to pay before checking whether the message is genuine." },
  ],
  password: [
    { id: "password-reset", name: "UNREQUESTED PASSWORD RESET", explanation: "The email claims a reset was requested. If you did not request it, open the service directly and check your account there." },
    { id: "password-link", name: "SECURE ACCOUNT LINK", explanation: "The message pushes you to use its link to secure your account. Do not enter credentials from an email link; visit the service yourself." },
  ],
  govt: [
    { id: "govt-notice", name: "UNEXPECTED INFRINGEMENT NOTICE", explanation: "The email claims there is an unpaid notice under your details. Check official government channels independently before responding." },
    { id: "govt-deadline", name: "24-HOUR THREAT", explanation: "A short deadline and threat of escalation are designed to rush you into acting without verifying the notice." },
  ],
  scholarship: [
    { id: "scholarship-award", name: "UNEXPECTED SCHOLARSHIP SELECTION", explanation: "The email says you were selected for an award you did not apply for. Verify it through the school's official website or contact." },
    { id: "scholarship-details", name: "DETAILS BEFORE A DEADLINE", explanation: "It asks you to confirm details before an acceptance window closes. Do not share personal information until the award is verified." },
  ],
  job: [
    { id: "job-offer", name: "UNEXPECTED REMOTE JOB OFFER", explanation: "The email says your profile was selected for a role. Check the company and vacancy through its official careers page." },
    { id: "job-onboarding", name: "RUSHED ONBOARDING / EQUIPMENT LURE", explanation: "It asks you to complete onboarding today to reserve the job and receive equipment. Verify the offer before sharing details or paying fees." },
  ],
  refund: [
    { id: "refund-issue", name: "UNEXPECTED REFUND PROBLEM", explanation: "The email claims a refund could not be processed. Check your order directly in the retailer's official app or website." },
    { id: "refund-destination", name: "NEW PAYMENT DESTINATION", explanation: "It asks you to confirm where money should be sent before the refund expires. Do not provide bank or card details through an email link." },
  ],
  account: [
    { id: "account-suspension", name: "ACCOUNT SUSPENSION WARNING", explanation: "The email claims a security check failed and threatens to remove messages and files. Check account status by visiting the service directly." },
    { id: "account-reverify", name: "URGENT RE-VERIFICATION", explanation: "It asks you to re-verify today. Do not enter credentials through the email; open the service's official app or website yourself." },
  ],
};

export function realEmailDebriefFlags(scenarioId: string): DrillFlag[] | null {
  return SCENARIO_FLAGS[scenarioId] ?? null;
}
