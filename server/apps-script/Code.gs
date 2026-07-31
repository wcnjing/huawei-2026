/**
 * SafeSpace — constrained email sender and durable safety-follow-up scheduler.
 *
 * The endpoint accepts structured message kinds, never caller-provided HTML. Drill HTML
 * is rendered from the allow-listed fictional scenarios below, and every dynamic value
 * is escaped. Action links must be signed first-party URLs.
 *
 * SETUP
 *  1. script.google.com → New project → paste this file in.
 *  2. Project Settings → Script Properties → add:
 *       SAFESPACE_SECRET     = <a long random string>
 *       SAFESPACE_LINK_ORIGIN = https://your-public-app.example
 *     Generate the secret with: openssl rand -hex 32
 *  3. Deploy → New deployment → Web app → Execute as Me → access Anyone.
 *  4. Set GOOGLE_SCRIPT_URL and GOOGLE_SCRIPT_SECRET on the backend. Set backend
 *     PUBLIC_URL (or EMAIL_ACTION_ORIGIN) to the exact SAFESPACE_LINK_ORIGIN value.
 *  5. Run _authorise once in the editor. This grants MailApp and time-trigger access.
 *
 * Safety follow-ups are stored in Script Properties and dispatched by an installable
 * time trigger. The scheduler is created before the drill email is accepted, so the
 * endpoint fails closed if Apps Script cannot durably register the follow-up.
 */

var _FOLLOWUP_PREFIX = 'SAFESPACE_FOLLOWUP_';
var _MIN_FOLLOWUP_MS = 60 * 1000;
var _MAX_FOLLOWUP_MS = 24 * 60 * 60 * 1000;

// All names and organisations are fictional. Keep ids in sync with server/email.js.
var _DRILL_SCENARIOS = {
  bank: {
    sender: 'Meridian Bank',
    subject: 'Security alert: review required',
    paragraphs: [
      'A transfer to a new payee is awaiting a security review.',
      'Review the activity immediately to prevent restrictions on your account.'
    ],
    action: 'Review activity'
  },
  parcel: {
    sender: 'ParcelLink',
    subject: 'Delivery fee still outstanding',
    paragraphs: [
      'Your parcel is on hold because a small customs fee remains unpaid.',
      'Settle the fee today or the parcel will be returned to the sender.'
    ],
    action: 'Pay delivery fee'
  },
  password: {
    sender: 'CloudMail',
    subject: 'Password reset confirmation needed',
    paragraphs: [
      'A password reset was requested for your mailbox.',
      'If you did not request it, secure the account before the reset completes.'
    ],
    action: 'Secure account'
  },
  govt: {
    sender: 'Office of Public Trust',
    subject: 'Notice requires your response',
    paragraphs: [
      'An unpaid infringement notice has been recorded under your details.',
      'Respond within 24 hours to prevent the notice from escalating.'
    ],
    action: 'Review notice'
  },
  scholarship: {
    sender: 'Northstar Scholars',
    subject: 'Your scholarship selection',
    paragraphs: [
      'You have been selected for the Northstar Scholars education award.',
      'Confirm your details before the acceptance window closes.'
    ],
    action: 'Accept award'
  },
  job: {
    sender: 'WorkHarbor',
    subject: 'Remote role: onboarding required',
    paragraphs: [
      'Your profile has been selected for a flexible remote position.',
      'Complete onboarding today to reserve the role and receive your equipment.'
    ],
    action: 'Start onboarding'
  },
  refund: {
    sender: 'NovaCart',
    subject: 'Refund could not be processed',
    paragraphs: [
      'A refund for your recent order could not be returned to the original method.',
      'Confirm a payment destination before the refund expires.'
    ],
    action: 'Claim refund'
  },
  account: {
    sender: 'CloudMail',
    subject: 'Account suspension warning',
    paragraphs: [
      'Your mailbox failed a required security check.',
      'Re-verify it today to prevent messages and stored files from being removed.'
    ],
    action: 'Re-verify account'
  }
};

function doPost(e) {
  try {
    var properties = PropertiesService.getScriptProperties();
    var expected = properties.getProperty('SAFESPACE_SECRET');
    if (!expected) return _json({ success: false, error: 'sender not configured' });
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ success: false, error: 'empty request' });
    }

    var data = JSON.parse(e.postData.contents);
    if (!_safeEquals(String(data.secret || ''), expected)) {
      return _json({ success: false, error: 'unauthorized' });
    }

    switch (String(data.kind || '')) {
      case 'drill':
        return _sendDrill(data, properties);
      case 'email-verification':
        return _sendVerification(data, properties);
      case 'schedule-safety-followup':
        return _scheduleSafetyFollowup(data);
      case 'cancel-safety-followup':
        return _cancelSafetyFollowup(data);
      case 'safety-followup':
        return _sendImmediateSafetyFollowup(data);
      default:
        return _json({ success: false, error: 'unsupported message kind' });
    }
  } catch (err) {
    // Never echo provider/account details to the public relay response.
    console.error('request failed: ' + err);
    return _json({ success: false, error: 'send failed' });
  }
}

