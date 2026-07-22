// Run with: node --test
//
// Exercises the Upstash backend against a fake Redis, so it runs in CI and on a laptop
// with no account and no network. The fake emulates only what store.js sends: MGET and
// the compare-and-set EVAL.
//
// The property under test is the one that matters on a serverless host: several
// instances can handle requests at the same time, and a losing writer must REPLAY its
// change against the fresh document rather than overwrite the winner.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';

// Imported after the env is set — store.js reads it lazily, but this keeps the
// intent obvious.
const { applyOutcome, getUser } = await import('./store.js');

const DB_KEY = 'safespace:db';
const VERSION_KEY = 'safespace:db:version';

const seedDoc = () => ({
  users: {
    you: {
      id: 'you', name: 'YOU', phone: '+6590000001', consentToDrills: true,
      level: 1, xp: 0, xpMax: 500, streak: 0, timesSafe: 0, timesScammed: 0,
      safeThisWeek: true, recentDrillResult: null,
    },
  },
  drills: [],
  pendingResults: {},
  consentEvents: [],
});

let redis;          // key -> string
let realFetch;
let evalCount;
let beforeEval;     // hook used to simulate a competing writer committing first

function installFakeUpstash() {
  redis = new Map();
  evalCount = 0;
  beforeEval = null;
  realFetch = global.fetch;

  const reply = (result) => new Response(JSON.stringify({ result }), {
    status: 200, headers: { 'content-type': 'application/json' },
  });

  global.fetch = async (_url, opts) => {
    const args = JSON.parse(opts.body);
    const cmd = args[0];

    if (cmd === 'MGET') {
      return reply(args.slice(1).map((k) => redis.get(k) ?? null));
    }

    if (cmd === 'EVAL') {
      // ['EVAL', script, '2', dbKey, versionKey, document, expectedVersion]
      const [, , , dbKey, versionKey, doc, expectedVersion] = args;
      // Fires after store.js has read the version but before the CAS is evaluated —
      // exactly the window a competing instance would commit in.
      if (beforeEval) beforeEval(evalCount);
      evalCount++;

      const current = redis.get(versionKey);
      const matches = current === expectedVersion
        || (current === undefined && expectedVersion === '');
      if (!matches) return reply(0);

      redis.set(dbKey, doc);
      redis.set(versionKey, String(Number(current ?? 0) + 1));
      return reply(1);
    }

    throw new Error(`fake upstash got an unexpected command: ${cmd}`);
  };
}

beforeEach(() => installFakeUpstash());
afterEach(() => { global.fetch = realFetch; });

test('reads and writes go to Redis, not the local file', async () => {
  redis.set(DB_KEY, JSON.stringify(seedDoc()));
  redis.set(VERSION_KEY, '1');

  await applyOutcome({ userId: 'you', outcome: 'disengaged', practice: false });

  const stored = JSON.parse(redis.get(DB_KEY));
  assert.equal(stored.users.you.xp, 100, 'the XP award must be persisted to Redis');
  assert.equal(stored.drills.length, 1, 'the drill record must be persisted to Redis');
  assert.equal(redis.get(VERSION_KEY), '2', 'a successful write bumps the version');
});

test('an empty Redis seeds from data.seed.json instead of erroring', async () => {
  const user = await getUser('you');
  assert.ok(user, 'the seed document should be readable when Redis is empty');
  assert.equal(redis.size, 0, 'a pure read must not write anything');
});

// The regression that matters: with the naive get/set this test loses the competing
// writer's user entirely, because the stale in-memory document is written back wholesale.
test('a write that loses the race is replayed against the fresh document', async () => {
  redis.set(DB_KEY, JSON.stringify(seedDoc()));
  redis.set(VERSION_KEY, '1');

  // Another instance commits between our read and our write — once.
  beforeEval = (n) => {
    if (n !== 0) return;
    const doc = JSON.parse(redis.get(DB_KEY));
    doc.users.mum = { id: 'mum', name: 'MUM', xp: 42, xpMax: 500, level: 1, streak: 0, timesSafe: 0, timesScammed: 0 };
    redis.set(DB_KEY, JSON.stringify(doc));
    redis.set(VERSION_KEY, '2');
  };

  await applyOutcome({ userId: 'you', outcome: 'disengaged', practice: false });

  const stored = JSON.parse(redis.get(DB_KEY));
  assert.ok(stored.users.mum, 'the competing writer\'s user must survive');
  assert.equal(stored.users.mum.xp, 42, 'and must not be rolled back to an older value');
  assert.equal(stored.users.you.xp, 100, 'our own change must still be applied');
  assert.equal(stored.drills.length, 1, 'the drill must be recorded exactly once, not twice');
  assert.equal(evalCount, 2, 'the first write should fail the CAS and be retried');
});

test('gives up rather than spinning forever when it can never win', async () => {
  redis.set(DB_KEY, JSON.stringify(seedDoc()));
  redis.set(VERSION_KEY, '1');

  // A writer that always commits first, so our CAS can never match.
  beforeEval = () => redis.set(VERSION_KEY, String(Number(redis.get(VERSION_KEY)) + 1));

  await assert.rejects(
    () => applyOutcome({ userId: 'you', outcome: 'disengaged', practice: false }),
    /too many concurrent writers/,
  );
});
