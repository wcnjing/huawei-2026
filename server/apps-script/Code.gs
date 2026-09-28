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

var _LANGUAGES = ['en', 'zh', 'ms', 'ta'];

// All names and organisations are fictional. Keep ids in sync with server/email.js.
// Each scenario carries its copy per language; unknown languages fall back to en.
var _DRILL_SCENARIOS = {
  bank: {
    sender: 'Meridian Bank',
    en: {
      subject: 'Security alert: review required',
      paragraphs: [
        'A transfer to a new payee is awaiting a security review.',
        'Review the activity immediately to prevent restrictions on your account.'
      ],
      action: 'Review activity'
    },
    zh: {
      subject: '安全警报：需要审核',
      paragraphs: [
        '一笔转给新收款人的转账正在等待安全审核。',
        '请立即查看这项活动，以免您的账户受到限制。'
      ],
      action: '查看活动'
    },
    ms: {
      subject: 'Amaran keselamatan: semakan diperlukan',
      paragraphs: [
        'Satu pindahan kepada penerima baharu sedang menunggu semakan keselamatan.',
        'Semak aktiviti ini dengan segera untuk mengelakkan sekatan pada akaun anda.'
      ],
      action: 'Semak aktiviti'
    },
    ta: {
      subject: 'பாதுகாப்பு எச்சரிக்கை: சரிபார்ப்பு தேவை',
      paragraphs: [
        'புதிய பெறுநருக்கான பணப் பரிமாற்றம் பாதுகாப்புச் சரிபார்ப்புக்காகக் காத்திருக்கிறது.',
        'உங்கள் கணக்கு முடக்கப்படாமல் இருக்க, இந்தச் செயல்பாட்டை உடனே சரிபாருங்கள்.'
      ],
      action: 'செயல்பாட்டைச் சரிபார்'
    }
  },
  parcel: {
    sender: 'ParcelLink',
    en: {
      subject: 'Delivery fee still outstanding',
      paragraphs: [
        'Your parcel is on hold because a small customs fee remains unpaid.',
        'Settle the fee today or the parcel will be returned to the sender.'
      ],
      action: 'Pay delivery fee'
    },
    zh: {
      subject: '运费尚未缴付',
      paragraphs: [
        '您的包裹因一笔小额关税未缴而被扣留。',
        '请在今天付清费用，否则包裹将退回给寄件人。'
      ],
      action: '支付运费'
    },
    ms: {
      subject: 'Yuran penghantaran masih tertunggak',
      paragraphs: [
        'Bungkusan anda ditahan kerana yuran kastam yang kecil belum dibayar.',
        'Jelaskan yuran hari ini atau bungkusan akan dipulangkan kepada pengirim.'
      ],
      action: 'Bayar yuran penghantaran'
    },
    ta: {
      subject: 'விநியோகக் கட்டணம் இன்னும் நிலுவையில் உள்ளது',
      paragraphs: [
        'சிறிய சுங்கக் கட்டணம் செலுத்தப்படாததால் உங்கள் பார்சல் நிறுத்தி வைக்கப்பட்டுள்ளது.',
        'இன்றே கட்டணத்தைச் செலுத்துங்கள், இல்லையெனில் பார்சல் அனுப்புநருக்குத் திருப்பி அனுப்பப்படும்.'
      ],
      action: 'விநியோகக் கட்டணம் செலுத்து'
    }
  },
  password: {
    sender: 'CloudMail',
    en: {
      subject: 'Password reset confirmation needed',
      paragraphs: [
        'A password reset was requested for your mailbox.',
        'If you did not request it, secure the account before the reset completes.'
      ],
      action: 'Secure account'
    },
    zh: {
      subject: '需要确认密码重置',
      paragraphs: [
        '有人为您的邮箱申请了密码重置。',
        '如果不是您本人申请，请在重置完成前保护您的账户。'
      ],
      action: '保护账户'
    },
    ms: {
      subject: 'Pengesahan tetapan semula kata laluan diperlukan',
      paragraphs: [
        'Tetapan semula kata laluan telah diminta untuk peti mel anda.',
        'Jika anda tidak memintanya, lindungi akaun sebelum tetapan semula selesai.'
      ],
      action: 'Lindungi akaun'
    },
    ta: {
      subject: 'கடவுச்சொல் மீட்டமைப்பை உறுதிசெய்ய வேண்டும்',
      paragraphs: [
        'உங்கள் மின்னஞ்சல் பெட்டிக்கு கடவுச்சொல் மீட்டமைப்பு கோரப்பட்டுள்ளது.',
        'நீங்கள் கோரவில்லை என்றால், மீட்டமைப்பு முடியும் முன் கணக்கைப் பாதுகாக்கவும்.'
      ],
      action: 'கணக்கைப் பாதுகா'
    }
  },
  govt: {
    sender: 'Office of Public Trust',
    en: {
      subject: 'Notice requires your response',
      paragraphs: [
        'An unpaid infringement notice has been recorded under your details.',
        'Respond within 24 hours to prevent the notice from escalating.'
      ],
      action: 'Review notice'
    },
    zh: {
      subject: '通知需要您回复',
      paragraphs: [
        '您的名下已登记一张未缴的违规通知。',
        '请在24小时内回复，以免事件升级处理。'
      ],
      action: '查看通知'
    },
    ms: {
      subject: 'Notis memerlukan jawapan anda',
      paragraphs: [
        'Notis kesalahan yang belum dibayar telah direkodkan di bawah butiran anda.',
        'Jawab dalam masa 24 jam untuk mengelakkan notis ini dinaikkan.'
      ],
      action: 'Semak notis'
    },
    ta: {
      subject: 'அறிவிப்புக்கு உங்கள் பதில் தேவை',
      paragraphs: [
        'உங்கள் விவரங்களின் கீழ் செலுத்தப்படாத விதிமீறல் அறிவிப்பு பதிவு செய்யப்பட்டுள்ளது.',
        'அறிவிப்பு தீவிரமடையாமல் இருக்க 24 மணி நேரத்திற்குள் பதிலளிக்கவும்.'
      ],
      action: 'அறிவிப்பைப் பார்'
    }
  },
  scholarship: {
    sender: 'Northstar Scholars',
    en: {
      subject: 'Your scholarship selection',
      paragraphs: [
        'You have been selected for the Northstar Scholars education award.',
        'Confirm your details before the acceptance window closes.'
      ],
      action: 'Accept award'
    },
    zh: {
      subject: '您已获选奖学金',
      paragraphs: [
        '您已获选 Northstar Scholars 教育奖。',
        '请在接受期限结束前确认您的资料。'
      ],
      action: '接受奖项'
    },
    ms: {
      subject: 'Pemilihan biasiswa anda',
      paragraphs: [
        'Anda telah dipilih untuk anugerah pendidikan Northstar Scholars.',
        'Sahkan butiran anda sebelum tempoh penerimaan ditutup.'
      ],
      action: 'Terima anugerah'
    },
    ta: {
      subject: 'உங்கள் உதவித்தொகைத் தேர்வு',
      paragraphs: [
        'Northstar Scholars கல்வி விருதுக்கு நீங்கள் தேர்ந்தெடுக்கப்பட்டுள்ளீர்கள்.',
        'ஏற்றுக்கொள்ளும் காலம் முடியும் முன் உங்கள் விவரங்களை உறுதிசெய்யுங்கள்.'
      ],
      action: 'விருதை ஏற்றுக்கொள்'
    }
  },
  job: {
    sender: 'WorkHarbor',
    en: {
      subject: 'Remote role: onboarding required',
      paragraphs: [
        'Your profile has been selected for a flexible remote position.',
        'Complete onboarding today to reserve the role and receive your equipment.'
      ],
      action: 'Start onboarding'
    },
    zh: {
      subject: '远程职位：需要完成入职手续',
      paragraphs: [
        '您的个人资料已被选中，获得一份时间灵活的远程工作。',
        '请在今天完成入职手续，以保留职位并领取您的设备。'
      ],
      action: '开始入职'
    },
    ms: {
      subject: 'Jawatan jarak jauh: pendaftaran diperlukan',
      paragraphs: [
        'Profil anda telah dipilih untuk jawatan jarak jauh yang fleksibel.',
        'Lengkapkan pendaftaran hari ini untuk menempah jawatan dan menerima peralatan anda.'
      ],
      action: 'Mula pendaftaran'
    },
    ta: {
      subject: 'தொலைதூரப் பணி: பணியில் சேர்க்கை தேவை',
      paragraphs: [
        'நெகிழ்வான தொலைதூரப் பணிக்கு உங்கள் சுயவிவரம் தேர்ந்தெடுக்கப்பட்டுள்ளது.',
        'பணியை உறுதிசெய்து உபகரணங்களைப் பெற இன்றே சேர்க்கையை முடியுங்கள்.'
      ],
      action: 'சேர்க்கையைத் தொடங்கு'
    }
  },
  refund: {
    sender: 'NovaCart',
    en: {
      subject: 'Refund could not be processed',
      paragraphs: [
        'A refund for your recent order could not be returned to the original method.',
        'Confirm a payment destination before the refund expires.'
      ],
      action: 'Claim refund'
    },
    zh: {
      subject: '退款无法处理',
      paragraphs: [
        '您最近订单的退款无法退回原付款方式。',
        '请在退款过期前确认收款账户。'
      ],
      action: '领取退款'
    },
    ms: {
      subject: 'Bayaran balik tidak dapat diproses',
      paragraphs: [
        'Bayaran balik untuk pesanan terbaru anda tidak dapat dikembalikan ke kaedah asal.',
        'Sahkan destinasi pembayaran sebelum bayaran balik tamat tempoh.'
      ],
      action: 'Tuntut bayaran balik'
    },
    ta: {
      subject: 'பணத்தைத் திருப்பித் தர முடியவில்லை',
      paragraphs: [
        'உங்கள் சமீபத்திய ஆர்டருக்கான பணத்தை அசல் முறைக்குத் திருப்பித் தர முடியவில்லை.',
        'பணம் காலாவதியாகும் முன் பணம் பெறும் கணக்கை உறுதிசெய்யுங்கள்.'
      ],
      action: 'பணத்தைப் பெறு'
    }
  },
  account: {
    sender: 'CloudMail',
    en: {
      subject: 'Account suspension warning',
      paragraphs: [
        'Your mailbox failed a required security check.',
        'Re-verify it today to prevent messages and stored files from being removed.'
      ],
      action: 'Re-verify account'
    },
    zh: {
      subject: '账户暂停警告',
      paragraphs: [
        '您的邮箱未通过必要的安全检查。',
        '请在今天重新验证，以免邮件和储存的文件被删除。'
      ],
      action: '重新验证账户'
    },
    ms: {
      subject: 'Amaran penggantungan akaun',
      paragraphs: [
        'Peti mel anda gagal semakan keselamatan yang diwajibkan.',
        'Sahkan semula hari ini untuk mengelakkan mesej dan fail simpanan dipadam.'
      ],
      action: 'Sahkan semula akaun'
    },
    ta: {
      subject: 'கணக்கு முடக்க எச்சரிக்கை',
      paragraphs: [
        'உங்கள் மின்னஞ்சல் பெட்டி கட்டாயப் பாதுகாப்புச் சோதனையில் தோல்வியடைந்தது.',
        'செய்திகளும் சேமித்த கோப்புகளும் நீக்கப்படாமல் இருக்க இன்றே மீண்டும் சரிபாருங்கள்.'
      ],
      action: 'கணக்கை மீண்டும் சரிபார்'
    }
  }
};

