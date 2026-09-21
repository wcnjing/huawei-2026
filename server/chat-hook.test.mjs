import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const hookRuntimeSource = `
const runtime = () => globalThis.__CHAT_HOOK_RUNTIME__;
export const useEffect = (effect, dependencies) => runtime().useEffect(effect, dependencies);
export const useMemo = (factory, dependencies) => runtime().useMemo(factory, dependencies);
export const useRef = initial => runtime().useRef(initial);
export const useSyncExternalStore = (subscribe, getSnapshot) =>
  runtime().useSyncExternalStore(subscribe, getSnapshot);
`;

const bundled = await build({
  entryPoints: ['src/app/chat.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'esm',
  plugins: [{
    name: 'hook-runtime',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'hook-runtime' }));
      build.onLoad({ filter: /.*/, namespace: 'hook-runtime' }, () => ({
        contents: hookRuntimeSource,
        loader: 'js',
      }));
    },
  }],
});

const bundledUrl = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`;
let importId = 0;

function sameDependencies(left, right) {
  if (left === undefined || right === undefined) return false;
  return left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
}

class HookInstance {
  slots = [];
  pendingEffects = [];
  index = 0;

  render(hook, options) {
    this.index = 0;
    this.pendingEffects = [];
    globalThis.__CHAT_HOOK_RUNTIME__.current = this;
    try {
      return hook(options);
    } finally {
      globalThis.__CHAT_HOOK_RUNTIME__.current = null;
    }
  }

  useRef(initial) {
    const index = this.index++;
    if (!this.slots[index]) this.slots[index] = { current: initial };
    return this.slots[index];
  }

  useMemo(factory, dependencies) {
    const index = this.index++;
    const slot = this.slots[index];
    if (slot && sameDependencies(slot.dependencies, dependencies)) return slot.value;
    const value = factory();
    this.slots[index] = { value, dependencies };
    return value;
  }

  useSyncExternalStore(_subscribe, getSnapshot) {
    this.index += 1;
    return getSnapshot();
  }

  useEffect(effect, dependencies) {
    const index = this.index++;
    const slot = this.slots[index];
    if (!slot || !sameDependencies(slot.dependencies, dependencies)) {
      this.pendingEffects.push({ index, effect, dependencies });
    }
  }

  commit() {
    for (const pending of this.pendingEffects) {
      const previous = this.slots[pending.index];
      previous?.cleanup?.();
      this.slots[pending.index] = {
        dependencies: pending.dependencies,
        effect: pending.effect,
        cleanup: pending.effect(),
      };
    }
    this.pendingEffects = [];
  }

  replayEffects() {
    const effects = this.slots.filter(slot => slot?.effect);
    for (const slot of effects) slot.cleanup?.();
    for (const slot of effects) slot.cleanup = slot.effect();
  }

  unmount() {
    for (const slot of this.slots) slot?.cleanup?.();
    this.slots = [];
    this.pendingEffects = [];
  }
}

globalThis.__CHAT_HOOK_RUNTIME__ = {
  current: null,
  useEffect(effect, dependencies) {
    return this.current.useEffect(effect, dependencies);
  },
  useMemo(factory, dependencies) {
    return this.current.useMemo(factory, dependencies);
  },
  useRef(initial) {
    return this.current.useRef(initial);
  },
  useSyncExternalStore(subscribe, getSnapshot) {
    return this.current.useSyncExternalStore(subscribe, getSnapshot);
  },
};

const windowEvents = new EventTarget();
globalThis.window = {
  addEventListener: (...args) => windowEvents.addEventListener(...args),
  removeEventListener: (...args) => windowEvents.removeEventListener(...args),
  dispatchEvent: event => windowEvents.dispatchEvent(event),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
};
const documentEvents = new EventTarget();
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (...args) => documentEvents.addEventListener(...args),
  removeEventListener: (...args) => documentEvents.removeEventListener(...args),
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function installFetch() {
  const calls = [];
  globalThis.fetch = (url, init) => new Promise((resolve, reject) => {
    const call = { url, init, resolve, reject };
    calls.push(call);
    init.signal.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'));
    }, { once: true });
  });
  return calls;
}

function options(overrides = {}) {
  return {
    houseId: 'house-a',
    selfId: 'user-a',
    sessionKey: 'token-a',
    active: false,
    changeRevision: 0,
    onAccessDenied() {},
    ...overrides,
  };
}

async function loadHook() {
  importId += 1;
  return (await import(`${bundledUrl}#${importId}`)).useHouseChat;
}

function nextTask() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

