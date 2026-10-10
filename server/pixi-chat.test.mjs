// Run with: node --test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';
import { pixiShouldConsider, parsePixiReply } from './pixi-writer.js';

process.env.IDENTITY_LOOKUP_SECRET = 'pixi-chat-test-identity-lookup-secret-over-32';
await setupTestDb();
after(teardownTestDb);

const { registerVerifiedUser } = await import('./store.js');
const houses = await import('./houses.js');
const { sendMessage } = await import('./chat.js');
const { replyAsPixi } = await import('./pixi-chat.js');
const { query } = await import('./db.js');

let phoneSeq = 0;
async function player(name) {
  phoneSeq += 1;
  return registerVerifiedUser({ phone: `+659400${String(phoneSeq).padStart(4, '0')}`, name });
}
let keySeq = 0;
const say = async (user, houseId, text) => {
  keySeq += 1;
  const clientKey = `00000000-0000-4000-8000-${String(keySeq).padStart(12, '0')}`;
  return (await sendMessage(user.id, houseId, { text, clientKey })).message;
};

async function family() {
  await resetDb();
  const dad = await player('Huat');
  const mei = await player('Mei');
  await houses.createHouse(dad.id, 'The Tans');
  const code = (await houses.getHouseView(dad.id)).house.inviteCode;
  await houses.joinHouse(mei.id, code);
  const { house } = await houses.getHouseView(dad.id);
  return { dad, mei, houseId: house.id };
}

const line = (id, type, text, minutesAgo, now) => ({
  id, type, text, senderId: null, from: 'X', createdAt: new Date(now - minutesAgo * 60_000).toISOString(),
});

test('every member message is offered to Pixi, flagged by how directly it is addressed', () => {
  const now = Date.now();
  const mention = line('3', 'message', 'hey Pixi, is this a scam?', 0, now);
  assert.deepEqual(pixiShouldConsider(mention, [mention], now), { consider: true, mentioned: true, engaged: false });

  const answer = line('3', 'message', 'it was the sender address', 0, now);
  const asked = [line('2', 'pixi_message', 'Dad, what gave it away?', 2, now), answer];
  assert.deepEqual(pixiShouldConsider(answer, asked, now), { consider: true, mentioned: false, engaged: true });

  const stale = [line('2', 'pixi_message', 'old', 120, now), answer];
  assert.equal(pixiShouldConsider(answer, stale, now).engaged, false);
  const hi = line('3', 'message', 'hi', 0, now);
  assert.deepEqual(pixiShouldConsider(hi, [hi], now), { consider: true, mentioned: false, engaged: false });
  // "pixies" is not Pixi, and Pixi never answers its own lines.
  assert.equal(pixiShouldConsider(line('3', 'message', 'pixies!', 0, now), [], now).mentioned, false);
  assert.equal(pixiShouldConsider(line('3', 'pixi_message', 'hi', 0, now), [], now).consider, false);
});

test('a reply is posted only when the model chooses to, and only as clean text', () => {
  assert.equal(parsePixiReply({ reply: true, text: 'Good spot, Dad! 👀' }), 'Good spot, Dad! 👀');
  assert.equal(parsePixiReply({ reply: false, text: 'ignored' }), null);
  assert.equal(parsePixiReply({ reply: true, text: '' }), null);
  assert.equal(parsePixiReply({ reply: true, text: 'see www.example.com' }), null);
});

test('Pixi answers a message that names it, once, with the house as context', async () => {
  const { dad, mei, houseId } = await family();
  await say(mei, houseId, 'dinner at 7');
  const asked = await say(dad, houseId, 'Pixi, how do I spot a fake bank SMS?');
  let seen;
  const writeReply = async (context, latest, flags) => {
    seen = { context, latest, flags };
    return 'Look for urgency and links, Dad. Open your bank app yourself instead 📱';
  };

  const result = await replyAsPixi(dad.id, houseId, asked.id, { writeReply });
  assert.equal(result.message.type, 'pixi_message');
  assert.equal(result.message.senderName, 'PIXI');
  assert.equal(seen.flags.mentioned, true);
  assert.equal(seen.latest.text, 'Pixi, how do I spot a fake bank SMS?');
  assert.deepEqual(seen.context.members.map((m) => m.name).sort(), ['HUAT', 'MEI']);
  assert.ok(seen.context.recentChat.some((m) => m.text === 'dinner at 7'));

  // Asking again for the same message posts nothing new.
  const again = await replyAsPixi(dad.id, houseId, asked.id, { writeReply });
  assert.equal(again.message, null);
  const { rows } = await query(`select count(*)::int as n from safespace.chat_messages where type = 'pixi_message'`);
  assert.equal(rows[0].n, 1);

  // A plain "hi" reaches the model too, flagged as following Pixi's own post.
  const hi = await say(dad, houseId, 'hi');
  let flags;
  const greeted = await replyAsPixi(dad.id, houseId, hi.id, {
    writeReply: async (_context, _latest, f) => { flags = f; return 'Hi Dad! How was your day? 😊'; },
  });
  assert.equal(greeted.message.text, 'Hi Dad! How was your day? 😊');
  assert.deepEqual(flags, { consider: true, mentioned: false, engaged: true });
});

test('Pixi stays quiet when the model says so, and ignores old messages, other senders and other houses', async () => {
  const { dad, mei, houseId } = await family();
  let calls = 0;
  const writeReply = async () => { calls += 1; return 'hi'; };

  // The model choosing silence posts nothing.
  const chatter = await say(dad, houseId, 'see you later');
  assert.equal((await replyAsPixi(dad.id, houseId, chatter.id, { writeReply: async () => null })).message, null);

  const old = await say(dad, houseId, 'pixi are you there?');
  await say(mei, houseId, 'newer message');
  assert.equal((await replyAsPixi(dad.id, houseId, old.id, { writeReply })).message, null);

  const meis = await say(mei, houseId, 'pixi hello');
  assert.equal((await replyAsPixi(dad.id, houseId, meis.id, { writeReply })).message, null);
  assert.equal(calls, 0);

  const outsider = await player('Stranger');
  await assert.rejects(
    replyAsPixi(outsider.id, houseId, meis.id, { writeReply }),
    (error) => error.code === 'CHAT_ACCESS_DENIED',
  );
  await assert.rejects(replyAsPixi(mei.id, houseId, 'abc', { writeReply }), (error) => error.code === 'INVALID_MESSAGE');
});

test('Pixi finds the newest message once ids pass a digit boundary', async () => {
  const { dad, houseId } = await family();
  // Start the ids at 95 so the chat holds both two- and three-digit ids.
  await query(`select setval(pg_get_serial_sequence('safespace.chat_messages', 'id'), 94)`);
  for (let i = 0; i < 8; i += 1) await say(dad, houseId, `msg ${i}`);
  const hi = await say(dad, houseId, 'hi');
  assert.ok(Number(hi.id) >= 100);
  const result = await replyAsPixi(dad.id, houseId, hi.id, { writeReply: async () => 'Hi Dad!' });
  assert.equal(result.message?.text, 'Hi Dad!');
});
