import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const { code } = transformSync(readFileSync(new URL('../src/app/types/roomStyle.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' });
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

test('the server room-style allowlist matches every option the client offers', async () => {
  const { ROOM_STYLE_OPTIONS, ROOM_LIGHTING_OPTIONS, cleanRoomStyle } = await import('./room-style.js');
  const client = withStorage();
  const ids = (list) => list.map((option) => option.id);
  assert.deepEqual(ROOM_STYLE_OPTIONS, {
    wall: ids(client.WALL_COLORS), pattern: ids(client.WALL_PATTERNS),
    floor: ids(client.FLOORS), light: ids(client.ROOM_LIGHTS),
  });
  assert.deepEqual(ROOM_LIGHTING_OPTIONS, ids(client.ROOM_LIGHTING));
  // Whatever the client normalises and sends is accepted unchanged.
  for (const preset of client.ROOM_PRESETS) {
    const style = client.normalizeRoomStyle({ ...preset.style, name: ' My room ' });
    assert.deepEqual(cleanRoomStyle(style), style);
  }
  assert.equal(cleanRoomStyle({ ...client.DEFAULT_ROOM_STYLE, floor: 'lava' }), null);
  assert.equal(cleanRoomStyle({ ...client.DEFAULT_ROOM_STYLE, glow: 'yes' }), null);
  assert.equal(cleanRoomStyle([]), null);
});

test('day and night rooms: lighting is optional for the server and Auto follows the viewer', async () => {
  const { cleanRoomStyle } = await import('./room-style.js');
  const client = withStorage();
  const { DEFAULT_ROOM_STYLE: base, ROOM_LIGHTING_MODE, normalizeRoomStyle: normalize, roomTime, roomColors: colors } = client;
  // Styles saved before day rooms (no lighting) are still accepted, unchanged, and read as Auto.
  const { lighting: _none, ...legacy } = base;
  assert.deepEqual(cleanRoomStyle(legacy), legacy);
  assert.equal(normalize(legacy).lighting, 'auto');
  for (const lighting of ['auto', 'day', 'night']) {
    assert.deepEqual(cleanRoomStyle({ ...base, lighting }), { ...base, lighting });
    assert.equal(normalize({ lighting }).lighting, lighting);
  }
  assert.equal(cleanRoomStyle({ ...base, lighting: 'dusk' }), null);
  assert.equal(normalize({ lighting: 'dusk' }).lighting, 'auto');

  if (ROOM_LIGHTING_MODE === 'choice') {
    assert.equal(roomTime({ lighting: 'auto' }, 'light'), 'day');
    assert.equal(roomTime({ lighting: 'auto' }, 'dark'), 'night');
    assert.equal(roomTime({ lighting: 'night' }, 'light'), 'night');
    assert.equal(roomTime({ lighting: 'day' }, 'dark'), 'day');
  }
  // Night colours are unchanged; every named wall and floor has its own day twin.
  assert.deepEqual(colors({ ...base, wall: 'violet', floor: 'oak' }, '#100c20', '#c77dff'), { wall: '#211733', floor: '#3c2d32', light: '#c77dff' });
  assert.deepEqual(colors({ ...base, wall: 'violet', floor: 'oak' }, '#100c20', '#c77dff', 'day'), { wall: '#ebe3f6', floor: '#c9a47e', light: '#c77dff' });
  for (const option of [...client.WALL_COLORS, ...client.FLOORS]) {
    if (option.color) assert.match(option.day, /^#[0-9a-f]{6}$/, option.id);
  }
  // "Match avatar" in daylight is a pale tint of the member's colour.
  assert.equal(colors(base, '#100c20', '#c77dff', 'day').wall, 'color-mix(in srgb, #c77dff 14%, #f7f9fc)');
});
