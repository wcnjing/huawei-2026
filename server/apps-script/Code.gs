/**
 * SafeSpace — email drill sender (Google Apps Script web app).
 *
 * Receives {secret, email, subject, html} from the backend and sends the mail from the
 * Google account that owns this script.
 *
 * ⚠️ SECURITY: an Apps Script web app deployed with access "Anyone" is a PUBLIC URL. With
 * no auth it is an open relay — anyone who learns the URL can send mail as you, from your
 * Google identity, until Google suspends the account. So the shared secret below is
 * REQUIRED, and this script FAILS CLOSED if it is not configured.
 *
 * SETUP
 *  1. script.google.com → New project → paste this file in.
 *  2. Project Settings → Script Properties → add:
 *       SAFESPACE_SECRET = <a long random string>
 *     Generate one with:  openssl rand -hex 32
 *  3. Deploy → New deployment → type "Web app"
 *       Execute as:      Me
 *       Who has access:  Anyone
 *  4. Copy the /exec URL into the backend .env as GOOGLE_SCRIPT_URL,
 *     and the same secret as GOOGLE_SCRIPT_SECRET.
 *  5. Run doPost once from the editor to trigger the Gmail authorisation prompt.
 *
 * Quota note: consumer Gmail allows ~100 recipients/day, Workspace ~1500.
 */

function doPost(e) {
  try {
    var expected = PropertiesService.getScriptProperties().getProperty('SAFESPACE_SECRET');

    // Fail closed: no configured secret means this endpoint sends nothing at all.
    if (!expected) {
      return _json({ success: false, error: 'sender not configured' });
    }
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ success: false, error: 'empty request' });
    }

    var data = JSON.parse(e.postData.contents);

    if (!_safeEquals(String(data.secret || ''), expected)) {
      return _json({ success: false, error: 'unauthorized' });
    }
    if (!data.email || !data.html) {
      return _json({ success: false, error: 'email and html are required' });
    }

    MailApp.sendEmail({
      to: String(data.email),
      subject: String(data.subject || 'Notice'),
      htmlBody: String(data.html),
      name: String(data.fromName || 'Notifications'),
    });

    return _json({ success: true });
  } catch (err) {
    // Never echo the raw error back — it can leak script/account detail.
    console.error('send failed: ' + err);
    return _json({ success: false, error: 'send failed' });
  }
}

/** GET is only a health check — it must never send anything. */
function doGet() {
  var configured = !!PropertiesService.getScriptProperties().getProperty('SAFESPACE_SECRET');
  return _json({ ok: true, configured: configured });
}

/** Length-safe, constant-time-ish comparison so the secret can't be guessed byte by byte. */
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
