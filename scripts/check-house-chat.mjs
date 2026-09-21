import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playwrightPath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const chromeExecutable = process.env.CHROME_EXECUTABLE || undefined;
const artifactDir = path.resolve(root, process.env.CHAT_CHECK_ARTIFACTS
  || '.superpowers/sdd/2026-09-21-house-chat/task-4-artifacts');

process.env.PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;
delete process.env.ENABLE_DEMO_ROUTES;
delete process.env.ALLOW_DEV_VERIFY;
process.env.VITE_SUPABASE_URL = 'https://house-chat-fixture.invalid';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'test-only-fixture-key';

const [{ chromium }, { createServer }, { setupTestDb, teardownTestDb }] = await Promise.all([
  import(playwrightPath),
  import('vite'),
  import('../server/testdb.mjs'),
]);

let backend;
let vite;
let browser;

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.once('error', reject);
  });
}

function closeServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function seedPlayer(registerVerifiedUser, createSession, name, phone) {
  const user = await registerVerifiedUser({
    phone,
    name,
    avatar: { color: '#4ecdc4', glow: '#00ff88', hat: 'None', eyes: 'Default', outfit: 'Standard' },
  });
  return { user, token: await createSession(user.id) };
}

async function openChat(browserInstance, baseUrl, player, options = {}) {
  const viewport = options.viewport ?? { width: 390, height: 844 };
  const context = await browserInstance.newContext({ viewport });
  await context.addInitScript(({ token, name, largerText, reduceMotion }) => {
    localStorage.setItem('safespace_session_token', token);
    localStorage.setItem('safespace_profile', JSON.stringify({
      name,
      avatar: { color: '#4ecdc4', glow: '#00ff88', hat: 'None', eyes: 'Default', outfit: 'Standard' },
    }));
    localStorage.setItem('safespace_tutorial_seen', '1');
    if (largerText || reduceMotion) {
      localStorage.setItem('safespace_accessibility_v1', JSON.stringify({
        reduceMotion,
        largerText,
        highContrast: false,
        disableScanlines: true,
      }));
    }
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    globalThis.__HOUSE_CHAT_SCROLL_BEHAVIORS__ = [];
    HTMLElement.prototype.scrollTo = function scrollTo(...args) {
      if (this.classList?.contains('house-chat__history') && typeof args[0] === 'object') {
        globalThis.__HOUSE_CHAT_SCROLL_BEHAVIORS__.push(args[0].behavior);
      }
      return originalScrollTo.apply(this, args);
    };
  }, {
    token: player.token,
    name: player.user.name,
    largerText: options.largerText ?? false,
    reduceMotion: options.reduceMotion ?? false,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: options.osReducedMotion ? 'reduce' : 'no-preference' });
  await page.goto(baseUrl);
  await page.getByRole('button', { name: '[ PRESS START ]', exact: true }).click();
  await page.getByRole('button', { name: 'Open house chat' }).click();
  return { context, page };
}

async function sendWithButton(page, text) {
  await page.getByRole('textbox', { name: 'Message' }).fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
}

async function observeNoChatRequest(page, duration = 5_500) {
  try {
    await page.waitForEvent('request', {
      predicate: request => request.url().includes('/chat/messages'),
      timeout: duration,
    });
    assert.fail('chat requested while polling should be paused');
  } catch (error) {
    if (error?.name !== 'TimeoutError') throw error;
  }
}

