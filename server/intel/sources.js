// Where scam intel comes from, and the only code that fetches it.
//
// A fixed allowlist, never a crawler. Each source is one listing page or feed; from a
// listing we may follow same-origin links matching that source's own pattern, one level
// deep. Redirects are not followed, robots.txt is honoured (an unreadable robots.txt
// means "do not fetch"), and requests to one host are spaced out.
//
// Every source records the terms of use it was checked against. A source runs only when
// it is enabled AND its terms permit automated access, so flipping `enabled` by mistake
// cannot put the app in breach of a site's terms.

export const USER_AGENT = 'SafeSpaceDrillBot/1.0 (+https://github.com/wcnjing/huawei-2026)';
const ROBOTS_TOKEN = 'safespacedrillbot';
const MIN_REQUEST_GAP_MS = 2_000;
const MAX_CRAWL_DELAY_MS = 15_000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const MIN_PAGE_CHARS = 40;
const DEFAULT_MAX_PAGES = 3;

// automatedAccess: 'permitted' | 'permission-granted' (you hold written permission; say
// where in `clause`) | 'prohibited' | 'unverified'. Only the first two can run.
const USABLE_TERMS = new Set(['permitted', 'permission-granted']);

const SCAMSHIELD_TERMS = Object.freeze({
  url: 'https://www.scamshield.gov.sg/terms-of-use/',
  checkedOn: '2026-09-14',
  automatedAccess: 'prohibited',
  clause: 'Clause 3.3.3 prohibits scraping the Service without GovTech consent.',
});

const SPF_TERMS = Object.freeze({
  url: 'https://www.police.gov.sg/Terms-of-Use',
  checkedOn: '2026-09-14',
  automatedAccess: 'prohibited',
  clause: 'Prohibits using any manual or automatic device to gather site content; only public search engines are excepted.',
});

const SPH_TERMS = Object.freeze({
  url: 'https://www.sph.com.sg/tnc/website',
  checkedOn: '2026-09-14',
  automatedAccess: 'prohibited',
  clause: 'Prohibits accessing the site with any automated process, scripting software or bots, and defines the site to include its RSS feeds.',
});

const MEDIACORP_TERMS = Object.freeze({
  url: 'https://www.mediacorp.sg/terms-conditions',
  checkedOn: '2026-09-14',
  automatedAccess: 'prohibited',
  clause: 'Prohibits using any robot, spider or other automatic device to monitor or copy any part of the site.',
});

