import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

// Exercise the same placement logic shipped to the browser, without a DOM or providers.
const source = readFileSync(new URL('../src/app/room-layout.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'esm' });
const { furnitureLayer, snapPosition, reconcileLayout } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('new hanging furniture starts above floor decor while saved positions always win', () => {
  const layout = reconcileLayout(['shop-chandelier','shop-rug','shop-sofa'], undefined);
  assert.equal(layout['shop-chandelier'].y, 0);
  assert.equal(layout['shop-rug'].y, 100);
  assert.ok(furnitureLayer('shop-rug') < furnitureLayer('shop-sofa'));
  const saved = { 'shop-chandelier': { x: 30, y: 70 }, 'shop-rug': { x: 20, y: 30 } };
  assert.deepEqual(reconcileLayout(Object.keys(saved), saved), saved);
});

test('dragging beyond any room edge clamps the entire furniture item inside', () => {
  assert.deepEqual(snapPosition(-30, 130), { x: 0, y: 100 });
  assert.deepEqual(snapPosition(112, -2), { x: 100, y: 0 });
  assert.deepEqual(snapPosition(26, 74), { x: 30, y: 70 });
});

test('loading old inventory supplies positions; selling removes only that item', () => {
  const initial = reconcileLayout(['sofa', 'lamp'], undefined);
  assert.notDeepEqual(initial.sofa, initial.lamp);
  const moved = { ...initial, lamp: { x: 90, y: 20 } };
  const sold = reconcileLayout(['lamp'], moved);
  assert.deepEqual(sold, { lamp: { x: 90, y: 20 } });
  const rebought = reconcileLayout(['lamp', 'sofa'], sold);
  assert.deepEqual(rebought.lamp, { x: 90, y: 20 });
  assert.ok(rebought.sofa);
});

test('draft edits cannot mutate saved positions and layouts survive JSON storage', () => {
  const saved = { sofa: { x: 80, y: 40 } };
  const draft = reconcileLayout(['sofa'], saved);
  draft.sofa.x = 10;
  assert.deepEqual(saved.sofa, { x: 80, y: 40 });
  assert.deepEqual(reconcileLayout(['sofa'], JSON.parse(JSON.stringify(saved))), saved);
});

test('corrupt positions fall back safely and unowned item positions are discarded', () => {
  const layout = reconcileLayout(['sofa', 'lamp'], { sofa: { x: Infinity, y: null }, lamp: { x: 500, y: -50 }, ghost: { x: 0, y: 0 } });
  assert.equal(Object.keys(layout).length, 2);
  assert.ok(Number.isFinite(layout.sofa.x) && Number.isFinite(layout.sofa.y));
  assert.deepEqual(layout.lamp, { x: 100, y: 0 });
  assert.deepEqual(reconcileLayout([], null), {});
});
