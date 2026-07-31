// Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {
  emailConfigured,
  emailVerificationConfigured,
  sendDrillEmail,
  sendEmailOwnershipVerification,
  validateEmailActionUrl,
  pickEmailScenario,
  EMAIL_SCENARIOS,
  resolveEmailFollowupDelay,
  DEFAULT_EMAIL_SAFETY_FOLLOWUP_MS,
} from './email.js';

function clearEmailEnv() {
  delete process.env.OPENAI_API_KEY;
  delete process.env.GOOGLE_SCRIPT_URL;
  delete process.env.GOOGLE_SCRIPT_SECRET;
  delete process.env.PUBLIC_URL;
  delete process.env.EMAIL_ACTION_ORIGIN;
  delete process.env.EMAIL_SAFETY_FOLLOWUP_DELAY_MS;
}

function configureEmail() {
  process.env.GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/test/exec';
  process.env.GOOGLE_SCRIPT_SECRET = 's3cret';
  process.env.PUBLIC_URL = 'https://safe.example.test';
}

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

const signed = (path, marker = 'payload') =>
  `https://safe.example.test${path}?token=${marker}.${'s'.repeat(43)}`;

function loadAppsScript() {
  const values = new Map([
    ['SAFESPACE_SECRET', 's3cret'],
    ['SAFESPACE_LINK_ORIGIN', 'https://safe.example.test'],
  ]);
  const sent = [];
  const properties = {
    getProperty: (key) => values.get(key) ?? null,
    setProperty: (key, value) => values.set(key, value),
    deleteProperty: (key) => values.delete(key),
    getProperties: () => Object.fromEntries(values),
  };
  const sandbox = {
    console: { error() {} },
    PropertiesService: { getScriptProperties: () => properties },
    MailApp: { sendEmail: (message) => sent.push(message), getRemainingDailyQuota: () => 100 },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text) => ({
        text,
        setMimeType() { return this; },
      }),
    },
    Utilities: { getUuid: () => 'job-12345678' },
    ScriptApp: {
      newTrigger: () => ({
        timeBased() { return this; },
        at() { return this; },
        create() { return { getUniqueId: () => 'trigger-12345678' }; },
      }),
      deleteTrigger() {},
      getProjectTriggers: () => [],
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL('./apps-script/Code.gs', import.meta.url), 'utf8'), sandbox);
  return {
    sent,
    post(payload) {
      const output = sandbox.doPost({
        postData: { contents: JSON.stringify({ secret: 's3cret', ...payload }) },
      });
      return JSON.parse(output.text);
    },
  };
}

test('emailConfigured requires relay credentials and an HTTPS first-party origin', () => {
  clearEmailEnv();
  process.env.GOOGLE_SCRIPT_URL = 'https://script.google.com/exec';
  process.env.GOOGLE_SCRIPT_SECRET = 's3cret';
  assert.equal(emailConfigured(), false);
  process.env.PUBLIC_URL = 'http://safe.example.test';
  assert.equal(emailConfigured(), false);
  process.env.PUBLIC_URL = 'https://safe.example.test';
  assert.equal(emailConfigured(), true);
  delete process.env.PUBLIC_URL;
  process.env.EMAIL_ACTION_ORIGIN = 'https://safe.example.test';
  assert.equal(emailConfigured(), true, 'EMAIL_ACTION_ORIGIN is the explicit fallback');
  process.env.EMAIL_SAFETY_FOLLOWUP_DELAY_MS = '1000';
  assert.equal(emailConfigured(), false, 'unsafe scheduler config fails closed');
  assert.equal(
    emailVerificationConfigured(),
    true,
    'an unrelated drill-follow-up delay does not block ownership verification',
  );
  clearEmailEnv();
});

test('OpenAI is no longer part of the email-send trust boundary', () => {
  clearEmailEnv();
  configureEmail();
  assert.equal(emailConfigured(), true);
  assert.equal(process.env.OPENAI_API_KEY, undefined);
  clearEmailEnv();
});

test('FAILS CLOSED: sendDrillEmail refuses when unconfigured', async () => {
  clearEmailEnv();
  await assert.rejects(() => sendDrillEmail({
    to: 'someone@example.com',
    revealUrl: signed('/drill-reveal'),
    reportUrl: signed('/drill-report'),
  }), { code: 'EMAIL_UNAVAILABLE' });
});

test('first-party action URL validation pins origin, path, HTTPS and signed token shape', () => {
  clearEmailEnv();
  configureEmail();
  const reveal = signed('/drill-reveal');
  assert.equal(validateEmailActionUrl(reveal, '/drill-reveal'), reveal);
  for (const bad of [
    signed('/drill-report'),
    `https://evil.example/drill-reveal?token=payload.${'s'.repeat(43)}`,
    `http://safe.example.test/drill-reveal?token=payload.${'s'.repeat(43)}`,
    'https://safe.example.test/drill-reveal',
    `${reveal}#fragment`,
  ]) {
    assert.throws(
      () => validateEmailActionUrl(bad, '/drill-reveal'),
      { code: 'EMAIL_LINK_INVALID' },
    );
  }
  clearEmailEnv();
});

