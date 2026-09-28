// Run with: node --test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, setupTestDb, teardownTestDb } from './testdb.mjs';

process.env.IDENTITY_LOOKUP_SECRET = 'dev-login-test-identity-lookup-secret-32chars';
await setupTestDb();
after(teardownTestDb);

const { devLogin, devLoginEnabled, isLocalRequest, DEV_USER_ID } = await import('./dev-login.js');
const { getUserIdByToken } = await import('./store.js');
const houses = await import('./houses.js');

const req = ({ address = '127.0.0.1', host = 'localhost:3000', headers = {} } = {}) => ({
  socket: { remoteAddress: address },
  get: (name) => ({ host, ...headers })[name.toLowerCase()],
});

test('dev login is off in production and on Vercel', () => {
  assert.equal(devLoginEnabled({ NODE_ENV: 'development' }), true);
  assert.equal(devLoginEnabled({}), true);
  assert.equal(devLoginEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(devLoginEnabled({ VERCEL: '1' }), false);
  assert.equal(devLoginEnabled({ DISABLE_DEV_LOGIN: 'true' }), false);
});

test('only direct localhost requests are accepted', () => {
  assert.equal(isLocalRequest(req()), true);
  assert.equal(isLocalRequest(req({ address: '::1', host: '127.0.0.1:5173' })), true);
  assert.equal(isLocalRequest(req({ address: '10.0.0.4' })), false);
  assert.equal(isLocalRequest(req({ host: 'safespace.example.com' })), false);
  // nginx on the same box connects from loopback but forwards the caller.
  assert.equal(isLocalRequest(req({ headers: { 'x-forwarded-for': '203.0.113.9' } })), false);
  assert.equal(isLocalRequest(req({ headers: { 'x-real-ip': '203.0.113.9' } })), false);
});

test('dev login signs in the dev player with a ready-made house, idempotently', async () => {
  await resetDb();
  const first = await devLogin();
  assert.equal(first.userId, DEV_USER_ID);
  assert.equal(await getUserIdByToken(first.token), DEV_USER_ID);
  const second = await devLogin();
  assert.notEqual(second.token, first.token);
  const view = await houses.getHouseView(DEV_USER_ID);
  assert.equal(view.house.name, 'DEV HOUSE');
  assert.equal(view.house.ownerId, DEV_USER_ID);
  assert.deepEqual(view.house.members.map((m) => m.id), [DEV_USER_ID, 'dev_grandma', 'dev_mum', 'dev_dad']);
  const mum = view.house.members.find((m) => m.id === 'dev_mum');
  assert.deepEqual(mum.family.parentIds, ['dev_grandma']);
  // The dev player can place themself on the tree like anyone else.
  await houses.setFamilyLink(DEV_USER_ID, { gender: 'male', parentIds: ['dev_mum', 'dev_dad'] });
});

test('dev login puts a dev player who left back into the dev house', async () => {
  await resetDb();
  await devLogin();
  await houses.leaveHouse(DEV_USER_ID);
  await devLogin();
  const view = await houses.getHouseView(DEV_USER_ID);
  assert.equal(view.house?.name, 'DEV HOUSE');
});