test('separate hook instances cannot dispose each other controllers', async t => {
  const useHouseChat = await loadHook();
  const calls = installFetch();
  const first = new HookInstance();
  const second = new HookInstance();
  t.after(async () => {
    first.unmount();
    second.unmount();
    await nextTask();
  });

  const firstResult = first.render(useHouseChat, options());
  first.commit();
  assert.equal(firstResult.send('still sending'), true);
  assert.equal(calls.length, 1);

  second.render(useHouseChat, options({
    houseId: 'house-b',
    selfId: 'user-b',
    sessionKey: 'token-b',
  }));

  assert.equal(calls[0].init.signal.aborted, false);
});

test('an abandoned identity render masks old state without stealing its callback', async t => {
  const useHouseChat = await loadHook();
  const calls = installFetch();
  const instance = new HookInstance();
  t.after(async () => {
    instance.unmount();
    await nextTask();
  });
  let oldDenied = 0;
  let newDenied = 0;

  let result = instance.render(useHouseChat, options({
    active: true,
    onAccessDenied: () => { oldDenied += 1; },
  }));
  instance.commit();
  assert.equal(result.send('pending for A'), true);
  result = instance.render(useHouseChat, options({
    active: true,
    onAccessDenied: () => { oldDenied += 1; },
  }));
  assert.equal(result.pending.length, 1);

  const abandoned = instance.render(useHouseChat, options({
    houseId: 'house-b',
    selfId: 'user-b',
    sessionKey: 'token-b',
    active: true,
    onAccessDenied: () => { newDenied += 1; },
  }));
  assert.equal(abandoned.messages.length, 0);
  assert.equal(abandoned.pending.length, 0);

  const read = calls.find(call => call.init.method === 'GET');
  read.resolve(new Response(JSON.stringify({ error: 'denied' }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  }));
  await nextTask();

  assert.equal(oldDenied, 1);
  assert.equal(newDenied, 0);
});

test('StrictMode effect replay retains a live hook-local controller', async () => {
  const useHouseChat = await loadHook();
  const calls = installFetch();
  const instance = new HookInstance();

  const result = instance.render(useHouseChat, options());
  instance.commit();
  instance.replayEffects();
  await nextTask();

  assert.equal(result.send('after replay'), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.signal.aborted, false);

  instance.unmount();
  await nextTask();
  assert.equal(calls[0].init.signal.aborted, true);
});

function chatPage(ids, hasMore = false) {
  return {
    houseId: 'house-a',
    hasMore,
    messages: ids.map(id => ({
      id,
      houseId: 'house-a',
      senderId: 'user-a',
      senderName: 'Alice',
      senderAvatar: null,
      clientKey: `key-${id}`,
      text: `message ${id}`,
      createdAt: '2026-09-21T00:00:00.000Z',
    })),
  };
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
}

test('a realtime revision does not abort an older-page read', async t => {
  const useHouseChat = await loadHook();
  const calls = installFetch();
  const instance = new HookInstance();
  t.after(async () => {
    instance.unmount();
    await nextTask();
  });

  let result = instance.render(useHouseChat, options({ active: true }));
  instance.commit();
  calls[0].resolve(jsonResponse(chatPage(['51', '52'], true)));
  await nextTask();

  result = instance.render(useHouseChat, options({ active: true }));
  instance.commit();
  const older = result.loadOlder();
  const olderCall = calls.find(call => new URL(call.url, 'https://fixture.invalid').searchParams.has('before'));
  assert.ok(olderCall);

  instance.render(useHouseChat, options({ active: true, changeRevision: 1 }));
  instance.commit();
  assert.equal(olderCall.init.signal.aborted, false);

  olderCall.resolve(jsonResponse(chatPage(['1'], false)));
  for (const call of calls.filter(call => call !== olderCall && !call.init.signal.aborted).slice(1)) {
    call.resolve(jsonResponse(chatPage([])));
  }
  await older;
});

test('a realtime revision coalesces without aborting forward catch-up', async t => {
  const useHouseChat = await loadHook();
  const calls = installFetch();
  const instance = new HookInstance();
  t.after(async () => {
    instance.unmount();
    await nextTask();
  });

  let result = instance.render(useHouseChat, options({ active: true }));
  instance.commit();
  calls[0].resolve(jsonResponse(chatPage(['1'])));
  await nextTask();

  result = instance.render(useHouseChat, options({ active: true }));
  instance.commit();
  const forward = result.refresh();
  const forwardCall = calls.at(-1);
  assert.equal(new URL(forwardCall.url, 'https://fixture.invalid').searchParams.get('after'), '1');

  instance.render(useHouseChat, options({ active: true, changeRevision: 1 }));
  instance.commit();
  assert.equal(forwardCall.init.signal.aborted, false);

  forwardCall.resolve(jsonResponse(chatPage(['2'])));
  await nextTask();
  const coalescedCall = calls.at(-1);
  assert.notEqual(coalescedCall, forwardCall);
  assert.equal(new URL(coalescedCall.url, 'https://fixture.invalid').searchParams.get('after'), '2');
  coalescedCall.resolve(jsonResponse(chatPage([])));
  await forward;
});
