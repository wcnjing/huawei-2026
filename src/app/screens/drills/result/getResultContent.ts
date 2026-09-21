import type { DrillType, SmsOutcome, EmailOutcome, CallOutcome } from "../../../types/drills";
import { RED_FLAGS, LIVE_CALL_FLAGS, SMS_FLAGS, EMAIL_FLAGS } from "../../../data/scamFlags";

export function getResultContent(
  win: boolean,
  drillType: DrillType,
  smsOutcome: SmsOutcome | null,
  emailOutcome: EmailOutcome | null,
  callOutcome: CallOutcome | null,
) {
  if (drillType === "call") {
    const liveContent: Partial<Record<CallOutcome, { header: string; feedback: string }>> = {
      hung_up: {
        header: "CALL ENDED SAFELY!",
        feedback: "You refused the request and ended the call. That breaks the scammer's pressure loop.",
      },
      disengaged: {
        header: "VERIFIED SAFELY!",
        feedback: "You disengaged and chose an independent, official way to verify the story. That's the safest response.",
      },
      caught_flag: {
        header: "RED FLAG SPOTTED!",
        feedback: "You recognised the suspicious behaviour. Next time, end the call immediately and verify through an official channel.",
      },
      complied: {
        header: "LET'S REVIEW",
        feedback: "You agreed to an unsafe instruction. Pause before acting, end the call, and verify independently—even when the caller sounds official.",
      },
      shared_data: {
        header: "SENSITIVE DATA SHARED",
        feedback: "The drill detected that sensitive information or a completed payment was shared. A real caller should never receive an OTP, PIN, password or transfer.",
      },
    };
    if (callOutcome && liveContent[callOutcome]) {
      return {
        ...liveContent[callOutcome]!,
        xp: win ? 50 : 0,
        flags: LIVE_CALL_FLAGS,
      };
    }
    return {
      header: win ? "DRILL COMPLETE!" : "LET'S REVIEW",
      xp: win ? 50 : 0,
      feedback: win ? "You correctly identified gift card payment as a scam tactic!" : "Never give gift card numbers to strangers on the phone!",
      flags: RED_FLAGS,
    };
  }
  if (drillType === "sms") {
    if (win) {
      const feedback =
        smsOutcome === "asked-family" ? "You paused and checked before acting. Good thinking!" :
        smsOutcome === "closed-page" ? "You recognised the fake page and closed it before entering your details." :
        "You spotted the suspicious delivery message and avoided the phishing link.";
      return { header: "SCAM BLOCKED!", xp: 50, feedback, flags: SMS_FLAGS };
    }
    return { header: "LINK OPENED — REVIEW", xp: 0, feedback: "You tapped the link and reached a fake payment page. Scammers often use small fees to steal card details.", flags: SMS_FLAGS };
  }
  if (win) {
    const feedback =
      emailOutcome === "asked-family" ? "You paused and verified before trusting the email." :
      emailOutcome === "cancelled-download" ? "You stopped the download before opening the file." :
      "You inspected the email before clicking. Reporting phishing protects both you and your house.";
    return { header: "PHISHING REPORTED!", xp: 50, feedback, flags: EMAIL_FLAGS };
  }
  if (emailOutcome === "opened-attachment") {
    return { header: "ATTACHMENT OPENED", xp: 0, feedback: "You opened a suspicious ZIP attachment. Attachments can hide malware or fake forms.", flags: EMAIL_FLAGS };
  }
  return { header: "DETAILS ENTERED — REVIEW", xp: 0, feedback: "You submitted details on a fake login page. Scammers use official-looking forms to steal passwords, IDs, and OTPs.", flags: EMAIL_FLAGS };
}
