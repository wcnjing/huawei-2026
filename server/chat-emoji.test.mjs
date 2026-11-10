// Run with: node --test
// The house chat's custom emoji codes (server/chat-emoji.js), what Pixi is told about them,
// and that the app's picker (src/app/screens/chat/chatEmoji.tsx) uses the same codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHAT_EMOJI, dropUnknownEmoji, emojiCodes, emojiGuide, headCode } from './chat-emoji.js';
import { buildPixiReplyInput, parsePixiReply } from './pixi-writer.js';

const MUM = '3f2a9c1b-0d4e-4f00-8a11-222233334444';
const AH_HUAT = 'A1B2C3D4-0000-4000-8000-000000000000';
const members = [{ id: MUM, name: 'MEI LING' }, { id: AH_HUAT, name: 'AH HUAT' }];

test('a head code is "head-" and the first 8 letters or digits of the id', () => {
  assert.equal(headCode(MUM), 'head-3f2a9c1b');
  assert.equal(headCode(AH_HUAT), 'head-a1b2c3d4');
  assert.equal(headCode('grandma'), 'head-grandma');
});

test('the house knows the fixed codes and one head per member', () => {
  const codes = emojiCodes(members);
  assert.ok(codes.has('shield') && codes.has('pixi') && codes.has('mascot'));
  assert.ok(codes.has('head-3f2a9c1b') && codes.has('head-a1b2c3d4'));
  assert.equal(codes.size, Object.keys(CHAT_EMOJI).length + 2);
});

test("Pixi's guide lists each code with what it shows, heads by what Pixi calls them", () => {
  const guide = emojiGuide(members, new Map([[MUM, 'Mum']]));
  assert.deepEqual(guide[0], { code: ':pixi:', shows: "Pixi's own face (you)" });
  assert.ok(guide.some((e) => e.code === ':shield:' && /shield/.test(e.shows)));
  assert.deepEqual(guide.slice(-2), [
    { code: ':head-3f2a9c1b:', shows: "Mum's head" },
    { code: ':head-a1b2c3d4:', shows: "AH HUAT's head" },
  ]);
});

test('made-up codes are taken out of a reply, real ones and times stay', () => {
  const codes = emojiCodes(members);
  assert.equal(dropUnknownEmoji('Nice one Mum :trophy:', codes), 'Nice one Mum :trophy:');
  assert.equal(dropUnknownEmoji('Love you all :heart:!', codes), 'Love you all!');
  assert.equal(dropUnknownEmoji('Go :head-3f2a9c1b: :sparkles: go', codes), 'Go :head-3f2a9c1b: go');
  assert.equal(dropUnknownEmoji('The call came at 10:30:45, hang up', codes), 'The call came at 10:30:45, hang up');
});

test('parsePixiReply drops unknown codes, and a reply that was only one is skipped', () => {
  const codes = emojiCodes(members);
  assert.equal(parsePixiReply({ reply: true, text: 'Well spotted :shield: :party:' }, codes), 'Well spotted :shield:');
  assert.equal(parsePixiReply({ reply: true, text: ':party:' }, codes), null);
  // Without codes (older callers) the text is left alone.
  assert.equal(parsePixiReply({ reply: true, text: 'Hi :party:' }), 'Hi :party:');
});

test("the reply input gives Pixi the house's emojis", () => {
  const latest = { id: '9', senderId: MUM, from: 'MEI LING', text: 'Pixi look :trophy:', type: 'message', createdAt: new Date().toISOString() };
  const input = buildPixiReplyInput({ members, tree: null, recentChat: [latest] }, latest, { mentioned: true });
  assert.ok(Array.isArray(input.customEmojis));
  assert.ok(input.customEmojis.some((e) => e.code === ':trophy:'));
  assert.ok(input.customEmojis.some((e) => e.code === ':head-3f2a9c1b:' && e.shows === "Mei Ling's head"));
});

test("the app's picker uses the same codes, in the same order, and the same head code", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = fs.readFileSync(path.join(here, '../src/app/screens/chat/chatEmoji.tsx'), 'utf8');
  const appCodes = [...source.matchAll(/\{ code: "([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual(appCodes, Object.keys(CHAT_EMOJI));
  assert.match(source, /`head-\$\{id\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9\]\/g, ""\)\.slice\(0, 8\)\}`/);
});
