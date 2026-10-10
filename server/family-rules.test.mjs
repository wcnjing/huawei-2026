import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFamilyEdit, cleanFamilyTree, emptyFamilyTree, familyLevels, familyProblem, familyTreeFromLinks,
} from './family-rules.js';

const ids = ['g', 'm', 'd', 'k', 'f'];
const add = (tree, relation, a, b) => applyFamilyEdit(tree, { kind: 'add', relation, a, b });

test('levels put children one below each parent and friends level with each other', () => {
  let tree = emptyFamilyTree();
  tree = add(tree, 'parent', 'g', 'm');
  tree = add(tree, 'partner', 'm', 'd');
  tree = add(tree, 'parent', 'm', 'k');
  tree = add(tree, 'friend', 'f', 'k');
  const level = familyLevels(tree, ids);
  assert.deepEqual(Object.fromEntries(level), { g: 0, m: 1, d: 1, k: 2, f: 2 });
  assert.equal(familyProblem(tree, ids), null);
  assert.equal(familyProblem(add(tree, 'friend', 'f', 'm'), ids), 'FAMILY_LEVEL_CONFLICT');
});

test('adding twice or removing what is not there changes nothing', () => {
  const once = add(emptyFamilyTree(), 'friend', 'a', 'b');
  assert.deepEqual(add(once, 'friend', 'b', 'a'), once);
  assert.deepEqual(applyFamilyEdit(once, { kind: 'remove', relation: 'partner', a: 'a', b: 'b' }), once);
});

test('old per-member records become one tree, skipping anything that no longer makes sense', () => {
  const tree = familyTreeFromLinks([
    { id: 'g', link: { gender: 'female', childIds: ['m'] } },
    { id: 'm', link: { gender: 'female', partnerId: 'd', childIds: ['k'] } },
    { id: 'd', link: { gender: 'male', partnerId: 'm' } },
    // the old app allowed a friend on any generation; that link is dropped
    { id: 'k', link: { gender: 'male', friendIds: ['g'] } },
    { id: 'f', link: null },
  ]);
  assert.deepEqual(tree.parents, [['g', 'm'], ['m', 'k']]);
  assert.deepEqual(tree.partners, [['d', 'm']]);
  assert.deepEqual(tree.friends, []);
  assert.equal(familyProblem(tree, ids), null);
});

test('stored trees are limited to current members and to valid shapes', () => {
  const tree = cleanFamilyTree({
    genders: { m: 'female', gone: 'male', k: 'robot' },
    parents: [['m', 'k'], ['m', 'k'], ['gone', 'k'], ['k', 'k'], 'junk'],
    partners: [['m', 'd'], ['d', 'm']],
    friends: [['k', 'f']],
  }, new Set(ids));
  assert.deepEqual(tree, { genders: { m: 'female' }, parents: [['m', 'k']], partners: [['d', 'm']], friends: [['f', 'k']] });
});
