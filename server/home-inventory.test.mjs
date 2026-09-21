import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanHomeInventory } from './home-inventory.js';

const VALID = {
  coins: { usr_1: 120 },
  soldItems: ['grandma-chair'],
  purchasedItems: { usr_1: ['shop-rug', 'shop-chandelier'] },
  roomLayouts: { usr_1: { 'shop-rug': { x: 0, y: 100 }, 'shop-chandelier': { x: 30, y: 0 } } },
};

test('cleanHomeInventory keeps a well-formed record as-is', () => {
  assert.deepEqual(cleanHomeInventory(VALID), VALID);
});

test('cleanHomeInventory floors fractional coins and drops duplicate ids', () => {
  const cleaned = cleanHomeInventory({
    ...VALID,
    coins: { usr_1: 42.9 },
    soldItems: ['grandma-chair', 'grandma-chair'],
  });
  assert.equal(cleaned.coins.usr_1, 42);
  assert.deepEqual(cleaned.soldItems, ['grandma-chair']);
});

test('cleanHomeInventory rejects the wrong shape', () => {
  assert.equal(cleanHomeInventory(null), null);
  assert.equal(cleanHomeInventory([]), null);
  assert.equal(cleanHomeInventory({ ...VALID, coins: { usr_1: -5 } }), null);
  assert.equal(cleanHomeInventory({ ...VALID, coins: { usr_1: 'lots' } }), null);
  assert.equal(cleanHomeInventory({ ...VALID, soldItems: [123] }), null);
  assert.equal(cleanHomeInventory({ ...VALID, purchasedItems: { usr_1: 'shop-rug' } }), null);
});

test('cleanHomeInventory rejects an out-of-bounds or malformed position', () => {
  assert.equal(cleanHomeInventory({
    ...VALID, roomLayouts: { usr_1: { 'shop-rug': { x: 101, y: 0 } } },
  }), null);
  assert.equal(cleanHomeInventory({
    ...VALID, roomLayouts: { usr_1: { 'shop-rug': { x: -1, y: 0 } } },
  }), null);
  assert.equal(cleanHomeInventory({
    ...VALID, roomLayouts: { usr_1: { 'shop-rug': { x: 'left', y: 0 } } },
  }), null);
});

test('cleanHomeInventory rejects an oversized record', () => {
  const many = { usr_1: Array.from({ length: 500 }, (_, i) => `shop-item-${i}`) };
  assert.equal(cleanHomeInventory({ ...VALID, purchasedItems: many }), null);
});

test('cleanHomeInventory rejects __proto__/constructor/prototype rather than swallowing them', () => {
  // `{ __proto__: 5 }` as an object LITERAL sets the prototype instead of creating an
  // own property (so it would look empty and prove nothing) — a real request body has
  // no such special-casing, so build these with JSON.parse the way Express actually
  // would from the wire, to get a genuine own, enumerable "__proto__" string key.
  const withProtoCoin = JSON.parse('{"coins":{"__proto__":5},"soldItems":[],"purchasedItems":{},"roomLayouts":{}}');
  assert.ok(Object.hasOwn(withProtoCoin.coins, '__proto__'), 'test setup must produce an own property');
  assert.equal(cleanHomeInventory(withProtoCoin), null);

  const withProtoItem = JSON.parse('{"coins":{},"soldItems":[],"purchasedItems":{"usr_1":["__proto__"]},"roomLayouts":{}}');
  assert.equal(cleanHomeInventory(withProtoItem), null);

  const withConstructorMember = JSON.parse('{"coins":{},"soldItems":[],"purchasedItems":{"constructor":["shop-rug"]},"roomLayouts":{}}');
  assert.ok(Object.hasOwn(withConstructorMember.purchasedItems, 'constructor'));
  assert.equal(cleanHomeInventory(withConstructorMember), null);

  const withPrototypeMember = JSON.parse('{"coins":{},"soldItems":[],"purchasedItems":{},"roomLayouts":{"prototype":{"shop-rug":{"x":0,"y":0}}}}');
  assert.equal(cleanHomeInventory(withPrototypeMember), null);
});
