import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setupTestDb, resetDb, teardownTestDb } from './testdb.mjs';

process.env.IDENTITY_LOOKUP_SECRET = 'chat-test-identity-secret-at-least-32-characters';
await setupTestDb();
after(teardownTestDb);

const { registerVerifiedUser } = await import('./store.js');
const houses = await import('./houses.js');
const chat = await import('./chat.js');
const { query, transaction } = await import('./db.js');

const rejectsChat = (fn, code) => assert.rejects(fn, (error) => error?.code === code);

async function fixture() {
  await resetDb();
  const owner = await registerVerifiedUser({ phone: '+6593330001', name: 'Alice' });
  const other = await registerVerifiedUser({ phone: '+6593330002', name: 'Bob' });
  const { houseId } = await houses.createHouse(owner.id, 'Chat Test');
  const code = (await houses.getHouseView(owner.id)).house.inviteCode;
  return { owner, other, houseId, code };
}

test('new members read messages sent before they joined', async () => {
  const { owner, other, houseId, code } = await fixture();
  const sent = await chat.sendMessage(owner.id, houseId, {
    text: 'Hello Bob',
    clientKey: randomUUID(),
  });
  await assert.rejects(() => chat.listMessages(other.id, houseId), { code: 'CHAT_ACCESS_DENIED' });
  await houses.joinHouse(other.id, code);
  assert.equal((await chat.listMessages(other.id, houseId)).messages[0].id, sent.message.id);
});

test('message text normalizes line endings and enforces the Unicode boundary', () => {
  assert.equal(chat.normalizeText('  hello\r\nworld\t  '), 'hello\nworld');
  assert.equal(chat.normalizeText('\u{1f600}'.repeat(1000)), '\u{1f600}'.repeat(1000));
  for (const invalid of [null, '', ' \n ', 'bad\u0000text', 'bad\rtext', '\ud800', '\udc00', 'x'.repeat(1001)]) {
    assert.throws(() => chat.normalizeText(invalid), { code: 'INVALID_MESSAGE' });
  }
});

test('cursors accept only one positive signed-bigint decimal string', () => {
  assert.deepEqual(chat.parseCursors({}), {});
  assert.deepEqual(chat.parseCursors({ before: '9223372036854775807' }), {
    before: '9223372036854775807',
  });
  assert.deepEqual(chat.parseCursors({ after: '12' }), { after: '12' });
  for (const cursors of [
    { before: '1', after: '2' }, { before: '0' }, { before: '01' }, { before: '-1' },
    { before: '9223372036854775808' }, { after: ['1', '2'] }, { after: 1 },
  ]) {
    assert.throws(() => chat.parseCursors(cursors), { code: 'INVALID_CURSOR' });
  }
});

test('sending normalizes the UUID and returns only server-derived message fields', async () => {
  const { owner, houseId } = await fixture();
  const now = new Date('2026-09-21T08:00:00.000Z');
  const clientKey = randomUUID().toUpperCase();
  const result = await chat.sendMessage(owner.id, houseId, {
    text: '  <b>Hello</b>\r\nthere  ',
    clientKey,
  }, { now });
  assert.equal(result.created, true);
  assert.match(result.topic, /^house-[0-9a-f]{32}$/);
  assert.deepEqual(result.message, {
    id: '1',
    houseId,
    senderId: owner.id,
    senderName: 'ALICE',
    senderAvatar: {
      color: '#4ecdc4', glow: '#00ff88', hat: 'None', eyes: 'Default', outfit: 'Standard',
    },
    text: '<b>Hello</b>\nthere',
    createdAt: now.toISOString(),
    clientKey: clientKey.toLowerCase(),
  });
});

test('sending rejects malformed keys and caller-supplied identity fields', async () => {
  const { owner, houseId } = await fixture();
  await rejectsChat(
    () => chat.sendMessage(owner.id, houseId, { text: 'hello', clientKey: 'not-a-uuid' }),
    'INVALID_MESSAGE',
  );
  await rejectsChat(
    () => chat.sendMessage(owner.id, houseId, {
      text: 'hello', clientKey: randomUUID(), senderId: 'someone-else',
    }),
    'INVALID_MESSAGE',
  );
});

