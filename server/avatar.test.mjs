import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAvatar, DEFAULT_AVATAR } from './avatar.js';

test('cleanAvatar keeps exactly the layered-character keys', () => {
  const input = { ...DEFAULT_AVATAR, color: '#ff6b35', hairStyle: 'cropped', accessories: ['round-glasses'], extra: 'x' };
  assert.deepEqual(cleanAvatar(input), {
    color: '#ff6b35', glow: '#00ff88', skinTone: 'peach', hairStyle: 'cropped',
    hairColor: 'midnight', outfit: 'blue-shirt-pants', accessories: ['round-glasses'],
  });
});

test('cleanAvatar preserves the retired mascot shape for old clients', () => {
  const legacy = { color: '#ff6b35', glow: '#00ff88', hat: 'Crown', eyes: 'Shades', outfit: 'Camo' };
  assert.deepEqual(cleanAvatar(legacy), legacy);
});

test('cleanAvatar rejects anything outside the allowlist', () => {
  assert.equal(cleanAvatar(null), null);
  assert.equal(cleanAvatar([]), null);
  assert.equal(cleanAvatar('Crown'), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, color: '#000000' }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, hairStyle: 'mohawk' }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, outfit: undefined }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, accessories: ['<script>'] }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, accessories: ['hair-bow', 'hair-bow'] }), null);
});
