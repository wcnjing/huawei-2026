import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

const hookRuntimeSource = `
const runtime = () => globalThis.__HOUSE_HOOK_RUNTIME__;
export const useCallback = (callback, dependencies) => runtime().useCallback(callback, dependencies);
export const useEffect = (effect, dependencies) => runtime().useEffect(effect, dependencies);
export const useRef = initial => runtime().useRef(initial);
export const useState = initial => runtime().useState(initial);
`;

const supabaseSource = `
export function createClient() {
  throw new Error('realtime should be disabled in house hook tests');
}
`;

const bundled = await build({
  entryPoints: ['src/app/services/house.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'esm',
  define: {
    'import.meta.env.VITE_SUPABASE_URL': 'undefined',
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': 'undefined',
  },
  plugins: [{
    name: 'house-hook-runtime',
    setup(build) {
      build.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'house-hook-runtime' }));
      build.onLoad({ filter: /^react$/, namespace: 'house-hook-runtime' }, () => ({
        contents: hookRuntimeSource,
        loader: 'js',
      }));
      build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'supabase', namespace: 'house-hook-runtime' }));
      build.onLoad({ filter: /^supabase$/, namespace: 'house-hook-runtime' }, () => ({
        contents: supabaseSource,
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

  render(hook, enabled, identity) {
    this.index = 0;
    this.pendingEffects = [];
    globalThis.__HOUSE_HOOK_RUNTIME__.current = this;
    try {
      return hook(enabled, identity);
    } finally {
      globalThis.__HOUSE_HOOK_RUNTIME__.current = null;
    }
  }

  useCallback(callback, dependencies) {
    return this.useMemo(() => callback, dependencies);
  }

  useMemo(factory, dependencies) {
    const index = this.index++;
    const slot = this.slots[index];
    if (slot && sameDependencies(slot.dependencies, dependencies)) return slot.value;
    const value = factory();
    this.slots[index] = { value, dependencies };
    return value;
  }

  useRef(initial) {
    const index = this.index++;
    if (!this.slots[index]) this.slots[index] = { current: initial };
    return this.slots[index];
  }

  useState(initial) {
    const index = this.index++;
    if (!this.slots[index]) {
      const slot = {
        value: typeof initial === 'function' ? initial() : initial,
        setValue: update => {
          slot.value = typeof update === 'function' ? update(slot.value) : update;
        },
      };
      this.slots[index] = slot;
    }
    const slot = this.slots[index];
    return [slot.value, slot.setValue];
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
        cleanup: pending.effect(),
      };
    }
    this.pendingEffects = [];
  }

  unmount() {
    for (const slot of this.slots) slot?.cleanup?.();
    this.slots = [];
    this.pendingEffects = [];
  }
}

globalThis.__HOUSE_HOOK_RUNTIME__ = {
  current: null,
  useCallback(callback, dependencies) {
    return this.current.useCallback(callback, dependencies);
  },
  useEffect(effect, dependencies) {
    return this.current.useEffect(effect, dependencies);
  },
  useRef(initial) {
    return this.current.useRef(initial);
  },
  useState(initial) {
    return this.current.useState(initial);
  },
};

const windowEvents = new EventTarget();
globalThis.window = {
  addEventListener: (...args) => windowEvents.addEventListener(...args),
  removeEventListener: (...args) => windowEvents.removeEventListener(...args),
  dispatchEvent: event => windowEvents.dispatchEvent(event),
  setInterval,
  clearInterval,
};
const documentEvents = new EventTarget();
globalThis.document = {
  visibilityState: 'visible',
  addEventListener: (...args) => documentEvents.addEventListener(...args),
  removeEventListener: (...args) => documentEvents.removeEventListener(...args),
};

let storedToken = null;
globalThis.localStorage = {
  getItem: key => key === 'safespace_session_token' ? storedToken : null,
  setItem: (key, value) => {
    if (key === 'safespace_session_token') storedToken = value;
  },
  removeItem: key => {
    if (key === 'safespace_session_token') storedToken = null;
  },
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

function houseState(id) {
  return {
    self: { id: `user-${id}` },
    house: { id: `house-${id}`, doorbell: `doorbell-${id}`, members: [] },
  };
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function loadHook() {
  importId += 1;
  return (await import(`${bundledUrl}#${importId}`)).useHouse;
}

function nextTask() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

for (const order of ['sign-in first', 'hook refresh first']) {
  test(`sign-in state and the new-session hook remain ordered when ${order}`, async t => {
    storedToken = null;
    const calls = installFetch();
    const useHouse = await loadHook();
    const instance = new HookInstance();
    t.after(() => instance.unmount());

    const signedOut = instance.render(useHouse, false, 'signed-out');
    instance.commit();
    storedToken = 'token-new';
    instance.render(useHouse, true, 'token-new');
    instance.commit();
    assert.equal(calls.length, 1);

    const signInState = houseState('sign-in');
    const refreshedState = houseState('refresh');
    if (order === 'sign-in first') {
      signedOut.apply(signInState, 'token-new');
      assert.equal(instance.render(useHouse, true, 'token-new').state.house?.id, 'house-sign-in');
      calls[0].resolve(response(refreshedState));
      await nextTask();
      assert.equal(instance.render(useHouse, true, 'token-new').state.house?.id, 'house-refresh');
    } else {
      calls[0].resolve(response(refreshedState));
      await nextTask();
      assert.equal(instance.render(useHouse, true, 'token-new').state.house?.id, 'house-refresh');
      signedOut.apply(signInState, 'token-new');
      assert.equal(instance.render(useHouse, true, 'token-new').state.house?.id, 'house-sign-in');
    }
  });
}

test('a superseded token 401 cannot expire the replacement session', async t => {
  storedToken = 'token-old';
  const calls = installFetch();
  const useHouse = await loadHook();
  const instance = new HookInstance();
  t.after(() => instance.unmount());
  let expiredEvents = 0;
  const onExpired = () => { expiredEvents += 1; };
  windowEvents.addEventListener('safespace-session-expired', onExpired);
  t.after(() => windowEvents.removeEventListener('safespace-session-expired', onExpired));

  instance.render(useHouse, true, 'token-old');
  instance.commit();
  assert.equal(calls.length, 1);

  storedToken = 'token-new';
  instance.render(useHouse, true, 'token-new');
  calls[0].resolve(response({ error: 'expired' }, 401));
  await nextTask();

  assert.equal(storedToken, 'token-new');
  assert.equal(expiredEvents, 0);
});
