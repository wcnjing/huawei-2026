import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

// Exercise the language the app opens in, as shipped to the browser, without a DOM.
const source = readFileSync(new URL('../src/app/i18n/languages.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'esm' });
const { loadLanguage, matchDeviceLanguage, LANGUAGE_KEY } =
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

// Node ships a read-only `navigator`, so it has to be redefined rather than assigned.
function setNavigator(value) {
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
}

// The module reads the globals at call time, so each test can stage its own browser.
function browser({ stored, languages, throws = false } = {}) {
  globalThis.localStorage = {
    getItem: (key) => {
      if (throws) throw new Error('private mode');
      return key === LANGUAGE_KEY ? stored ?? null : null;
    },
  };
  setNavigator({ languages, language: languages?.[0] });
}

test('a regional tag still lands on the language it is written in', () => {
  assert.equal(matchDeviceLanguage(['en-SG']), 'en');
  assert.equal(matchDeviceLanguage(['zh-Hans-SG']), 'zh');
  assert.equal(matchDeviceLanguage(['zh-TW']), 'zh');
  assert.equal(matchDeviceLanguage(['ms-MY']), 'ms');
  assert.equal(matchDeviceLanguage(['ta-IN']), 'ta');
  assert.equal(matchDeviceLanguage(['TA-SG']), 'ta');
});

test('a language the app does not speak is not guessed at', () => {
  assert.equal(matchDeviceLanguage(['id-ID']), undefined);   // close to Malay, not Malay
  assert.equal(matchDeviceLanguage(['hi-IN']), undefined);
  assert.equal(matchDeviceLanguage([]), undefined);
  assert.equal(matchDeviceLanguage([undefined, '']), undefined);
});

test('the first tag the app speaks wins, in the order the device prefers', () => {
  assert.equal(matchDeviceLanguage(['id-ID', 'ta-SG', 'en-SG']), 'ta');
  assert.equal(matchDeviceLanguage(['en-GB', 'zh-CN']), 'en');
});

test('a Tamil phone opens the app in Tamil without anyone touching the picker', () => {
  browser({ languages: ['ta-SG', 'en-SG'] });
  assert.equal(loadLanguage(), 'ta');
});

test("a stored choice beats the device, so changing the phone does not undo the user's pick", () => {
  browser({ stored: 'en', languages: ['zh-CN'] });
  assert.equal(loadLanguage(), 'en');
  browser({ stored: 'ms', languages: ['zh-CN'] });
  assert.equal(loadLanguage(), 'ms');
});

test('a tampered or stale stored value falls back to the device, not to itself', () => {
  browser({ stored: 'klingon', languages: ['zh-CN'] });
  assert.equal(loadLanguage(), 'zh');
});

test('English is the floor: no device match, no device, or no storage', () => {
  browser({ languages: ['hi-IN'] });
  assert.equal(loadLanguage(), 'en');
  browser({ languages: ['ta-SG'], throws: true });
  assert.equal(loadLanguage(), 'ta', 'private mode must not cost the device language');
  setNavigator(undefined);
  assert.equal(loadLanguage(), 'en');
});
