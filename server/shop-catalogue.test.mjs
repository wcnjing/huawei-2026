import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
const { code } = transformSync(readFileSync(new URL('../src/app/data/shopCatalogue.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'esm' });
const { SHOP_CATALOGUE, SHOP_CATEGORIES, filterShopItems } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('approved catalogue preserves existing purchases and serves all approved art', () => {
  assert.equal(SHOP_CATALOGUE.length, 44);
  assert.equal(new Set(SHOP_CATALOGUE.map(item => item.id)).size, 44);
  const prices = { sofa: 250, lamp: 225, plant: 230, tv: 280, rug: 260, bookshelf: 290, bed: 320, window: 400 };
  for (const [id, price] of Object.entries(prices)) assert.equal(SHOP_CATALOGUE.find(item => item.id === `shop-${id}`).cost, price);
  for (const item of SHOP_CATALOGUE) {
    assert.ok(Number.isInteger(item.cost) && item.cost > 0);
    assert.equal(readFileSync(new URL(`../public/furniture/${item.art}.svg`, import.meta.url), 'utf8'),
      readFileSync(new URL(`../design/furniture-drafts/${item.art}.svg`, import.meta.url), 'utf8'));
  }
  assert.deepEqual(SHOP_CATEGORIES.map(c => [c.id, filterShopItems(c.id, 'all', 'ALL', [], 0).length]),
    [['basic',7],['lights',5],['decor',14],['storage',4],['tech',6],['sports',8]]);
});

test('Decor subfilters combine with availability and do not leak into other categories', () => {
  const ids = (...args) => filterShopItems(...args).map(item => item.id);
  assert.deepEqual(ids('decor','carpets','ALL',[],0), ['shop-rug','shop-orbit-carpet','shop-zigzag-rug','shop-circle-mat']);
  assert.deepEqual(ids('decor','plants','OWNED',['shop-cactus','shop-rug'],100), ['shop-cactus']);
  assert.deepEqual(ids('decor','plants','AFFORDABLE',['shop-cactus'],232), ['shop-plant']);
  assert.deepEqual(ids('decor','openings','AFFORDABLE',[],310), ['shop-door']);
  assert.equal(ids('sports','plants','ALL',[],0).length,8);
  assert.equal(ids('all','plants','ALL',[],0).length,44);
});
