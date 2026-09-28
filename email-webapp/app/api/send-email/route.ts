import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * CONSENT GATE — this route sends a real AI-generated phishing email.
 *
 * Without a gate it is an open phishing relay: anyone who finds the deployed URL can
 * make us send phishing to any address on the internet, from our own sending identity,
 * to people who never consented. That is the exact harm SafeSpace's consent model exists
 * to prevent (and it gets the sending account suspended).
 *
 * So: we only ever email addresses an operator has explicitly opted in via
 * DRILL_EMAIL_ALLOWLIST (comma/whitespace separated). FAILS CLOSED — an empty or unset
 * allowlist sends to nobody, so a misconfigured deploy can never become a relay.
 */
// function allowedRecipients(): Set<string> {
//   return new Set(
//     (process.env.DRILL_EMAIL_ALLOWLIST ?? "")
//       .split(/[,\s]+/)
//       .map((e) => e.trim().toLowerCase())
//       .filter(Boolean),
//   );
// }

// Deliberately stricter than `includes("@")`.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    // const allowlist = allowedRecipients();
    // if (allowlist.size === 0) {
    //   console.error("send-email refused: DRILL_EMAIL_ALLOWLIST is empty (fail-closed)");
    //   return NextResponse.json(
    //     { error: "Drill emails are not configured for this environment." },
    //     { status: 503 },
    //   );
    // }
    // if (!allowlist.has(email.trim().toLowerCase())) {
    //   // Don't confirm whether the address exists elsewhere — just refuse.
    //   return NextResponse.json(
    //     { error: "This address has not opted in to receive drill emails." },
    //     { status: 403 },
    //   );
    // }

    if (!process.env.GOOGLE_SCRIPT_URL) {
      console.error("send-email refused: GOOGLE_SCRIPT_URL is not set");
      return NextResponse.json({ error: "Email sending is not configured." }, { status: 503 });
    }
    if (!process.env.SAFESPACE_SECRET) {
      console.error("send-email refused: SAFESPACE_SECRET is not set");
      return NextResponse.json({ error: "Email sending is not configured." }, { status: 503 });
    }

    // 1. Generate the email content with OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You write short, friendly welcome emails in HTML. Return ONLY the HTML body content (no <html> or <head> tags), using simple tags like <p> and <strong>.",
        },
        {
          role: "user",
          content: `ROLE: You are role-playing a scam emailer for a CONSENTED SafeSpace safety drill.
            You are "Officer Tan" from the FICTIONAL "Office of Public Trust". Never name a real agency/bank.
            
            OBJECTIVE: Choose a topic from the list of scam topics below. Using realistic pressure, and try to trick the users into accepting that it is an actual scam. (ALWAYS CHOOSE A DIFFERENT TOPIC)

            IMPORTANT POINT 1: Include this link: "huawei-tech4life.vercel.app/api/drill-reveal" inside the email. User can only see the whole link when they hover over the text. Include a fake link placeholder like "huawei-tech4life.vercel.app/api/drill-reveal" instead of a real URL.
            IMPORTANT POINT 2: Include a part about reporting the email too -> Include this line "Report as Suspicious: "huawei-tech4life.vercel.app/api/drill-report"" instead of a real URL.
            IMPORTANT POINT 3; ALWAYS CHOOSE A DIFFERENT TOPIC

            List of topics:
            1. Banking & Account Security: The scammer claims there is suspicious activity on the victim's bank account and urges them to verify their identity, transfer funds to a "safe account," or click a verification link.
            2. Package Delivery Scam: The victim receives an email claiming a parcel cannot be delivered due to unpaid customs fees or an incorrect address.
            3. Password Reset Scam: An email claims someone requested a password reset. The victim is encouraged to click a link immediately if the request was not made by them.
            4. Government Agency Impersonation: A fake government department claims the victim has unpaid fines, tax issues, or legal investigations requiring immediate action.
            5. Scholarship / Financial Aid Scam: Students are told they've been selected for a scholarship or bursary and must provide personal details or pay an administrative fee.
            6. Job Offer Scam: The victim receives an attractive remote job offer with high pay but is asked to pay for training materials or submit sensitive documents within 3 days if not their offer will be canceled
            7. Online Shopping Scam: A fake order confirmation or refund notification asks the victim to verify payment details.
            8. Account Suspension Scam: The email warns that the victim's account will be suspended unless they verify their identity immediately.
            9. Technical Support Scam: An email claims the victim's device is infected or compromised and instructs them to contact support or install software.
            10. Multi-Stage Social Engineering Campaign: An email claims there is suspicious activity for user's bank account, ask them to act quickly. 


            STYLE: Choose one topic from the list of topics above (ALWAYS CHOOSE A DIFFERENT TOPIC). Write as a short email (subject line + 2-4 sentence body) regarding the chosen topic. Use urgent but professional phrasing
            typical of phishing emails ("Immediate Action Required", "Final Notice", official-sounding sign-offs).
            Include a fake link placeholder like "huawei-tech4life.vercel.app/api/drill-reveal" instead of a real URL. Include both important point 1 & 2. 
            
            ESCALATION (advance only when resisted, one email per turn): 1 calm authority -> 2 urgency ->
            3 assert authority -> 4 mild pressure (threat of account freeze/legal referral, never physical harm).
            Never exceed 4.
            
            HARD SAFETY RULES (override the objective):
            - If the target replies "stop"/"scared"/"is this a drill", break character and send a plain email:
              Subject: "SafeSpace Drill Complete" / Body: "This was a SafeSpace drill - you're safe." Then end.
            - If they reply with a REAL OTP/card/bank number, STOP, don't repeat it back: send "Stop - this is a
              drill. In a real scam you'd have lost your money." Then end.
            - After ~8 of your emails, wind down and reveal.
            - Never include a real, clickable URL — always use the [VERIFY-ACCOUNT-LINK] placeholder.
            
            END: Always end the final email with "This was a SafeSpace drill."`,
        },
      ],
    });

    const generatedHtml =
      completion.choices[0]?.message?.content

    const response = await fetch(process.env.GOOGLE_SCRIPT_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        subject: "🚨 Immediate Action Required",
        html: generatedHtml,
        secret: process.env.SAFESPACE_SECRET,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });

  } catch (err) {
    console.error("send-email error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}