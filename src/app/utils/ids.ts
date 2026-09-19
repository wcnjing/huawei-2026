export function createAttemptId(prefix = "attempt"): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch { /* fall through to a non-cryptographic UI id */ }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeNotifId() {
  return "n_" + Math.random().toString(36).slice(2, 10);
}

export function makeTxId() {
  return Math.random().toString(36).slice(2, 10);
}