function _sendDrill(data, properties) {
  var scenario = _DRILL_SCENARIOS[String(data.scenarioId || '')];
  var email = _validEmail(data.email);
  var name = _cleanName(data.recipientName);
  var origin = properties.getProperty('SAFESPACE_LINK_ORIGIN');
  var revealUrl = _safeActionUrl(data.revealUrl, origin, '/drill-reveal');
  var reportUrl = _safeActionUrl(data.reportUrl, origin, '/drill-report');
  if (!scenario || !email || !revealUrl || !reportUrl || revealUrl === reportUrl) {
    return _json({ success: false, error: 'invalid drill request' });
  }

  var greeting = name ? 'Hi ' + name + ',' : 'Hello,';
  var html = '<p>' + _escapeHtml(greeting) + '</p>'
    + '<p>' + _escapeHtml(scenario.paragraphs[0]) + '</p>'
    + '<p><strong>' + _escapeHtml(scenario.paragraphs[1]) + '</strong></p>'
    + '<p><a href="' + _escapeHtml(revealUrl) + '">' + _escapeHtml(scenario.action) + '</a></p>'
    + '<p><a href="' + _escapeHtml(reportUrl) + '">Report as suspicious</a></p>';
  var body = greeting + '\n\n' + scenario.paragraphs.join('\n\n')
    + '\n\n' + scenario.action + ': ' + revealUrl
    + '\n\nReport as suspicious: ' + reportUrl;

  _sendMail(email, scenario.subject, body, html, scenario.sender);
  return _json({ success: true, scenarioId: String(data.scenarioId) });
}

function _sendVerification(data, properties) {
  var email = _validEmail(data.email);
  var name = _cleanName(data.recipientName);
  var origin = properties.getProperty('SAFESPACE_LINK_ORIGIN');
  var url = _safeActionUrl(data.verificationUrl, origin, '/email-verify');
  if (!email || !url) return _json({ success: false, error: 'invalid verification request' });

  var greeting = name ? 'Hi ' + name + ',' : 'Hello,';
  var subject = 'Verify your email for SafeSpace';
  var body = greeting + '\n\nConfirm that this email belongs to you before it can receive safety drills:\n'
    + url + '\n\nIf you did not request this, you can ignore this message.';
  var html = '<p>' + _escapeHtml(greeting) + '</p>'
    + '<p>Confirm that this email belongs to you before it can receive safety drills.</p>'
    + '<p><a href="' + _escapeHtml(url) + '">Verify my email</a></p>'
    + '<p>If you did not request this, you can ignore this message.</p>';
  _sendMail(email, subject, body, html, 'SafeSpace');
  return _json({ success: true });
}

function _scheduleSafetyFollowup(data) {
  var email = _validEmail(data.email);
  var name = _cleanName(data.recipientName);
  var sendAt = new Date(String(data.sendAt || ''));
  var delay = sendAt.getTime() - Date.now();
  if (!email || !isFinite(sendAt.getTime()) || delay < _MIN_FOLLOWUP_MS || delay > _MAX_FOLLOWUP_MS) {
    return _json({ success: false, error: 'invalid safety follow-up schedule' });
  }

  var jobId = Utilities.getUuid();
  var trigger;
  try {
    trigger = ScriptApp.newTrigger('_sendDueSafetyFollowups').timeBased().at(sendAt).create();
    PropertiesService.getScriptProperties().setProperty(
      _FOLLOWUP_PREFIX + jobId,
      JSON.stringify({
        email: email,
        recipientName: name,
        sendAt: sendAt.toISOString(),
        attempts: 0,
        triggerId: trigger.getUniqueId()
      })
    );
  } catch (err) {
    if (trigger) ScriptApp.deleteTrigger(trigger);
    PropertiesService.getScriptProperties().deleteProperty(_FOLLOWUP_PREFIX + jobId);
    console.error('follow-up schedule failed: ' + err);
    return _json({ success: false, error: 'could not schedule safety follow-up' });
  }
  return _json({ success: true, scheduled: true, jobId: jobId, sendAt: sendAt.toISOString() });
}