test('concurrent retries create one row and preserve the original response', async () => {
  const { owner, houseId } = await fixture();
  const input = { text: 'One message', clientKey: randomUUID() };
  const replies = await Promise.all(
    Array.from({ length: 4 }, () => chat.sendMessage(owner.id, houseId, input)),
  );
  assert.equal(new Set(replies.map((reply) => reply.message.id)).size, 1);
  assert.equal(replies.filter((reply) => reply.created).length, 1);
  assert.equal((await chat.listMessages(owner.id, houseId)).messages.length, 1);
  await rejectsChat(
    () => chat.sendMessage(owner.id, houseId, { ...input, text: 'Changed' }),
    'MESSAGE_KEY_REUSED',
  );
});

test('exact retries do not consume quota and the rolling window reports its exact delay', async () => {
  const { owner, houseId } = await fixture();
  const started = new Date('2026-09-21T09:00:00.000Z');
  const firstInput = { text: 'Message 1', clientKey: randomUUID() };
  const first = await chat.sendMessage(owner.id, houseId, firstInput, { now: started });
  const retried = await chat.sendMessage(owner.id, houseId, firstInput, { now: started });
  assert.equal(retried.created, false);
  assert.deepEqual(retried.message, first.message);

  for (let i = 2; i <= 20; i += 1) {
    await chat.sendMessage(owner.id, houseId, {
      text: `Message ${i}`,
      clientKey: randomUUID(),
    }, { now: started });
  }
  const { rows: hits } = await query(
    "select count(*) as n from safespace.rate_limit_hits where scope = 'house_chat_send'",
  );
  assert.equal(Number(hits[0].n), 20);

  await assert.rejects(
    () => chat.sendMessage(owner.id, houseId, { text: 'Blocked', clientKey: randomUUID() }, {
      now: started,
    }),
    (error) => error?.code === 'CHAT_RATE_LIMITED' && error.retryAfterMs === 60_000,
  );
  await assert.rejects(
    () => chat.sendMessage(owner.id, houseId, { text: 'Still blocked', clientKey: randomUUID() }, {
      now: new Date(started.getTime() + 59_999),
    }),
    (error) => error?.code === 'CHAT_RATE_LIMITED' && error.retryAfterMs === 1,
  );
  const afterExpiry = await chat.sendMessage(owner.id, houseId, {
    text: 'Allowed again', clientKey: randomUUID(),
  }, { now: new Date(started.getTime() + 60_001) });
  assert.equal(afterExpiry.created, true);
});

test('latest, older and newer pages are ordered, disjoint and complete', async () => {
  const { owner, houseId } = await fixture();
  const started = new Date('2026-09-21T10:00:00.000Z').getTime();
  const sent = [];
  for (let i = 0; i < 125; i += 1) {
    sent.push((await chat.sendMessage(owner.id, houseId, {
      text: `Message ${i + 1}`,
      clientKey: randomUUID(),
    }, { now: new Date(started + i * 3_001) })).message);
  }

  const latest = await chat.listMessages(owner.id, houseId);
  assert.equal(latest.messages.length, 50);
  assert.equal(latest.hasMore, true);
  assert.deepEqual(latest.messages.map((message) => message.id), sent.slice(75).map((message) => message.id));

  const middle = await chat.listMessages(owner.id, houseId, { before: latest.messages[0].id });
  assert.equal(middle.messages.length, 50);
  assert.equal(middle.hasMore, true);
  assert.deepEqual(middle.messages.map((message) => message.id), sent.slice(25, 75).map((message) => message.id));

  const oldest = await chat.listMessages(owner.id, houseId, { before: middle.messages[0].id });
  assert.equal(oldest.messages.length, 25);
  assert.equal(oldest.hasMore, false);
  assert.deepEqual(oldest.messages.map((message) => message.id), sent.slice(0, 25).map((message) => message.id));

  const caughtUp = [sent[0].id];
  let cursor = sent[0].id;
  let hasMore = true;
  while (hasMore) {
    const page = await chat.listMessages(owner.id, houseId, { after: cursor });
    caughtUp.push(...page.messages.map((message) => message.id));
    cursor = page.messages.at(-1)?.id ?? cursor;
    hasMore = page.hasMore;
  }
  assert.deepEqual(caughtUp, sent.map((message) => message.id));
  assert.equal(new Set(caughtUp).size, 125);
});

test('message IDs define order when timestamps tie', async () => {
  const { owner, houseId } = await fixture();
  const now = new Date('2026-09-21T11:00:00.000Z');
  const sent = [];
  for (const text of ['First', 'Second', 'Third']) {
    sent.push((await chat.sendMessage(owner.id, houseId, {
      text, clientKey: randomUUID(),
    }, { now })).message);
  }
  const listed = await chat.listMessages(owner.id, houseId);
  assert.deepEqual(listed.messages.map((message) => message.id), sent.map((message) => message.id));
  assert.ok(listed.messages.every((message) => message.createdAt === now.toISOString()));
});

