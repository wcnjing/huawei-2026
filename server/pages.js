// Server-rendered landing pages for drill links (opened from an email/SMS, so they must
// stand alone — no client bundle, no external font, inline styles only to satisfy the
// strict CSP on these routes).
//
// `variant` gives an outcome a distinct look so a pass and a fail can't be confused:
//   win     — they reported / didn't fall for it   (green)
//   lose    — they clicked the scam link           (red; the teaching "gotcha")
//   neutral — confirm steps, invalid/expired, errors (teal)

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
}) {
  const v = PAGE_VARIANTS[variant] || PAGE_VARIANTS.neutral;
  const html = `<!doctype html>
<html lang="en">
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
    .home{display:inline-block;margin-top:1.5rem;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase}
  </style>
</head>
<body><main>
  <div class="tag">${v.tag}</div>
  <div class="mark" aria-hidden="true">${v.mark}</div>
  <h1>${heading}</h1>
  <p>${message}</p>
  ${confirmAction && confirmLabel
    ? `<form method="post" action="${confirmAction}"><button type="submit">${confirmLabel}</button></form>`
    : ''}
  <a class="home" href="/">▸ Return to SafeSpace</a>
</main></body></html>`;
  return { html, status };
}
