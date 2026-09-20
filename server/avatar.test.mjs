import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanAvatar, DEFAULT_AVATAR } from './avatar.js';

test('cleanAvatar keeps exactly the five allowed keys', () => {
  const input = { color: '#ff6b35', glow: '#00ff88', hat: 'Crown', eyes: 'Shades', outfit: 'Camo', extra: 'x' };
  assert.deepEqual(cleanAvatar(input), {
    color: '#ff6b35', glow: '#00ff88', hat: 'Crown', eyes: 'Shades', outfit: 'Camo',
  });
});

test('cleanAvatar rejects anything outside the allowlist', () => {
  assert.equal(cleanAvatar(null), null);
  assert.equal(cleanAvatar([]), null);
  assert.equal(cleanAvatar('Crown'), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, color: '#000000' }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, hat: 'Tiara' }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, outfit: undefined }), null);
  assert.equal(cleanAvatar({ ...DEFAULT_AVATAR, eyes: '<script>' }), null);
});
