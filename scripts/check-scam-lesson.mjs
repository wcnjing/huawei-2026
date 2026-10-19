// Local check for AI-written email drills, without sending any email. Picks random scam
// variants from Supabase (server/scam-variants.js), has OpenAI write each drill email
// (server/email-writer.js), prints it with the lesson, Pixi's fallback line and the safety
// follow-up payload, and writes a preview of the email and the "gotcha" reveal page to
// scripts/.scam-lesson-preview/ to open in a browser.
//
// Usage: node --env-file=.env scripts/check-scam-lesson.mjs [count=3] [language=en]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { followupLesson } from '../server/email.js';
import { getRandomLesson, scamVariantsConfig } from '../server/scam-variants.js';
import { emailWriterConfigured, writeDrillEmail } from '../server/email-writer.js';
import { educationalPage, escapeHtml } from '../server/pages.js';
import { templatePixiMessages } from '../server/drill-announce.js';

if (!scamVariantsConfig()) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set (in .env).');
  process.exit(1);
}
if (!emailWriterConfigured()) {
  console.error('OPENAI_API_KEY must be set (in .env), and EMAIL_AI must not be "off".');
  process.exit(1);
}

const count = Math.max(1, Number(process.argv[2]) || 3);
const language = process.argv[3] || 'en';
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '.scam-lesson-preview');
fs.mkdirSync(outDir, { recursive: true });

let written = 0;
for (let i = 1; i <= count; i += 1) {
  const lesson = await getRandomLesson({ timeoutMs: 5000 });
  if (!lesson) {
    console.log('No usable scam variant (none with red flags or prevention advice). Stopping.');
    break;
  }
  console.log(`\n=== drill ${i}: ${lesson.scamName} · ${lesson.variantName} (${lesson.variantId}) ===`);
  const email = await writeDrillEmail(lesson, { language });
  if (!email) {
    console.log('  OpenAI reply unusable or failed: a real drill would send a fixed template here.');
    continue;
  }
  written += 1;
  console.log(`  from:      ${email.sender}`);
  console.log(`  subject:   ${email.subject}`);
  console.log(`  body:      ${email.paragraphs.join('\n             ')}`);
  console.log(`  button:    [${email.action}]`);
  console.log(`  red flags: ${lesson.redFlags.join(' | ') || '(none)'}`);
  console.log(`  pixi:      ${templatePixiMessages({ channel: 'email', won: false, lesson })[1]}`);
  console.log(`  follow-up: ${JSON.stringify(followupLesson(lesson))}`);

  const emailHtml = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(email.subject)}</title>
<body style="font:15px/1.5 sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem">
<p><b>From:</b> ${escapeHtml(email.sender)}<br><b>Subject:</b> ${escapeHtml(email.subject)}</p><hr>
<p>Hi there,</p><p>${escapeHtml(email.paragraphs[0])}</p><p><strong>${escapeHtml(email.paragraphs[1])}</strong></p>
<p><a href="#">${escapeHtml(email.action)}</a></p><p><a href="#">Report as suspicious</a></p></body>`;
  const { html } = educationalPage({
    variant: 'lose',
    title: 'Gotcha — this was a SafeSpace drill',
    heading: 'Gotcha — this was a SafeSpace drill',
    message: 'Preview of the reveal page for this drill.',
    lesson,
  });
  fs.writeFileSync(path.join(outDir, `drill-${i}-email.html`), emailHtml);
  fs.writeFileSync(path.join(outDir, `drill-${i}-reveal.html`), html);
  console.log(`  preview:   ${path.join(outDir, `drill-${i}-email.html`)}`);
  console.log(`             ${path.join(outDir, `drill-${i}-reveal.html`)}`);
}
console.log(`\n${written}/${count} drill emails written.`);