// SafeSpace's own (non-drill) wording. {name} is replaced before escaping.
var _TEXT = {
  en: {
    greetingNamed: 'Hi {name},',
    greeting: 'Hello,',
    report: 'Report as suspicious',
    verifySubject: 'Verify your email for SafeSpace',
    verifyIntro: 'Confirm that this email belongs to you before it can receive safety drills.',
    verifyButton: 'Verify my email',
    verifyIgnore: 'If you did not request this, you can ignore this message.',
    followupSubject: 'SafeSpace drill follow-up: you are safe',
    followupBody: 'The earlier message was a consented SafeSpace safety drill. '
      + 'It was fictional, no account action is required, and you are safe.'
  },
  zh: {
    greetingNamed: '{name}，您好：',
    greeting: '您好：',
    report: '举报可疑邮件',
    verifySubject: '验证您的 SafeSpace 电子邮件',
    verifyIntro: '在此邮箱接收安全演练之前，请确认它属于您。',
    verifyButton: '验证我的电子邮件',
    verifyIgnore: '如果这不是您申请的，可以忽略此邮件。',
    followupSubject: 'SafeSpace 演练跟进：您是安全的',
    followupBody: '之前那封邮件是您已同意的 SafeSpace 安全演练。内容是虚构的，您的账户无需任何操作，您是安全的。'
  },
  ms: {
    greetingNamed: 'Hai {name},',
    greeting: 'Hai,',
    report: 'Laporkan sebagai mencurigakan',
    verifySubject: 'Sahkan e-mel anda untuk SafeSpace',
    verifyIntro: 'Sahkan bahawa e-mel ini milik anda sebelum ia boleh menerima latihan keselamatan.',
    verifyButton: 'Sahkan e-mel saya',
    verifyIgnore: 'Jika anda tidak memintanya, anda boleh abaikan mesej ini.',
    followupSubject: 'Susulan latihan SafeSpace: anda selamat',
    followupBody: 'Mesej tadi ialah latihan keselamatan SafeSpace yang anda persetujui. '
      + 'Ia rekaan semata-mata, tiada tindakan akaun diperlukan, dan anda selamat.'
  },
  ta: {
    greetingNamed: 'வணக்கம் {name},',
    greeting: 'வணக்கம்,',
    report: 'சந்தேகத்திற்குரியது எனப் புகாரளி',
    verifySubject: 'SafeSpace-க்காக உங்கள் மின்னஞ்சலைச் சரிபாருங்கள்',
    verifyIntro: 'பாதுகாப்புப் பயிற்சிகளைப் பெறும் முன், இந்த மின்னஞ்சல் உங்களுடையது என்பதை உறுதிசெய்யுங்கள்.',
    verifyButton: 'என் மின்னஞ்சலைச் சரிபார்',
    verifyIgnore: 'நீங்கள் இதைக் கோரவில்லை என்றால், இந்தச் செய்தியைப் புறக்கணிக்கலாம்.',
    followupSubject: 'SafeSpace பயிற்சி பின்தொடர்வு: நீங்கள் பாதுகாப்பாக இருக்கிறீர்கள்',
    followupBody: 'முந்தைய செய்தி நீங்கள் ஒப்புக்கொண்ட SafeSpace பாதுகாப்புப் பயிற்சி. '
      + 'அது கற்பனையானது, கணக்கில் எந்த நடவடிக்கையும் தேவையில்லை, நீங்கள் பாதுகாப்பாக இருக்கிறீர்கள்.'
  }
};

