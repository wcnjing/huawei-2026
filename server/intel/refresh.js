// The scam-intel refresh, run daily by Vercel Cron and on demand for demos.
//
// collect pages -> summarise each into candidate cards -> validate -> merge into the
// bounded card set. Every stage fails soft. A source that is down, a page the model
// refuses, or a card that fails validation is counted and skipped, and the cards already
// stored stay live, so one bad run never empties the set.
import { collectSources } from './sources.js';
import { summariseSource, summariserConfigured } from './summarise.js';
import { cardId, validateCard } from './validate.js';
import { listLiveTacticCards, mergeTacticCards } from '../store.js';

export const DEFAULT_REFRESH_BUDGET_MS = 240_000;
const SUMMARY_CONCURRENCY = 3;
// A summary started with less time than this would likely be cut off by Vercel's 300s
// function limit before the store is written.
const MIN_TIME_FOR_A_SUMMARY_MS = 20_000;

export class IntelUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'IntelUnavailable';
    this.code = 'INTEL_UNAVAILABLE';
  }
}

export function refreshBudgetMs() {
  const configured = Number(process.env.INTEL_REFRESH_BUDGET_MS);
  return Number.isFinite(configured) && configured >= 30_000 && configured <= 270_000
    ? configured
    : DEFAULT_REFRESH_BUDGET_MS;
}

async function forEachLimited(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Run one refresh. Dependencies are injectable so tests never touch the network.
 * The report carries counts only, never page or card text.
 */
export async function runIntelRefresh({
  now = Date.now(),
  clock = Date.now,
  fetchImpl,
  client,
  sources,
  log = console,
  sleep,
} = {}) {
  if (!client && !summariserConfigured()) {
    throw new IntelUnavailable('ANTHROPIC_API_KEY is not set');
  }
  const deadline = now + refreshBudgetMs();
  const collected = await collectSources({ sources, fetchImpl, deadline, clock, sleep, log });
  const report = {
    startedAt: new Date(now).toISOString(),
    sources: collected.report,
    pages: collected.pages.length,
    accepted: 0,
    rejected: 0,
    skippedPages: 0,
    liveCards: 0,
  };

  const accepted = [];
  await forEachLimited(collected.pages, SUMMARY_CONCURRENCY, async (page) => {
    const remaining = deadline - clock();
    if (remaining < MIN_TIME_FOR_A_SUMMARY_MS) {
      report.skippedPages += 1;
      return;
    }
    let result;
    try {
      result = await summariseSource({
        label: page.label,
        text: page.text,
        client,
        timeoutMs: remaining - 10_000,
      });
    } catch (error) {
      report.skippedPages += 1;
      log.error?.(`[intel] summarising ${page.sourceId} failed:`, error?.message || error);
      return;
    }
    if (result.outcome !== 'ok') log.warn?.(`[intel] ${page.sourceId}: no cards (${result.outcome})`);

    for (const candidate of result.candidates) {
      const checked = validateCard(candidate);
      if (!checked.ok) {
        report.rejected += 1;
        // Reasons only: the rejected text came from an attacker-authored page.
        log.warn?.(`[intel] rejected a card from ${page.sourceId}: ${checked.reasons.join('; ')}`);
        continue;
      }
      report.accepted += 1;
      accepted.push({
        id: cardId(checked.card),
        ...checked.card,
        sourceId: page.sourceId,
        sourceLabel: page.label,
        sourceUrl: page.url,
        fetchedAt: page.fetchedAt,
      });
    }
  });

  const live = accepted.length
    ? await mergeTacticCards(accepted, { now })
    : await listLiveTacticCards({ now });
  report.liveCards = live.length;
  return report;
}
