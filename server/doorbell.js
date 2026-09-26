// The "doorbell": after a house changes, tell that house's open apps to refetch.
//
// It is a Supabase Realtime broadcast with no content. Clients learn what changed only
// by calling GET /api/house with their own session, so nothing private travels through
// Supabase. A ring is best-effort: it is bounded by a timeout and never fails a request;
// apps also refetch on focus and every five minutes. The timeout is short because rings
// are awaited inside requests the player is waiting on (sign-in, finishing a drill).
const DEFAULT_TIMEOUT_MS = 1000;

export function doorbellConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(env.SUPABASE_SECRET_KEY || '').trim();
  return url && key ? { url, key } : null;
}

export async function ring(topics, { timeoutMs = DEFAULT_TIMEOUT_MS, env = process.env } = {}) {
  const config = doorbellConfig(env);
  const unique = [...new Set((topics || []).filter(Boolean))];
  if (!config || !unique.length) return false;

  const controller = new AbortController();
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort(new Error('doorbell request timed out'));
      resolve(false);
    }, timeoutMs);
  });
  const request = (async () => {
    try {
      const response = await fetch(`${config.url}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: config.key },
        body: JSON.stringify({
          messages: unique.map((topic) => ({ topic, event: 'changed', payload: {}, private: false })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        console.error(`[doorbell] broadcast returned ${response.status}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[doorbell] broadcast failed:', error?.name || 'error');
      return false;
    }
  })();

  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