function _lang(value) {
  var lang = String(value || '');
  return _LANGUAGES.indexOf(lang) === -1 ? 'en' : lang;
}

function _text(lang) {
  return _TEXT[_lang(lang)];
}

function _greeting(lang, name) {
  var text = _text(lang);
  return name ? text.greetingNamed.replace('{name}', function () { return name; }) : text.greeting;
}

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
  var scenario = Object.prototype.hasOwnProperty.call(_DRILL_SCENARIOS, String(data.scenarioId || ''))
    ? _DRILL_SCENARIOS[String(data.scenarioId)]
    : null;
  var lang = _lang(data.language);
  var email = _validEmail(data.email);
  var name = _cleanName(data.recipientName);
  var origin = properties.getProperty('SAFESPACE_LINK_ORIGIN');
  var revealUrl = _safeActionUrl(data.revealUrl, origin, '/drill-reveal');
  var reportUrl = _safeActionUrl(data.reportUrl, origin, '/drill-report');
  if (!scenario || !email || !revealUrl || !reportUrl || revealUrl === reportUrl) {
    return _json({ success: false, error: 'invalid drill request' });
  }

  var copy = scenario[lang] || scenario.en;
  var report = _text(lang).report;
  var greeting = _greeting(lang, name);
  var html = '<p>' + _escapeHtml(greeting) + '</p>'
    + '<p>' + _escapeHtml(copy.paragraphs[0]) + '</p>'
    + '<p><strong>' + _escapeHtml(copy.paragraphs[1]) + '</strong></p>'
    + '<p><a href="' + _escapeHtml(revealUrl) + '">' + _escapeHtml(copy.action) + '</a></p>'
    + '<p><a href="' + _escapeHtml(reportUrl) + '">' + _escapeHtml(report) + '</a></p>';
  var body = greeting + '\n\n' + copy.paragraphs.join('\n\n')
    + '\n\n' + copy.action + ': ' + revealUrl
    + '\n\n' + report + ': ' + reportUrl;

  _sendMail(email, copy.subject, body, html, scenario.sender);
  return _json({ success: true, scenarioId: String(data.scenarioId) });
}