test('removed members cannot read or send while house history remains', async () => {
  const { owner, other, houseId, code } = await fixture();
  await houses.joinHouse(other.id, code);
  const saved = await chat.sendMessage(owner.id, houseId, {
    text: 'Still here', clientKey: randomUUID(),
  });
  await houses.removeMember(owner.id, other.id);
  await rejectsChat(() => chat.listMessages(other.id, houseId), 'CHAT_ACCESS_DENIED');
  await rejectsChat(
    () => chat.sendMessage(other.id, houseId, { text: 'No access', clientKey: randomUUID() }),
    'CHAT_ACCESS_DENIED',
  );
  assert.equal((await chat.listMessages(owner.id, houseId)).messages[0].id, saved.message.id);
});

test('a sender leaving preserves their name and avatar snapshot', async () => {
  const { owner, other, houseId, code } = await fixture();
  await houses.joinHouse(other.id, code);
  const sent = await chat.sendMessage(other.id, houseId, {
    text: 'Remember me', clientKey: randomUUID(),
  });
  await houses.removeMember(owner.id, other.id);
  const remembered = (await chat.listMessages(owner.id, houseId)).messages[0];
  assert.equal(remembered.id, sent.message.id);
  assert.equal(remembered.senderId, other.id);
  assert.equal(remembered.senderName, 'BOB');
  assert.deepEqual(remembered.senderAvatar, sent.message.senderAvatar);
});

test('switching houses invalidates the old expected-house route', async () => {
  const { owner, other, houseId, code } = await fixture();
  await houses.joinHouse(other.id, code);
  await houses.removeMember(owner.id, other.id);
  const next = await houses.createHouse(other.id, 'New House');
  assert.notEqual(next.houseId, houseId);
  await rejectsChat(() => chat.listMessages(other.id, houseId), 'CHAT_ACCESS_DENIED');
  await rejectsChat(
    () => chat.sendMessage(other.id, houseId, { text: 'Wrong house', clientKey: randomUUID() }),
    'CHAT_ACCESS_DENIED',
  );
});

test('the last member leaving cascades the house messages', async () => {
  const { owner, houseId } = await fixture();
  await chat.sendMessage(owner.id, houseId, { text: 'Temporary', clientKey: randomUUID() });
  await houses.leaveHouse(owner.id);
  const { rows } = await query(
    'select count(*) as n from safespace.chat_messages where house_id = $1',
    [houseId],
  );
  assert.equal(Number(rows[0].n), 0);
});

const pgOnly = process.env.TEST_DATABASE_URL ? undefined : 'requires real PostgreSQL connections';

test('send and removal serialize at the house lock in either arrival order', { skip: pgOnly }, async () => {
  for (const sendFirst of [true, false]) {
    const { owner, other, houseId, code } = await fixture();
    await houses.joinHouse(other.id, code);

    let markLocked;
    let releaseLock;
    const locked = new Promise((resolve) => { markLocked = resolve; });
    const release = new Promise((resolve) => { releaseLock = resolve; });
    const holder = transaction(async (tx) => {
      await tx.query('select id from safespace.houses where id = $1 for update', [houseId]);
      markLocked();
      await release;
    }, 'holdChatHouseLock');
    await locked;

    const completion = [];
    const send = chat.sendMessage(other.id, houseId, {
      text: `Racing ${sendFirst}`,
      clientKey: randomUUID(),
    }).then(
      (value) => { completion.push('send'); return value; },
      (error) => { completion.push('send'); throw error; },
    );
    const remove = houses.removeMember(owner.id, other.id).then(
      (value) => { completion.push('remove'); return value; },
      (error) => { completion.push('remove'); throw error; },
    );
    const pending = sendFirst ? [send, remove] : [remove, send];
    releaseLock();
    await holder;
    const results = await Promise.allSettled(pending);
    const [sendResult, removeResult] = sendFirst ? results : [results[1], results[0]];
    assert.equal(removeResult.status, 'fulfilled');

    const { rows } = await query(
      'select count(*) as n from safespace.chat_messages where house_id = $1 and sender_id = $2',
      [houseId, other.id],
    );
    if (sendResult.status === 'fulfilled') {
      assert.ok(completion.indexOf('send') < completion.indexOf('remove'));
      assert.equal(Number(rows[0].n), 1);
    } else {
      assert.equal(sendResult.reason?.code, 'CHAT_ACCESS_DENIED');
      assert.equal(Number(rows[0].n), 0);
    }
  }
});