export const SOURCES = Object.freeze([
  {
    id: 'scamshield-bulletins',
    label: 'ScamShield scam bulletins',
    kind: 'html',
    url: 'https://www.scamshield.gov.sg/resources/scam-bulletins/',
    enabled: false,
    terms: SCAMSHIELD_TERMS,
  },
  {
    id: 'scamshield-act-campaign',
    label: 'ScamShield I can ACT against scams',
    kind: 'html',
    url: 'https://www.scamshield.gov.sg/get-involved/i-can-act-campaign/',
    enabled: false,
    terms: SCAMSHIELD_TERMS,
  },
  {
    id: 'scamshield-scam-types',
    label: 'ScamShield scam types',
    kind: 'html',
    url: 'https://www.scamshield.gov.sg/i-want-protection-from-scams/learn-to-recognise-scams/',
    follow: /^\/i-want-protection-from-scams\/learn-to-recognise-scams\/[a-z0-9-]+\/$/,
    maxPages: 3,
    enabled: false,
    terms: SCAMSHIELD_TERMS,
  },
  {
    id: 'spf-scam-advisories',
    label: 'SPF scam advisories',
    kind: 'html',
    url: 'https://www.police.gov.sg/Advisories/Scams',
    follow: /^\/Media-Hub\/News\/\d{4}\/\d{2}\/[^/]*(?:scam|advisory)[^/]*$/i,
    maxPages: 3,
    enabled: false,
    terms: SPF_TERMS,
  },
  {
    id: 'straits-times-singapore',
    label: 'The Straits Times Singapore',
    kind: 'rss',
    url: 'https://www.straitstimes.com/news/singapore/rss.xml',
    match: /\bscam/i,
    maxPages: 3,
    enabled: false,
    terms: SPH_TERMS,
  },
  {
    id: 'cna-singapore',
    label: 'CNA Singapore',
    kind: 'rss',
    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416',
    match: /\bscam/i,
    maxPages: 3,
    enabled: false,
    terms: MEDIACORP_TERMS,
  },
]);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…',
};

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ' ';
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** Readable text from a page, preferring <main> and dropping scripts, styles and chrome. */
export function htmlToText(html) {
  let source = String(html ?? '');
  const main = source.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) source = main[1];
  const stripped = source
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|button|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped)
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Same-origin https links whose path matches `pattern`, deduplicated, in page order. */
export function extractLinks(html, baseUrl, pattern) {
  const base = new URL(baseUrl);
  const seen = new Set();
  const links = [];
  for (const [, , href] of String(html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    let url;
    try {
      url = new URL(decodeEntities(href), base);
    } catch {
      continue;
    }
    if (url.protocol !== 'https:' || url.origin !== base.origin || !pattern.test(url.pathname)) continue;
    url.hash = '';
    const key = url.toString();
    if (!seen.has(key)) {
      seen.add(key);
      links.push(key);
    }
  }
  return links;
}

export function parseRssItems(xml) {
  const items = [];
  for (const [, block] of String(xml ?? '').matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const field = (name) => {
      const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
      if (!match) return '';
      return decodeEntities(match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1'));
    };
    items.push({
      title: htmlToText(field('title')),
      link: field('link').trim(),
      description: htmlToText(field('description')),
    });
  }
  return items;
}

function robotsPattern(pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map(escapeRegex).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

function robotsPolicy(rules, crawlDelayMs) {
  return {
    crawlDelayMs,
    allows(pathAndQuery) {
      if (pathAndQuery === '/robots.txt') return true;
      // Longest matching rule wins; on a tie, Allow wins (RFC 9309).
      let best = null;
      for (const rule of rules) {
        if (!rule.regex.test(pathAndQuery)) continue;
        const length = rule.pattern.length;
        if (!best || length > best.length || (length === best.length && rule.allow)) {
          best = { length, allow: rule.allow };
        }
      }
      return best ? best.allow : true;
    },
  };
}

const ALLOW_ALL = robotsPolicy([], 0);
const DENY_ALL = Object.freeze({ crawlDelayMs: 0, allows: () => false });

export function parseRobots(text) {
  const groups = [];
  let group = null;
  let readingAgents = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === 'user-agent') {
      if (!readingAgents) {
        group = { agents: [], rules: [], crawlDelay: null };
        groups.push(group);
      }
      group.agents.push(value.toLowerCase().split('/')[0]);
      readingAgents = true;
      continue;
    }
    readingAgents = false;
    if (!group) continue;
    if ((field === 'allow' || field === 'disallow') && value) {
      group.rules.push({ allow: field === 'allow', pattern: value, regex: robotsPattern(value) });
    } else if (field === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) group.crawlDelay = seconds;
    }
  }
  const ours = groups.filter((candidate) => candidate.agents.includes(ROBOTS_TOKEN));
  const applicable = ours.length ? ours : groups.filter((candidate) => candidate.agents.includes('*'));
  const delays = applicable.map((candidate) => candidate.crawlDelay).filter((delay) => delay !== null);
  return robotsPolicy(
    applicable.flatMap((candidate) => candidate.rules),
    delays.length ? Math.max(...delays) * 1000 : 0,
  );
}