try {
  await setupTestDb();
  const [{ app }, store, houses, database] = await Promise.all([
    import('../server/index.js'),
    import('../server/store.js'),
    import('../server/houses.js'),
    import('../server/db.js'),
  ]);
  const alicePlayer = await seedPlayer(store.registerVerifiedUser, store.createSession, 'Alice', '+6594000001');
  const bobPlayer = await seedPlayer(store.registerVerifiedUser, store.createSession, 'Bob', '+6594000002');
  const caraPlayer = await seedPlayer(store.registerVerifiedUser, store.createSession, 'Cara', '+6594000003');
  await houses.createHouse(alicePlayer.user.id, 'CHAT HOUSE');
  const aliceHouse = await houses.getHouseView(alicePlayer.user.id);
  await houses.joinHouse(bobPlayer.user.id, aliceHouse.house.inviteCode);

  backend = await listen(app);
  const backendUrl = `http://127.0.0.1:${backend.address().port}`;
  vite = await createServer({
    root,
    plugins: [{
      name: 'house-chat-realtime-fixture',
      enforce: 'pre',
      resolveId(id) {
        return id === '@supabase/supabase-js' ? '\0house-chat-realtime-fixture' : null;
      },
      load(id) {
        if (id !== '\0house-chat-realtime-fixture') return null;
        return `
          export function createClient() {
            return {
              channel(topic) {
                let changed = () => {};
                return {
                  on(_kind, _filter, callback) { changed = callback; return this; },
                  subscribe(callback) {
                    globalThis.__HOUSE_CHAT_REALTIME__ = {
                      topic,
                      changed: () => changed(),
                      reconnect: () => callback('SUBSCRIBED'),
                    };
                    queueMicrotask(() => callback('SUBSCRIBED'));
                    return this;
                  },
                };
              },
              removeChannel() {},
            };
          }
        `;
      },
    }],
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      proxy: { '/api': backendUrl },
    },
  });
  await vite.listen();
  const address = vite.httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true, executablePath: chromeExecutable });
  await fs.mkdir(artifactDir, { recursive: true });

  const alice = await openChat(browser, baseUrl, alicePlayer, {
    viewport: { width: 1280, height: 900 },
    reduceMotion: true,
  });
  const bob = await openChat(browser, baseUrl, bobPlayer);
  const runtimeErrors = [];
  const consoleErrors = [];
  const chatRequests = [];
  for (const player of [alice, bob]) {
    player.page.on('pageerror', error => runtimeErrors.push(error.message));
    player.page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    player.page.on('request', request => {
      if (request.url().includes('/chat/messages')) chatRequests.push(request.url());
    });
  }
  const inventoryBefore = await alice.page.evaluate(() => localStorage.getItem('safespace_home_inventory_v1'));
  const originalHouseId = aliceHouse.house.id;

  const message = `Hello from Alice ${Date.now()}`;
  await sendWithButton(alice.page, message);
  await bob.page.getByText(message, { exact: true }).waitFor({ timeout: 10_000 });

  const reply = `Reply from Bob ${Date.now()}`;
  await bob.page.getByRole('textbox', { name: 'Message' }).fill(reply);
  await bob.page.getByRole('textbox', { name: 'Message' }).press('Enter');
  await alice.page.getByText(reply, { exact: true }).waitFor({ timeout: 10_000 });

  const multiline = `First line ${Date.now()}`;
  const bobComposer = bob.page.getByRole('textbox', { name: 'Message' });
  await bobComposer.fill(multiline);
  await bobComposer.press('Shift+Enter');
  assert.equal(await bobComposer.inputValue(), `${multiline}\n`);
  await bobComposer.type('Second line');
  await bobComposer.press('Enter');
  await alice.page.getByText(`${multiline}\nSecond line`, { exact: true }).waitFor({ timeout: 10_000 });

  const composing = `Composing ${Date.now()}`;
  await bobComposer.fill(composing);
  await bobComposer.dispatchEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true });
  assert.equal(await bobComposer.inputValue(), composing);
  await bob.page.getByRole('button', { name: 'Send', exact: true }).click();
  await alice.page.getByText(composing, { exact: true }).waitFor({ timeout: 10_000 });

  const markup = `<img src=x onerror=alert(1)> ${Date.now()}`;
  await sendWithButton(alice.page, markup);
  await bob.page.getByText(markup, { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(await bob.page.locator('.house-chat__text img').count(), 0);

  await bob.page.reload();
  await bob.page.getByRole('button', { name: '[ PRESS START ]', exact: true }).click();
  await bob.page.getByRole('button', { name: 'Open house chat' }).click();
  await bob.page.getByText(message, { exact: true }).waitFor();

  await houses.joinHouse(caraPlayer.user.id, aliceHouse.house.inviteCode);
  const cara = await openChat(browser, baseUrl, caraPlayer, {
    viewport: { width: 320, height: 844 },
    largerText: true,
  });
  cara.page.on('pageerror', error => runtimeErrors.push(error.message));
  cara.page.on('console', consoleMessage => {
    if (consoleMessage.type() === 'error') consoleErrors.push(consoleMessage.text());
  });
  await cara.page.getByText(message, { exact: true }).waitFor({ timeout: 10_000 });
  assert.equal(await cara.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await cara.page.screenshot({ path: path.join(artifactDir, 'chat-320-large-text.png'), fullPage: true });

  let failNextPost = true;
  await alice.page.route('**/chat/messages', async route => {
    if (route.request().method() === 'POST' && failNextPost) {
      failNextPost = false;
      await route.abort('connectionfailed');
    } else {
      await route.continue();
    }
  });
  const retryText = `Retry succeeds ${Date.now()}`;
  await sendWithButton(alice.page, retryText);
  const retryButton = alice.page.getByRole('button', { name: 'Retry', exact: true });
  await retryButton.waitFor({ timeout: 10_000 });
  await retryButton.click();
  await bob.page.getByText(retryText, { exact: true }).waitFor({ timeout: 10_000 });
  await alice.page.unroute('**/chat/messages');

  const avatar = JSON.stringify({ color: '#4ecdc4', glow: '#00ff88', hat: 'None', eyes: 'Default', outfit: 'Standard' });
  const bulkBodies = Array.from({ length: 120 }, (_, index) => `Catch-up message ${String(index + 1).padStart(3, '0')}`);
  for (const body of bulkBodies) {
    await database.query(
      `insert into safespace.chat_messages
         (house_id, sender_id, sender_name, sender_avatar, client_key, body, created_at)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [originalHouseId, alicePlayer.user.id, 'Alice', avatar, crypto.randomUUID(), body, new Date().toISOString()],
    );
  }
  await alice.page.getByText(bulkBodies.at(-1), { exact: true }).waitFor({ timeout: 12_000 });
  const caughtUp = await alice.page.locator('.house-chat__text').allTextContents();
  const caughtUpBodies = caughtUp.filter(text => text.startsWith('Catch-up message '));
  assert.equal(caughtUpBodies.length, 120);
  assert.equal(new Set(caughtUpBodies).size, 120);

  await cara.page.reload();
  await cara.page.getByRole('button', { name: '[ PRESS START ]', exact: true }).click();
  await cara.page.getByRole('button', { name: 'Open house chat' }).click();
  const caraHistory = cara.page.getByRole('region', { name: 'Message history' });
  await cara.page.getByRole('button', { name: 'Load older messages', exact: true }).waitFor();
  const stableAnchor = await caraHistory.evaluate(element => {
    const historyBounds = element.getBoundingClientRect();
    const entries = [...element.querySelectorAll('.house-chat__entry')];
    const entry = entries.find(candidate => {
      const bounds = candidate.getBoundingClientRect();
      return bounds.bottom > historyBounds.top + 4 && bounds.top < historyBounds.bottom - 4;
    }) ?? entries[0];
    const text = entry?.querySelector('.house-chat__text')?.textContent;
    return text && entry ? { text, top: entry.getBoundingClientRect().top } : null;
  });
  assert.ok(stableAnchor);
  let releaseOlder;
  let markOlderRequested;
  const olderGate = new Promise(resolve => { releaseOlder = resolve; });
  const olderRequested = new Promise(resolve => { markOlderRequested = resolve; });
  await cara.page.route('**/chat/messages?before=*', async route => {
    markOlderRequested();
    await olderGate;
    await route.continue();
  }, { times: 1 });
  const loadOlderClick = cara.page.getByRole('button', { name: 'Load older messages', exact: true }).click();
  await olderRequested;
  const concurrentArrival = `Concurrent anchor arrival ${Date.now()}`;
  await database.query(
    `insert into safespace.chat_messages
       (house_id, sender_id, sender_name, sender_avatar, client_key, body, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [originalHouseId, bobPlayer.user.id, 'Bob', avatar, crypto.randomUUID(), concurrentArrival, new Date().toISOString()],
  );
  await cara.page.evaluate(() => globalThis.__HOUSE_CHAT_REALTIME__.changed());
  await cara.page.getByText(concurrentArrival, { exact: true }).waitFor({ timeout: 10_000 });
  releaseOlder();
  await loadOlderClick;
  await cara.page.getByText('Catch-up message 021', { exact: true }).waitFor({ timeout: 10_000 });
  const anchoredTop = await caraHistory.evaluate((element, text) => {
    const entry = [...element.querySelectorAll('.house-chat__entry')]
      .find(candidate => candidate.querySelector('.house-chat__text')?.textContent === text);
    return entry?.getBoundingClientRect().top ?? null;
  }, stableAnchor.text);
  assert.notEqual(anchoredTop, null);
  assert.ok(Math.abs(anchoredTop - stableAnchor.top) <= 2,
    `stable message moved ${Math.abs(anchoredTop - stableAnchor.top)}px during concurrent append and prepend`);
  await cara.page.unroute('**/chat/messages?before=*');

  const aliceHistory = alice.page.getByRole('region', { name: 'Message history' });
  let failPendingPost = true;
  await alice.page.route('**/chat/messages', async route => {
    if (route.request().method() === 'POST' && failPendingPost) {
      failPendingPost = false;
      await route.abort('connectionfailed');
    } else {
      await route.continue();
    }
  });
  const failedPending = `Failed pending ${Date.now()}`;
  await sendWithButton(alice.page, failedPending);
  await alice.page.getByRole('button', { name: 'Retry', exact: true }).waitFor({ timeout: 10_000 });
  await alice.page.evaluate(() => { globalThis.__HOUSE_CHAT_SCROLL_BEHAVIORS__ = []; });
  await aliceHistory.evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  const readingTop = await aliceHistory.evaluate(element => element.scrollTop);
  const whileReading = `Arrived while reading ${Date.now()}`;
  await database.query(
    `insert into safespace.chat_messages
       (house_id, sender_id, sender_name, sender_avatar, client_key, body, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [originalHouseId, bobPlayer.user.id, 'Bob', avatar, crypto.randomUUID(), whileReading, new Date().toISOString()],
  );
  await alice.page.getByText(whileReading, { exact: true }).waitFor({ timeout: 12_000 });
  assert.ok(Math.abs((await aliceHistory.evaluate(element => element.scrollTop)) - readingTop) <= 2);
  await alice.page.getByRole('button', { name: 'New messages', exact: true }).waitFor();
  const focusedOrder = await alice.page.locator('.house-chat__text').allTextContents();
  assert.ok(focusedOrder.indexOf(failedPending) < focusedOrder.indexOf(whileReading));

  await alice.page.getByRole('button', { name: 'New messages', exact: true }).click();
  await alice.page.waitForFunction(() => {
    const history = document.querySelector('.house-chat__history');
    return history && history.scrollHeight - history.scrollTop - history.clientHeight <= 2;
  });
  const nearBottomArrival = `Arrived near bottom ${Date.now()}`;
  await database.query(
    `insert into safespace.chat_messages
       (house_id, sender_id, sender_name, sender_avatar, client_key, body, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [originalHouseId, bobPlayer.user.id, 'Bob', avatar, crypto.randomUUID(), nearBottomArrival, new Date().toISOString()],
  );
  await alice.page.getByText(nearBottomArrival, { exact: true }).waitFor({ timeout: 12_000 });
  await alice.page.waitForFunction(() => {
    const history = document.querySelector('.house-chat__history');
    return history && history.scrollHeight - history.scrollTop - history.clientHeight <= 2;
  });
  assert.equal(await alice.page.getByRole('button', { name: 'New messages', exact: true }).count(), 0);
  const scrollBehaviors = await alice.page.evaluate(() => globalThis.__HOUSE_CHAT_SCROLL_BEHAVIORS__);
  assert.ok(scrollBehaviors.length >= 2);
  assert.deepEqual([...new Set(scrollBehaviors)], ['auto']);
  await alice.page.unroute('**/chat/messages');

  await Promise.all([
    alice.page.waitForRequest(request => request.url().includes('/chat/messages')),
    alice.page.evaluate(() => window.dispatchEvent(new Event('focus'))),
  ]);
  await Promise.all([
    alice.page.waitForRequest(request => request.url().includes('/chat/messages')),
    alice.page.evaluate(() => globalThis.__HOUSE_CHAT_REALTIME__.changed()),
  ]);
  await Promise.all([
    alice.page.waitForRequest(request => request.url().includes('/chat/messages')),
    alice.page.evaluate(() => globalThis.__HOUSE_CHAT_REALTIME__.reconnect()),
  ]);

  await alice.page.evaluate(() => {
    let visible = false;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible ? 'visible' : 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    globalThis.__showChatForCheck = () => {
      visible = true;
      document.dispatchEvent(new Event('visibilitychange'));
    };
  });
  await observeNoChatRequest(alice.page);
  const reopenedRequest = alice.page.waitForRequest(request => request.url().includes('/chat/messages'));
  await alice.page.evaluate(() => globalThis.__showChatForCheck());
  await reopenedRequest;

  await alice.page.getByRole('button', { name: 'Close house chat' }).click();
  await alice.page.getByRole('button', { name: 'Open house chat' }).waitFor();
  await observeNoChatRequest(alice.page);
  await alice.page.getByRole('button', { name: 'Open house chat' }).click();

  await houses.removeMember(alicePlayer.user.id, bobPlayer.user.id);
  await bob.page.getByRole('button', { name: 'Create or join a house', exact: true }).waitFor({ timeout: 12_000 });
  const requestMarker = chatRequests.length;
  await houses.createHouse(bobPlayer.user.id, 'BOB HOUSE');
  await bob.page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await bob.page.getByRole('textbox', { name: 'Message' }).waitFor({ timeout: 10_000 });
  const bobNewHouse = await houses.getHouseView(bobPlayer.user.id);
  const switched = `Bob new house ${Date.now()}`;
  await sendWithButton(bob.page, switched);
  await bob.page.getByText(switched, { exact: true }).waitFor({ timeout: 10_000 });
  const switchedRequests = chatRequests.slice(requestMarker);
  assert.ok(switchedRequests.some(url => url.includes(encodeURIComponent(bobNewHouse.house.id))));
  assert.equal(switchedRequests.some(url => url.includes(encodeURIComponent(originalHouseId))), false);

  const inventoryAfter = await alice.page.evaluate(() => localStorage.getItem('safespace_home_inventory_v1'));
  assert.equal(inventoryAfter, inventoryBefore);
  assert.equal(await alice.page.getByText('PIXI', { exact: true }).count(), 0);

  assert.equal(await alice.page.locator('body').evaluate(element => element.scrollWidth <= element.clientWidth), true);
  await alice.page.screenshot({ path: path.join(artifactDir, 'chat-desktop.png'), fullPage: true });
  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(consoleErrors.filter(message => !message.startsWith('Failed to load resource:')), []);
  console.log('house chat browser check passed');
} finally {
  await browser?.close();
  await vite?.close();
  await closeServer(backend);
  await teardownTestDb();
}
