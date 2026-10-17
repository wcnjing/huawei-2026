// Server-rendered landing pages for drill links (opened from an email/SMS, so they must
// stand alone — no client bundle, no external font, inline styles only to satisfy the
// strict CSP on these routes).
//
// `variant` gives an outcome a distinct look so a pass and a fail can't be confused:
//   win     — they reported / didn't fall for it   (green)
//   lose    — they clicked the scam link           (red; the teaching "gotcha")
//   neutral — confirm steps, invalid/expired, errors (teal)

import { htmlLang, pageText } from './language.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The real scam variant behind a drill (scam-variants.js). Its text comes from
 * AI-extracted bulletins, so every value is escaped here; the labels are translated but
 * the bulletin text stays in English.
 */
function lessonSection(lesson, language) {
  if (!lesson) return '';
  const label = (text) => escapeHtml(pageText(language, text));
  const title = [lesson.scamName, lesson.variantName].filter(Boolean).map(escapeHtml).join(' · ');
  const flags = lesson.redFlags?.length
    ? `<h2>${label('Red flags to watch for')}</h2>
    <ul>${lesson.redFlags.map((flag) => `<li>${escapeHtml(flag)}</li>`).join('')}</ul>`
    : '';
  const check = lesson.verificationMethod
    ? `<h2>${label('How to check')}</h2><p>${escapeHtml(lesson.verificationMethod)}</p>`
    : '';
  const advice = lesson.preventionAdvice
    ? `<h2>${label('What to do instead')}</h2><p>${escapeHtml(lesson.preventionAdvice)}</p>`
    : '';
  return `<section class="lesson">
    <div class="tag">${label('The real scam behind this drill')}</div>
    ${title ? `<p class="scam">${title}</p>` : ''}
    ${flags}${check}${advice}
  </section>`;
}

export const PAGE_VARIANTS = {
  win: { bg: '#07130d', panel: '#0d2117', edge: '#00ff88', shadow: '#031a0e', accent: '#00ff88', ink: '#eafff2', mark: '✔', tag: 'DRILL PASSED' },
  lose: { bg: '#170a0d', panel: '#210f11', edge: '#ff2d55', shadow: '#1a0509', accent: '#ff6b35', ink: '#ffeef1', mark: '✖', tag: 'GOTCHA' },
  neutral: { bg: '#0a0e1a', panel: '#111827', edge: '#4ecdc4', shadow: '#04121a', accent: '#4ecdc4', ink: '#e8f4f8', mark: '🛡', tag: 'SAFESPACE' },
};

export function educationalPage({
  title,
  heading,
  message,
  status = 200,
  confirmAction = null,
  confirmLabel = null,
  variant = 'neutral',
  language = 'en',
  lesson = null,
}) {
  const v = PAGE_VARIANTS[variant] || PAGE_VARIANTS.neutral;
  const html = `<!doctype html>
<html lang="${htmlLang(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    :root{color-scheme:dark}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:${v.bg};color:${v.ink};font:16px/1.6 ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace;padding:20px}
    main{width:100%;max-width:34rem;padding:2rem 1.75rem;background:${v.panel};
      border:4px solid ${v.edge};box-shadow:10px 10px 0 ${v.shadow}}
    .tag{font-size:.7rem;letter-spacing:.35em;color:${v.accent};text-transform:uppercase;margin-bottom:1rem}
    .mark{display:inline-flex;align-items:center;justify-content:center;width:64px;height:64px;
      border:4px solid ${v.edge};color:${v.accent};font-size:2rem;font-weight:700;margin-bottom:1rem}
    h1{margin:.25rem 0 1rem;font-size:1.35rem;line-height:1.3;letter-spacing:.02em;color:${v.accent};text-transform:uppercase}
    p{margin:.6rem 0}
    button{margin-top:1.25rem;padding:.9rem 1.2rem;border:4px solid ${v.bg};background:${v.accent};
      color:${v.bg};font:700 .95rem ui-monospace,monospace;letter-spacing:.08em;cursor:pointer;
      box-shadow:5px 5px 0 ${v.shadow}}
    button:active{transform:translate(3px,3px);box-shadow:2px 2px 0 ${v.shadow}}
    a{color:${v.accent}}
    .lesson{margin-top:1.5rem;padding-top:1.25rem;border-top:2px dashed ${v.edge}}
    .lesson .tag{margin-bottom:.5rem}
    .lesson .scam{font-weight:700}
    h2{margin:1rem 0 .35rem;font-size:.85rem;letter-spacing:.12em;text-transform:uppercase;color:${v.accent}}
    ul{margin:.4rem 0;padding-left:1.25rem}
    li{margin:.3rem 0}
  </style>
</head>
<body><main>
  <div class="tag">${pageText(language, v.tag)}</div>
  <div class="mark" aria-hidden="true">${v.mark}</div>
  <h1>${heading}</h1>
  <p>${message}</p>
  ${confirmAction && confirmLabel
    ? `<form method="post" action="${confirmAction}"><button type="submit">${confirmLabel}</button></form>`
    : ''}
  ${lessonSection(lesson, language)}
</main></body></html>`;
  return { html, status };
}
