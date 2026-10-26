// Where pre-survey answers live: the safespace-prod Supabase project
// (SUPABASE_PROD_URL / SUPABASE_PROD_SECRET_KEY), table safespace.presurvey_responses,
// reached through Supabase's Data API with the secret key. This is a different project
// from the scam-intelligence one (SUPABASE_URL), which holds the bulletin scam variants.
//
// One-time setup in safespace-prod: add `safespace` under Project Settings → Data API →
// Exposed schemas, and run supabase/manual/presurvey_responses.sql in the SQL editor.
//
// Reads used to pick drill content fail open (no answers → a random variant); saving
// fails loudly so the pre-survey screen can tell the player it didn't save.
import { cleanPresurvey } from './presurvey.js';

const TABLE = 'presurvey_responses';
const SCHEMA = 'safespace';
const DEFAULT_TIMEOUT_MS = 5000;

export class PresurveyStoreUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'PresurveyStoreUnavailable';
    this.code = 'PRESURVEY_STORE_UNAVAILABLE';
  }
}

export function presurveyStoreConfig(env = process.env) {
  const url = String(env.SUPABASE_PROD_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_PROD_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

function rowToResponses(row) {
  if (!row) return null;
  return cleanPresurvey({
    ageRange: row.age_range,
    situation: row.situation,
    activities: row.activities,
    interests: row.interests,
    channels: row.channels,
    includeOtherTypes: row.include_other_types,
    completed: row.completed,
  });
}

function responsesToRow(userId, responses) {
  return {
    user_id: String(userId),
    age_range: responses.ageRange,
    situation: responses.situation,
    activities: responses.activities,
    interests: responses.interests,
    channels: responses.channels,
    include_other_types: responses.includeOtherTypes,
    completed: responses.completed,
    updated_at: new Date().toISOString(),
  };
}

async function request(path, init, { env, timeoutMs }) {
  const config = presurveyStoreConfig(env);
  if (!config) throw new PresurveyStoreUnavailable('SUPABASE_PROD_URL and SUPABASE_PROD_SECRET_KEY must be set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: config.key,
        accept: 'application/json',
        'accept-profile': SCHEMA,
        'content-profile': SCHEMA,
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    throw new PresurveyStoreUnavailable(`pre-survey store unreachable: ${error?.name || 'error'}`);
  } finally {
    clearTimeout(timer);
  }
  const text = await response.text();
  if (!response.ok) {
    // e.g. PGRST106 (schema not exposed), 42501 (no grant), PGRST205 (table missing).
    throw new PresurveyStoreUnavailable(`pre-survey store returned ${response.status}: ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
}

/** The player's saved answers, or null if they never saved any. Throws when unreachable. */
export async function getPresurvey(userId, { env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!userId) return null;
  const rows = await request(
    `${TABLE}?user_id=eq.${encodeURIComponent(String(userId))}&select=*&limit=1`,
    { method: 'GET' },
    { env, timeoutMs },
  );
  return rowToResponses(Array.isArray(rows) ? rows[0] : null);
}

/** getPresurvey for drill content: null instead of throwing, so drills never break. */
export async function getPresurveyOrNull(userId, options = {}) {
  try {
    return await getPresurvey(userId, options);
  } catch (error) {
    console.error('[presurvey]', error?.message || error);
    return null;
  }
}

/** Save (insert or replace) the player's answers; returns the cleaned copy stored. */
export async function savePresurvey(userId, responses, { env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const clean = cleanPresurvey(responses);
  if (!clean) throw new Error('pre-survey responses are invalid');
  const rows = await request(
    `${TABLE}?on_conflict=user_id`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(responsesToRow(userId, clean)),
    },
    { env, timeoutMs },
  );
  return rowToResponses(Array.isArray(rows) ? rows[0] : null) ?? clean;
}
