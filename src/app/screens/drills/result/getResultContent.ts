import type { DrillType, SmsOutcome, EmailOutcome, CallOutcome } from "../../../types/drills";
import type { Translate } from "../../../i18n";
import { RED_FLAGS, LIVE_CALL_FLAGS, SMS_FLAGS, EMAIL_FLAGS } from "../../../data/scamFlags";

export function getResultContent(
  t: Translate,
  win: boolean,
  drillType: DrillType,
  smsOutcome: SmsOutcome | null,
  emailOutcome: EmailOutcome | null,
  callOutcome: CallOutcome | null,
) {
  if (drillType === "call") {
    const liveContent: Partial<Record<CallOutcome, { header: string; feedback: string }>> = {
      hung_up: {
        header: t("CALL ENDED SAFELY!"),
        feedback: t("You refused the request and ended the call. That breaks the scammer's pressure loop."),
      },
      disengaged: {
        header: t("VERIFIED SAFELY!"),
        feedback: t("You disengaged and chose an independent, official way to verify the story. That's the safest response."),
      },
      caught_flag: {
        header: t("RED FLAG SPOTTED!"),
        feedback: t("You recognised the suspicious behaviour. Next time, end the call immediately and verify through an official channel."),
      },
      complied: {
        header: t("LET'S REVIEW"),
        feedback: t("You agreed to an unsafe instruction. Pause before acting, end the call, and verify independently—even when the caller sounds official."),
      },
      shared_data: {
        header: t("SENSITIVE DATA SHARED"),
        feedback: t("The drill detected that sensitive information or a completed payment was shared. A real caller should never receive an OTP, PIN, password or transfer."),
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
      header: win ? t("DRILL COMPLETE!") : t("LET'S REVIEW"),
      xp: win ? 50 : 0,
      feedback: win ? t("You correctly identified gift card payment as a scam tactic!") : t("Never give gift card numbers to strangers on the phone!"),
      flags: RED_FLAGS,
    };
  }
  if (drillType === "sms") {
    if (win) {
      const feedback =
        smsOutcome === "asked-family" ? t("You paused and checked before acting. Good thinking!") :
        smsOutcome === "closed-page" ? t("You recognised the fake page and closed it before entering your details.") :
        t("You spotted the suspicious delivery message and avoided the phishing link.");
      return { header: t("SCAM BLOCKED!"), xp: 50, feedback, flags: SMS_FLAGS };
    }
    return { header: t("LINK OPENED — REVIEW"), xp: 0, feedback: t("You tapped the link and reached a fake payment page. Scammers often use small fees to steal card details."), flags: SMS_FLAGS };
  }
  if (win) {
    const feedback =
      emailOutcome === "asked-family" ? t("You paused and verified before trusting the email.") :
      emailOutcome === "cancelled-download" ? t("You stopped the download before opening the file.") :
      t("You inspected the email before clicking. Reporting phishing protects both you and your house.");
    return { header: t("PHISHING REPORTED!"), xp: 50, feedback, flags: EMAIL_FLAGS };
  }
  if (emailOutcome === "opened-attachment") {
    return { header: t("ATTACHMENT OPENED"), xp: 0, feedback: t("You opened a suspicious ZIP attachment. Attachments can hide malware or fake forms."), flags: EMAIL_FLAGS };
  }
  return { header: t("DETAILS ENTERED — REVIEW"), xp: 0, feedback: t("You submitted details on a fake login page. Scammers use official-looking forms to steal passwords, IDs, and OTPs."), flags: EMAIL_FLAGS };
}