export async function loadRobots(origin, { fetchImpl = globalThis.fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${origin}/robots.txt`, {
      headers: { 'user-agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return DENY_ALL;
  }
  // No robots.txt means no restrictions. Anything else we cannot read (a server error, a
  // redirect, an auth wall) means we do not know, so we do not fetch.
  if (response.status === 404 || response.status === 410) return ALLOW_ALL;
  if (response.status !== 200) return DENY_ALL;
  return parseRobots(await response.text());
}

export function sourceBlockReason(source) {
  if (source?.enabled !== true) return 'disabled';
  if (!USABLE_TERMS.has(source.terms?.automatedAccess)) return 'blocked_by_terms';
  return null;
}

class SourceSkip extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html, application/rss+xml, application/xml;q=0.9' },
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '';
  if (!/html|xml/i.test(type)) throw new Error(`unexpected content type ${type || '(none)'}`);
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) throw new Error('response too large');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('response too large');
  return new TextDecoder('utf-8').decode(bytes);
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch every runnable source. Returns { pages, report }: pages are text in memory for
 * this run only and are never persisted; report holds one status per source.
 */
export async function collectSources({
  sources = SOURCES,
  fetchImpl = globalThis.fetch,
  deadline = Date.now() + 60_000,
  clock = Date.now,
  sleep = defaultSleep,
  log = console,
} = {}) {
  const pages = [];
  const report = [];
  const robotsByOrigin = new Map();
  const lastRequestAt = new Map();

  const robotsFor = async (url) => {
    const { origin } = new URL(url);
    if (!robotsByOrigin.has(origin)) robotsByOrigin.set(origin, await loadRobots(origin, { fetchImpl }));
    return robotsByOrigin.get(origin);
  };
  const allowedByRobots = async (url) => {
    const target = new URL(url);
    return (await robotsFor(url)).allows(target.pathname + target.search);
  };

  const politeFetch = async (url) => {
    const target = new URL(url);
    if (!(await allowedByRobots(url))) throw new SourceSkip('robots_disallowed');
    const robots = await robotsFor(url);
    const gap = Math.min(MAX_CRAWL_DELAY_MS, Math.max(MIN_REQUEST_GAP_MS, robots.crawlDelayMs));
    const previous = lastRequestAt.get(target.origin);
    const wait = previous === undefined ? 0 : Math.max(0, previous + gap - clock());
    if (clock() + wait + FETCH_TIMEOUT_MS > deadline) throw new SourceSkip('out_of_time');
    if (wait > 0) await sleep(wait);
    lastRequestAt.set(target.origin, clock());
    return fetchText(target.toString(), fetchImpl);
  };

  for (const source of sources) {
    const blocked = sourceBlockReason(source);
    if (blocked) {
      report.push({ id: source.id, status: blocked, pages: 0 });
      continue;
    }
    let added = 0;
    const addPage = (url, text) => {
      if (text.length < MIN_PAGE_CHARS) return;
      pages.push({ sourceId: source.id, label: source.label, url, text, fetchedAt: new Date(clock()).toISOString() });
      added += 1;
    };
    try {
      const maxPages = source.maxPages ?? DEFAULT_MAX_PAGES;
      const body = await politeFetch(source.url);
      if (source.kind === 'rss') {
        const origin = new URL(source.url).origin;
        for (const item of parseRssItems(body)) {
          if (added >= maxPages) break;
          let link;
          try {
            link = new URL(item.link);
          } catch {
            continue;
          }
          if (link.protocol !== 'https:' || link.origin !== origin) continue;
          if (source.match && !source.match.test(`${item.title} ${item.description}`)) continue;
          // Headline and summary only. The article itself is never fetched.
          addPage(link.toString(), `${item.title}\n${item.description}`.trim());
        }
      } else if (source.follow) {
        const candidates = extractLinks(body, source.url, source.follow);
        const links = [];
        for (const link of candidates) {
          if (links.length >= maxPages) break;
          if (await allowedByRobots(link)) links.push(link);
        }
        for (const link of links) {
          try {
            addPage(link, htmlToText(await politeFetch(link)));
          } catch (error) {
            if (error instanceof SourceSkip) throw error;
            log.warn?.(`[intel] ${source.id}: skipped ${link}:`, error?.message || error);
          }
        }
      } else {
        addPage(source.url, htmlToText(body));
      }
      report.push({ id: source.id, status: 'ok', pages: added });
    } catch (error) {
      const status = error instanceof SourceSkip ? error.reason : 'error';
      if (status === 'error') log.warn?.(`[intel] ${source.id} failed:`, error?.message || error);
      report.push({ id: source.id, status, pages: added });
    }
  }
  return { pages, report };
}
