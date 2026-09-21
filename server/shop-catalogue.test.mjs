import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const { code } = transformSync(readFileSync(new URL('../src/app/data/shopCatalogue.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' });
const { SHOP_CATALOGUE, SHOP_CATEGORIES, filterShopItems } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('approved catalogue preserves existing purchases and prices and serves all approved art', () => {
  assert.equal(SHOP_CATALOGUE.length, 24);
  assert.equal(new Set(SHOP_CATALOGUE.map(item => item.id)).size, 24);
  const old = { sofa: 50, lamp: 25, plant: 30, tv: 80, rug: 60, bookshelf: 90, bed: 120, window: 200 };
  for (const [id, price] of Object.entries(old)) assert.equal(SHOP_CATALOGUE.find(item => item.id === `shop-${id}`).cost, price);
  for (const item of SHOP_CATALOGUE) {
    assert.ok(Number.isInteger(item.cost) && item.cost > 0);
    assert.equal(readFileSync(new URL(`../public/furniture/${item.art}.svg`, import.meta.url), 'utf8'),
      readFileSync(new URL(`../design/furniture-drafts/${item.art}.svg`, import.meta.url), 'utf8'));
  }
  assert.deepEqual(SHOP_CATEGORIES.map(c => [c.id, filterShopItems(c.id, 'all', 'ALL', [], 0).length]),
    [['basic',4],['lights',3],['decor',8],['storage',2],['tech',3],['sports',4]]);
});

test('Decor subfilters combine with availability and do not leak into other categories', () => {
  const ids = (...args) => filterShopItems(...args).map(item => item.id);
  assert.deepEqual(ids('decor','carpets','ALL',[],0), ['shop-rug','shop-orbit-carpet']);
  assert.deepEqual(ids('decor','plants','OWNED',['shop-cactus','shop-rug'],100), ['shop-cactus']);
  assert.deepEqual(ids('decor','plants','AFFORDABLE',['shop-cactus'],40), ['shop-plant']);
  assert.deepEqual(ids('decor','openings','AFFORDABLE',[],100), ['shop-door']);
  assert.equal(ids('sports','plants','ALL',[],0).length,4);
  assert.equal(ids('all','plants','ALL',[],0).length,24);
});
