// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { educationalPage, PAGE_VARIANTS } from './pages.js';

// The reported bug: report and reveal links rendered the SAME page, so a pass and a
// fail were indistinguishable. This pins that win, lose and neutral each produce a
// visibly different page — a future edit that collapses them back fails here.
test('win, lose and neutral render as visibly distinct pages', () => {
  const win = educationalPage({ title: 't', heading: 'h', message: 'm', variant: 'win' }).html;
  const lose = educationalPage({ title: 't', heading: 'h', message: 'm', variant: 'lose' }).html;
  const neutral = educationalPage({ title: 't', heading: 'h', message: 'm', variant: 'neutral' }).html;

  // Distinct accent colours — the primary visual signal of the outcome.
  assert.notEqual(PAGE_VARIANTS.win.edge, PAGE_VARIANTS.lose.edge);
  assert.notEqual(PAGE_VARIANTS.win.edge, PAGE_VARIANTS.neutral.edge);
  assert.notEqual(PAGE_VARIANTS.lose.edge, PAGE_VARIANTS.neutral.edge);

  // Win reads as a pass (green), lose as danger (red), and each carries its own tag.
  assert.ok(win.includes(PAGE_VARIANTS.win.edge) && win.includes('DRILL PASSED'));
  assert.ok(lose.includes(PAGE_VARIANTS.lose.edge) && lose.includes('GOTCHA'));
  assert.ok(!win.includes(PAGE_VARIANTS.lose.edge), 'a win must not carry the lose colour');
});

test('an unknown variant falls back to neutral, never blank', () => {
  const page = educationalPage({ title: 't', heading: 'h', message: 'm', variant: 'nonsense' });
  assert.ok(page.html.includes(PAGE_VARIANTS.neutral.edge));
  assert.equal(page.status, 200);
});

test('a confirm action renders a POST form; its absence renders none', () => {
  const withForm = educationalPage({
    title: 't', heading: 'h', message: 'm',
    confirmAction: '/drill-reveal?token=x', confirmLabel: 'SHOW DRILL REVEAL',
  }).html;
  assert.match(withForm, /<form method="post" action="\/drill-reveal\?token=x">/);
  assert.ok(withForm.includes('SHOW DRILL REVEAL'));

  const noForm = educationalPage({ title: 't', heading: 'h', message: 'm' }).html;
  assert.ok(!noForm.includes('<form'), 'no confirmAction -> no form');
});
