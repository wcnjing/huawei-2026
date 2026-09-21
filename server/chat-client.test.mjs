import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSync } from 'esbuild';

const bundled = buildSync({
  entryPoints: ['src/app/state/chatState.ts', 'src/app/services/chatController.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  outdir: 'out',
});

async function importBundle(name) {
  const output = bundled.outputFiles.find(file => file.path.endsWith(`/${name}.js`));
  assert.ok(output, `missing bundled ${name}.js`);
  return import(`data:text/javascript;base64,${Buffer.from(output.contents).toString('base64')}`);
}

const { mergeMessages, normalizeDraft } = await importBundle('chatState');
const { createChatController } = await importBundle('chatController');

const avatar = {
  color: '#4ecdc4', glow: '#00ff88', hat: 'None', eyes: 'Default', outfit: 'Standard',
};

const message = (id, text = id, clientKey = id, senderId = 'u1') => ({
  id, text, clientKey, senderId, houseId: 'h1', senderName: senderId === 'u1' ? 'Alice' : 'Bob',
  senderAvatar: avatar, createdAt: '2026-09-21T00:00:00.000Z',
});

const page = (messages, hasMore = false) => ({ houseId: 'h1', messages, hasMore });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function flush() {
  return new Promise(resolve => setImmediate(resolve));
}

function fakeTransport({ get, post } = {}) {
  return {
    get: get ?? (async () => page([])),
    post: post ?? (async (_houseId, input) => ({ message: message('1', input.text, input.clientKey) })),
  };
}

function controller(transport, overrides = {}) {
  let uuid = 0;
  return createChatController({
    houseId: 'h1',
    selfId: 'u1',
    transport,
    onAccessDenied() {},
    uuid: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, '0')}`,
    now: () => 1_795_000_000_000,
    ...overrides,
  });
}

test('message state normalizes drafts and sorts bigint IDs without precision loss', () => {
  assert.equal(normalizeDraft('  hello\r\nworld  '), 'hello\nworld');
  assert.equal(normalizeDraft(' \t\n '), null);
  assert.equal(normalizeDraft(`ok\u0000`), null);
  assert.equal(normalizeDraft('\ud800'), null);
  assert.equal(normalizeDraft('x'.repeat(1001)), null);
  assert.equal(normalizeDraft('😀'.repeat(1000)), '😀'.repeat(1000));
  assert.deepEqual(
    mergeMessages(
      [message('9007199254740993')],
      [message('9007199254740992'), message('9007199254740993')],
    ).map(item => item.id),
    ['9007199254740992', '9007199254740993'],
  );
});

test('GET followed by POST completion produces one delivered bubble', async () => {
  const getResult = deferred();
  const postResult = deferred();
  const chat = controller(fakeTransport({
    get: () => getResult.promise,
    post: () => postResult.promise,
  }));

  assert.equal(chat.send('hello'), true);
  const refresh = chat.refresh();
  getResult.resolve(page([message('10', 'hello', '00000000-0000-4000-8000-000000000001')]));
  await refresh;
  assert.equal(chat.getSnapshot().pending.length, 0);
  postResult.resolve({ message: message('10', 'hello', '00000000-0000-4000-8000-000000000001') });
  await flush();

  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['10']);
  assert.equal(chat.getSnapshot().pending.length, 0);
});

test('POST followed by GET completion produces one delivered bubble', async () => {
  const getResult = deferred();
  const postResult = deferred();
  const chat = controller(fakeTransport({
    get: () => getResult.promise,
    post: () => postResult.promise,
  }));

  assert.equal(chat.send('hello'), true);
  const refresh = chat.refresh();
  postResult.resolve({ message: message('10', 'hello', '00000000-0000-4000-8000-000000000001') });
  await flush();
  getResult.resolve(page([message('10', 'hello', '00000000-0000-4000-8000-000000000001')]));
  await refresh;

  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['10']);
  assert.equal(chat.getSnapshot().pending.length, 0);
});

test('failed sends retry once with the original client key', async () => {
  const attempts = [];
  const retryResult = deferred();
  const transport = fakeTransport({
    post: (_houseId, input) => {
      attempts.push(input);
      return attempts.length === 1 ? Promise.reject(new Error('offline')) : retryResult.promise;
    },
  });
  const chat = controller(transport);

  chat.send(' hello ');
  await flush();
  const failed = chat.getSnapshot().pending[0];
  assert.equal(failed.status, 'failed');
  assert.equal(failed.text, 'hello');

  chat.retry(failed.clientKey);
  chat.retry(failed.clientKey);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1].clientKey, attempts[0].clientKey);
  assert.equal(chat.getSnapshot().pending[0].status, 'sending');

  retryResult.resolve({ message: message('1', 'hello', failed.clientKey) });
  await flush();
  assert.equal(chat.getSnapshot().pending.length, 0);
});

test('a POST response never advances the GET cursor past intervening messages', async () => {
  const cursors = [];
  let getCount = 0;
  const transport = fakeTransport({
    get: async (_houseId, cursor) => {
      cursors.push(cursor);
      getCount += 1;
      if (getCount === 1) return page([message('100')]);
      return page([message('101', 'other 1', 'k101', 'u2'), message('102', 'other 2', 'k102', 'u2'), message('103', 'mine', 'send-key')]);
    },
    post: async () => ({ message: message('103', 'mine', 'send-key') }),
  });
  const chat = controller(transport, { uuid: () => 'send-key' });

  await chat.refresh();
  chat.send('mine');
  await flush();
  await chat.refresh();

  assert.deepEqual(cursors, [{}, { after: '100' }]);
  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['100', '101', '102', '103']);
});

test('an empty initial history keeps requesting latest even after a POST succeeds', async () => {
  const cursors = [];
  const transport = fakeTransport({
    get: async (_houseId, cursor) => {
      cursors.push(cursor);
      return cursors.length === 1 ? page([]) : page([message('8'), message('9', 'mine', 'send-key')]);
    },
    post: async () => ({ message: message('9', 'mine', 'send-key') }),
  });
  const chat = controller(transport, { uuid: () => 'send-key' });

  await chat.refresh();
  chat.send('mine');
  await flush();
  await chat.refresh();

  assert.deepEqual(cursors, [{}, {}]);
  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['8', '9']);
});

test('refresh drains every forward page before becoming idle', async () => {
  const ids = Array.from({ length: 125 }, (_, index) => String(index + 2));
  const cursors = [];
  let initialized = false;
  const chat = controller(fakeTransport({
    get: async (_houseId, cursor) => {
      cursors.push(cursor);
      if (!initialized) {
        initialized = true;
        return page([message('1')]);
      }
      const start = cursor.after === '1' ? 0 : Number(cursor.after) - 1;
      const batch = ids.slice(start, start + 50).map(id => message(id));
      return page(batch, start + 50 < ids.length);
    },
  }));

  await chat.refresh();
  await chat.refresh();

  assert.equal(chat.getSnapshot().messages.length, 126);
  assert.deepEqual(cursors, [{}, { after: '1' }, { after: '51' }, { after: '101' }]);
  assert.equal(chat.getSnapshot().loading, false);
});

test('older-history failure preserves delivered messages and can be retried', async () => {
  let olderAttempts = 0;
  const chat = controller(fakeTransport({
    get: async (_houseId, cursor) => {
      if (!cursor.before) return page([message('51'), message('52')], true);
      olderAttempts += 1;
      if (olderAttempts === 1) throw new Error('offline');
      return page([message('1'), message('50')]);
    },
  }));

  await chat.refresh();
  await chat.loadOlder();
  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['51', '52']);
  assert.equal(chat.getSnapshot().olderError, 'offline');
  assert.equal(chat.getSnapshot().hasOlder, true);

  await chat.loadOlder();
  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['1', '50', '51', '52']);
  assert.equal(chat.getSnapshot().olderError, null);
  assert.equal(chat.getSnapshot().hasOlder, false);
});

test('a refresh requested while busy runs after the in-flight pass', async () => {
  const first = deferred();
  const cursors = [];
  const chat = controller(fakeTransport({
    get: (_houseId, cursor) => {
      cursors.push(cursor);
      return cursors.length === 1 ? first.promise : Promise.resolve(page([message('2')]));
    },
  }));

  const firstRefresh = chat.refresh();
  const queuedRefresh = chat.refresh();
  first.resolve(page([message('1')]));
  await Promise.all([firstRefresh, queuedRefresh]);

  assert.deepEqual(cursors, [{}, { after: '1' }]);
  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['1', '2']);
});

test('dispose ignores late successful and failed GET and POST responses', async () => {
  for (const [request, outcome] of [
    ['get', 'success'], ['get', 'failure'], ['post', 'success'], ['post', 'failure'],
  ]) {
    const result = deferred();
    const chat = controller(fakeTransport({
      get: request === 'get' ? () => result.promise : undefined,
      post: request === 'post' ? () => result.promise : undefined,
    }));
    const before = chat.getSnapshot();
    const operation = request === 'get' ? chat.refresh() : (chat.send('hello'), flush());
    const loading = chat.getSnapshot();
    assert.notEqual(loading, before);
    chat.dispose();
    if (outcome === 'success') {
      result.resolve(request === 'get'
        ? page([message('1')])
        : { message: message('1', 'hello', '00000000-0000-4000-8000-000000000001') });
    }
    else result.reject(new Error('late failure'));
    await operation;
    await flush();
    assert.equal(chat.getSnapshot(), loading);
  }
});

test('403 clears all rows, aborts peers, and notifies exactly once', async () => {
  const accessError = Object.assign(new Error('Chat request failed.'), { status: 403, retryAt: 0 });
  const refreshResult = deferred();
  const postResult = deferred();
  let denied = 0;
  let postSignal;
  const transport = fakeTransport({
    get: (_houseId, cursor) => cursor.before ? Promise.reject(accessError) : refreshResult.promise,
    post: (_houseId, _input, signal) => {
      postSignal = signal;
      return postResult.promise;
    },
  });
  const chat = controller(transport, {
    uuid: () => 'send-key',
    onAccessDenied: () => {
      assert.equal(postSignal.aborted, true);
      denied += 1;
    },
  });

  refreshResult.resolve(page([message('2')], true));
  await chat.refresh();
  chat.send('pending');
  await flush();
  await chat.loadOlder();

  assert.equal(denied, 1);
  assert.equal(postSignal.aborted, true);
  assert.deepEqual(chat.getSnapshot().messages, []);
  assert.deepEqual(chat.getSnapshot().pending, []);
  assert.equal(chat.getSnapshot().accessDenied, true);
  postResult.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  await flush();
  await chat.loadOlder();
  assert.equal(denied, 1);
});

test('pending reconciliation requires matching house, sender, and client key', async () => {
  const postResult = deferred();
  const chat = controller(fakeTransport({
    get: async () => page([
      message('2', 'sender collision', 'send-key', 'u2'),
      { ...message('3', 'house collision', 'send-key'), houseId: 'h2' },
    ]),
    post: () => postResult.promise,
  }), { uuid: () => 'send-key' });

  chat.send('mine');
  await chat.refresh();
  assert.equal(chat.getSnapshot().pending.length, 1);
  postResult.resolve({ message: message('4', 'mine', 'send-key') });
  await flush();
  assert.equal(chat.getSnapshot().pending.length, 0);
});

test('snapshots retain identity until observable state changes', async () => {
  const chat = controller(fakeTransport());
  const initial = chat.getSnapshot();
  assert.equal(chat.getSnapshot(), initial);
  assert.equal(chat.send('   '), false);
  assert.equal(chat.getSnapshot(), initial);
  await chat.refresh();
  assert.notEqual(chat.getSnapshot(), initial);
});

test('pausing aborts reads but leaves an initiated send running', async () => {
  const getResult = deferred();
  const postResult = deferred();
  let getSignal;
  let postSignal;
  const chat = controller(fakeTransport({
    get: (_houseId, _cursor, signal) => {
      getSignal = signal;
      return getResult.promise;
    },
    post: (_houseId, _input, signal) => {
      postSignal = signal;
      return postResult.promise;
    },
  }));

  const refresh = chat.refresh();
  chat.send('hello');
  chat.pause?.();

  assert.equal(getSignal.aborted, true);
  assert.equal(postSignal.aborted, false);
  getResult.reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
  postResult.resolve({ message: message('1', 'hello', '00000000-0000-4000-8000-000000000001') });
  await refresh;
  await flush();
  assert.deepEqual(chat.getSnapshot().messages.map(item => item.id), ['1']);
});
