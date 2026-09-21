import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const { code } = transformSync(readFileSync(new URL('../src/app/room-style.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' });
function withStorage(storage) {
  const module = { exports: {} };
  // Inject browser storage lexically; never initialize Node's own localStorage.
  new Function('module', 'exports', 'localStorage', code)(module, module.exports, storage);
  return module.exports;
}
const { DEFAULT_ROOM_STYLE, ROOM_STYLE_KEY, WALL_PATTERNS, FLOORS, normalizeRoomStyle, roomColors } = withStorage();

test('legacy and corrupt styles fall back to the avatar-matched room without accepting arbitrary CSS', () => {
  assert.deepEqual(normalizeRoomStyle(null), DEFAULT_ROOM_STYLE);
  assert.deepEqual(normalizeRoomStyle({ wall: 'url(https://example.com)', pattern: [], floor: 'bogus', light: '#fff', glow: 'true' }), DEFAULT_ROOM_STYLE);
  assert.deepEqual(roomColors(DEFAULT_ROOM_STYLE, '#081420', '#4ecdc4'), { wall: '#081420', floor: '#081420', light: '#4ecdc4' });
  assert.equal(normalizeRoomStyle({ name: ' \n My room \t' }).name, 'My room');
  assert.equal(normalizeRoomStyle({ name: 'x'.repeat(100) }).name.length, 32);
});

test('every wallpaper and floor option round-trips through normalizeRoomStyle', () => {
  for (const { id } of WALL_PATTERNS) {
    assert.equal(normalizeRoomStyle({ pattern: id }).pattern, id);
  }
  for (const { id } of FLOORS) {
    assert.equal(normalizeRoomStyle({ floor: id }).floor, id);
  }
  // The new options specifically, so this test still fails if any of them are removed.
  assert.deepEqual(WALL_PATTERNS.map(o => o.id).filter(id => ['brick', 'hex', 'circuit'].includes(id)),
    ['brick', 'hex', 'circuit']);
  assert.deepEqual(FLOORS.map(o => o.id).filter(id => ['concrete', 'neon', 'metal'].includes(id)),
    ['concrete', 'neon', 'metal']);
});

test('saving a room persists per-player choices without touching the furniture inventory', () => {
  const inventory = JSON.stringify({ coins: { alice: 400 }, purchasedItems: { alice: ['sofa'] }, roomLayouts: { alice: { sofa: { x: 80, y: 40 } } } });
  const values = new Map([['safespace_home_inventory_v1', inventory]]);
  const { loadRoomStyles, saveRoomStyles } = withStorage({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  const bob = { ...DEFAULT_ROOM_STYLE, wall: 'rose', name: 'Bob’s room' };
  const alice = { ...DEFAULT_ROOM_STYLE, wall: 'violet', pattern: 'stars', floor: 'tile', light: 'pink', glow: true, name: ' Night arcade ' };
  assert.equal(saveRoomStyles({ alice, bob }), true);
  const loaded = loadRoomStyles();
  assert.deepEqual(loaded.alice, { ...alice, name: 'Night arcade' });
  assert.deepEqual(loaded.bob, bob);
  assert.equal(values.get('safespace_home_inventory_v1'), inventory);
  assert.deepEqual(alice.name, ' Night arcade ');
  assert.ok(values.has(ROOM_STYLE_KEY));
});

test('invalid storage and storage failures do not crash or report a successful save', () => {
  let raw = '{broken';
  const { loadRoomStyles, saveRoomStyles } = withStorage({
    getItem: () => raw,
    setItem: () => { throw new Error('quota'); },
  });
  assert.deepEqual(loadRoomStyles(), {});
  raw = '[1,2]';
  assert.deepEqual(loadRoomStyles(), {});
  raw = JSON.stringify({ alice: { floor: 'missing', wall: 'lagoon' } });
  assert.deepEqual(loadRoomStyles().alice, { ...DEFAULT_ROOM_STYLE, wall: 'lagoon' });
  assert.equal(saveRoomStyles({ alice: DEFAULT_ROOM_STYLE }), false);
});