test('curated scenarios are deterministic by id and use fictional organisations', () => {
  assert.equal(pickEmailScenario('parcel').id, 'parcel');
  assert.equal(pickEmailScenario('does-not-exist'), EMAIL_SCENARIOS[0]);
  const forbidden = /\b(?:DBS|OCBC|UOB|Chase|PayPal|Amazon|Google|Microsoft|IRAS|CPF)\b/i;
  for (const scenario of EMAIL_SCENARIOS) {
    assert.doesNotMatch(`${scenario.sender} ${scenario.subject}`, forbidden);
  }
});

test('email safety follow-up has a bounded ten-minute default', () => {
  clearEmailEnv();
  assert.equal(resolveEmailFollowupDelay(), DEFAULT_EMAIL_SAFETY_FOLLOWUP_MS);
  assert.throws(() => resolveEmailFollowupDelay(1_000), { code: 'EMAIL_UNAVAILABLE' });
});

test('sendDrillEmail schedules a durable follow-up before sending constrained bait', async (t) => {
  clearEmailEnv();
  configureEmail();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    clearEmailEnv();
  });
  const calls = [];
  global.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    calls.push({ url, payload });
    if (payload.kind === 'schedule-safety-followup') {
      return response(200, { success: true, scheduled: true, jobId: 'job-12345678' });
    }
    return response(200, { success: true });
  };

  const result = await sendDrillEmail({
    to: ' Judge@Example.com ',
    name: '<img src=x onerror=alert(1)>',
    scenarioId: 'parcel',
    revealUrl: signed('/drill-reveal', 'reveal'),
    reportUrl: signed('/drill-report', 'report'),
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].payload.kind, 'schedule-safety-followup');
  assert.equal(calls[1].payload.kind, 'drill');
  assert.equal(calls[1].payload.email, 'judge@example.com');
  assert.equal(calls[1].payload.scenarioId, 'parcel');
  assert.equal(calls[1].payload.recipientName, '<img src=x onerror=alert(1)>');
  assert.ok(!('html' in calls[1].payload), 'provider must never receive generated HTML');
  assert.ok(!('subject' in calls[1].payload), 'subject is selected by the constrained relay');
  assert.equal(result.safetyJobId, 'job-12345678');
  assert.equal(result.scenarioId, 'parcel');
});

test('FAILS CLOSED: no bait is sent when follow-up scheduling is not confirmed', async (t) => {
  clearEmailEnv();
  configureEmail();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    clearEmailEnv();
  });
  const calls = [];
  global.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return response(200, { success: true, scheduled: false });
  };

  await assert.rejects(() => sendDrillEmail({
    to: 'judge@example.com',
    name: 'Judge',
    revealUrl: signed('/drill-reveal', 'reveal'),
    reportUrl: signed('/drill-report', 'report'),
  }), { code: 'EMAIL_UNAVAILABLE' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'schedule-safety-followup');
});

test('a bait-send failure cancels its now-confusing standalone follow-up', async (t) => {
  clearEmailEnv();
  configureEmail();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    clearEmailEnv();
  });
  const calls = [];
  global.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    calls.push(payload);
    if (payload.kind === 'schedule-safety-followup') {
      return response(200, { success: true, scheduled: true, jobId: 'job-12345678' });
    }
    if (payload.kind === 'drill') return response(500, { success: false });
    return response(200, { success: true, canceled: true });
  };

  await assert.rejects(() => sendDrillEmail({
    to: 'judge@example.com',
    name: 'Judge',
    revealUrl: signed('/drill-reveal', 'reveal'),
    reportUrl: signed('/drill-report', 'report'),
  }));
  assert.deepEqual(calls.map((call) => call.kind), [
    'schedule-safety-followup',
    'drill',
    'cancel-safety-followup',
  ]);
  assert.equal(calls[2].jobId, 'job-12345678');
});

test('ownership verification uses the same constrained relay with a signed first-party URL', async (t) => {
  clearEmailEnv();
  configureEmail();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    clearEmailEnv();
  });
  let payload;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return response(200, { success: true });
  };

  await sendEmailOwnershipVerification({
    to: 'judge@example.com',
    name: 'Judge',
    verificationUrl: signed('/email-verify', 'verify'),
  });
  assert.equal(payload.kind, 'email-verification');
  assert.equal(payload.verificationUrl, signed('/email-verify', 'verify'));
  assert.ok(!('html' in payload));
});

test('Apps Script escapes personalization and renders only allow-listed action links', () => {
  const script = loadAppsScript();
  const result = script.post({
    kind: 'drill',
    email: 'judge@example.com',
    recipientName: '<img src=x onerror=alert(1)>',
    scenarioId: 'parcel',
    revealUrl: signed('/drill-reveal', 'reveal'),
    reportUrl: signed('/drill-report', 'report'),
  });
  assert.equal(result.success, true);
  assert.equal(script.sent.length, 1);
  assert.doesNotMatch(script.sent[0].htmlBody, /<img/i);
  assert.match(script.sent[0].htmlBody, /&lt;img src=x onerror=alert\(1\)&gt;/);
  const links = [...script.sent[0].htmlBody.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, [
    signed('/drill-reveal', 'reveal'),
    signed('/drill-report', 'report'),
  ]);
});

test('Apps Script rejects the legacy arbitrary-HTML relay contract', () => {
  const script = loadAppsScript();
  const result = script.post({
    email: 'victim@example.com',
    subject: 'Injected',
    html: '<a href="https://evil.example">click</a>',
  });
  assert.equal(result.success, false);
  assert.equal(script.sent.length, 0);
});
