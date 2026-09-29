import { DrillState } from "./types";
import { EMAILS } from "./mock-data";

export interface CoachResult {
  strengths: string[];
  improvements: string[];
}

/**
 * Mocked AI Coach.
 *
 * In production this would send `state` (which emails were inspected,
 * hovered, reported, etc.) to OpenAI along with the scenario's phishing
 * indicators and ask for a short behavioural critique — see the commented
 * `generateCoachFeedbackViaOpenAI` function below for the real shape of
 * that call. For this local scaffold we derive the same kind of feedback
 * with simple rules so the UI/UX can be fully exercised offline.
 */
export function generateCoachFeedback(state: DrillState): CoachResult {
  const strengths: string[] = [];
  const improvements: string[] = [];

  EMAILS.forEach((e) => {
    if (state.inspected[e.id]) {
      strengths.push("Checked the sender address before trusting a message");
    }
    if (state.hovered[e.id]) {
      strengths.push("Hovered links to preview the destination before clicking");
    }
    if (e.phishing && state.reported[e.id]) {
      strengths.push(`Correctly reported "${e.subject}" as phishing`);
    }
    if (
      e.phishing &&
      !state.inspected[e.id] &&
      !state.reported[e.id] &&
      !state.deleted[e.id]
    ) {
      improvements.push(`Didn't inspect or flag "${e.subject}", a phishing attempt`);
    }
  });

  return {
    strengths: [...new Set(strengths)].slice(0, 4),
    improvements: [...new Set(improvements)].slice(0, 3),
  };
}

/*
// --------------------------------------------------------------------------
// Real implementation, once OPENAI_API_KEY is available server-side
// (e.g. in an app/api/coach/route.ts Route Handler):
// --------------------------------------------------------------------------
//
// export async function generateCoachFeedbackViaOpenAI(state: DrillState) {
//   const response = await fetch("https://api.openai.com/v1/chat/completions", {
//     method: "POST",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//     },
//     body: JSON.stringify({
//       model: "gpt-4.1",
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a cybersecurity coach reviewing a trainee's behaviour during a phishing simulation. Respond ONLY as JSON: { strengths: string[], improvements: string[] }.",
//         },
//         { role: "user", content: JSON.stringify(state) },
//       ],
//     }),
//   });
//   const data = await response.json();
//   return JSON.parse(data.choices[0].message.content);
// }
*/