function _sendVerification(data, properties) {
  var email = _validEmail(data.email);
  var name = _cleanName(data.recipientName);
  var origin = properties.getProperty('SAFESPACE_LINK_ORIGIN');
  var url = _safeActionUrl(data.verificationUrl, origin, '/email-verify');
  if (!email || !url) return _json({ success: false, error: 'invalid verification request' });

  var lang = _lang(data.language);
  var text = _text(lang);
  var greeting = _greeting(lang, name);
  var body = greeting + '\n\n' + text.verifyIntro + '\n' + url + '\n\n' + text.verifyIgnore;
  var html = '<p>' + _escapeHtml(greeting) + '</p>'
    + '<p>' + _escapeHtml(text.verifyIntro) + '</p>'
    + '<p><a href="' + _escapeHtml(url) + '">' + _escapeHtml(text.verifyButton) + '</a></p>'
    + '<p>' + _escapeHtml(text.verifyIgnore) + '</p>';
  _sendMail(email, text.verifySubject, body, html, 'SafeSpace');
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
        language: _lang(data.language),
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
  _sendSafetyFollowup(email, _cleanName(data.recipientName), data.language);
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
        _sendSafetyFollowup(job.email, job.recipientName, job.language);
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

function _sendSafetyFollowup(email, name, language) {
  var lang = _lang(language);
  var text = _text(lang);
  var greeting = _greeting(lang, name);
  var body = greeting + '\n\n' + text.followupBody;
  var html = '<p>' + _escapeHtml(greeting) + '</p><p>' + _escapeHtml(text.followupBody) + '</p>';
  _sendMail(email, text.followupSubject, body, html, 'SafeSpace');
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