function _cancelSafetyFollowup(data) {
  var jobId = String(data.jobId || '');
  if (!/^[A-Za-z0-9-]{8,}$/.test(jobId)) {
    return _json({ success: false, error: 'invalid follow-up job' });
  }
  var properties = PropertiesService.getScriptProperties();
  var key = _FOLLOWUP_PREFIX + jobId;
  var raw = properties.getProperty(key);
  properties.deleteProperty(key);
  if (raw) {
    try {
      var triggerId = JSON.parse(raw).triggerId;
      var triggers = ScriptApp.getProjectTriggers();
      for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getUniqueId() === triggerId) ScriptApp.deleteTrigger(triggers[i]);
      }
    } catch (err) {
      console.error('follow-up trigger cleanup failed: ' + err);
    }
  }
  return _json({ success: true, canceled: !!raw });
}

function _sendImmediateSafetyFollowup(data) {
  var email = _validEmail(data.email);
  if (!email) return _json({ success: false, error: 'invalid recipient' });
  _sendSafetyFollowup(email, _cleanName(data.recipientName));
  return _json({ success: true });
}

/** Installable trigger target. Jobs survive backend and Apps Script process restarts. */
function _sendDueSafetyFollowups() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return;
  try {
    var properties = PropertiesService.getScriptProperties();
    var all = properties.getProperties();
    var now = Date.now();
    for (var key in all) {
      if (key.indexOf(_FOLLOWUP_PREFIX) !== 0) continue;
      try {
        var job = JSON.parse(all[key]);
        if (new Date(job.sendAt).getTime() > now) continue;
        _sendSafetyFollowup(job.email, job.recipientName);
        properties.deleteProperty(key);
      } catch (err) {
        console.error('safety follow-up attempt failed: ' + err);
        try {
          var retry = JSON.parse(all[key]);
          retry.attempts = Number(retry.attempts || 0) + 1;
          var retryAt = new Date(Date.now() + 5 * 60 * 1000);
          retry.sendAt = retryAt.toISOString();
          var trigger = ScriptApp.newTrigger('_sendDueSafetyFollowups').timeBased().at(retryAt).create();
          retry.triggerId = trigger.getUniqueId();
          properties.setProperty(key, JSON.stringify(retry));
        } catch (retryErr) {
          // Keep the persisted job for operator recovery if a retry trigger cannot be made.
          console.error('safety follow-up retry scheduling failed: ' + retryErr);
        }
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function _sendSafetyFollowup(email, name) {
  var greeting = name ? 'Hi ' + name + ',' : 'Hello,';
  var subject = 'SafeSpace drill follow-up: you are safe';
  var reassurance = 'The earlier message was a consented SafeSpace safety drill. '
    + 'It was fictional, no account action is required, and you are safe.';
  var body = greeting + '\n\n' + reassurance;
  var html = '<p>' + _escapeHtml(greeting) + '</p><p>' + _escapeHtml(reassurance) + '</p>';
  _sendMail(email, subject, body, html, 'SafeSpace');
}

function _sendMail(to, subject, body, html, fromName) {
  MailApp.sendEmail({
    to: to,
    subject: subject,
    body: body,
    htmlBody: html,
    name: fromName
  });
}

function _safeActionUrl(value, configuredOrigin, expectedPath) {
  var origin = String(configuredOrigin || '').replace(/\/+$/, '');
  var url = String(value || '');
  if (!/^https:\/\/[^\/?#@]+$/i.test(origin)) return null;
  if (url.indexOf(origin + expectedPath + '?') !== 0 || url.indexOf('#') !== -1) return null;
  var token = _queryParam(url, 'token');
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{16,}$/.test(token)) return null;
  return url;
}

function _queryParam(url, name) {
  var query = String(url).split('?')[1] || '';
  var pairs = query.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var parts = pairs[i].split('=');
    if (decodeURIComponent(parts[0] || '') === name) {
      try {
        return decodeURIComponent((parts.slice(1).join('=') || '').replace(/\+/g, '%20'));
      } catch (_err) {
        return '';
      }
    }
  }
  return '';
}

function _validEmail(value) {
  var email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function _cleanName(value) {
  return String(value || '').trim().slice(0, 80);
}

function _escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Run once in the editor to request MailApp and ScriptApp authorisation. */
function _authorise() {
  MailApp.getRemainingDailyQuota();
  ScriptApp.getProjectTriggers();
}

/** GET is only a health check — it must never send anything. */
function doGet() {
  var properties = PropertiesService.getScriptProperties();
  return _json({
    ok: true,
    configured: !!properties.getProperty('SAFESPACE_SECRET')
      && !!properties.getProperty('SAFESPACE_LINK_ORIGIN')
  });
}

function _safeEquals(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
