// Languages a user can pick in the app. Anything else (missing, unknown, tampered) is English.
export const LANGUAGES = ['en', 'zh', 'ms', 'ta'];

const HTML_LANG = { en: 'en', zh: 'zh-Hans', ms: 'ms', ta: 'ta' };

export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : 'en';
}

export function htmlLang(language) {
  return HTML_LANG[normalizeLanguage(language)];
}

// Drill and verification links already carry `?token=`; the language rides along unsigned
// because it only changes how the landing page reads, never what it does.
export function withLanguage(url, language) {
  const lang = normalizeLanguage(language);
  return lang === 'en' ? url : `${url}&lang=${lang}`;
}

// Landing pages opened from drill/verification links. Keys are the English text.
const PAGE_TEXT = {
  zh: {
    'DRILL PASSED': '演练通过',
    'GOTCHA': '中招了',
    'SAFESPACE': 'SAFESPACE',
    '▸ Return to SafeSpace': '▸ 返回 SafeSpace',
    'Verification link invalid': '验证链接无效',
    'This link is invalid or expired': '此链接无效或已过期',
    'Return to SafeSpace and request a fresh email verification link.': '请返回 SafeSpace，重新申请电子邮件验证链接。',
    'Confirm email verification': '确认电子邮件验证',
    'Confirm this inbox': '确认此邮箱',
    'Press the button to confirm that this email belongs to you. SafeSpace does not verify ownership from an automatic link preview.': '请按下按钮，确认此电子邮件属于您。SafeSpace 不会通过自动链接预览来验证归属。',
    'VERIFY MY EMAIL': '验证我的电子邮件',
    'Email verified': '电子邮件已验证',
    'This inbox can now receive your consented SafeSpace email drills.': '此邮箱现在可以接收您已同意的 SafeSpace 电子邮件演练。',
    'Verification link replaced': '验证链接已被取代',
    'A newer link replaced this one': '已有更新的链接取代了这个链接',
    'Use the most recent verification email, or request another from SafeSpace.': '请使用最新的验证邮件，或在 SafeSpace 重新申请。',
    'Drill link invalid': '演练链接无效',
    'This drill link is invalid or expired': '此演练链接无效或已过期',
    'No action was recorded. Return to SafeSpace if you want to start another drill.': '没有记录任何操作。如想开始另一个演练，请返回 SafeSpace。',
    'Drill unavailable': '演练不可用',
    'This drill is no longer available': '此演练已不再可用',
    'No action was recorded.': '没有记录任何操作。',
    'Confirm report': '确认举报',
    'Open SafeSpace link': '打开 SafeSpace 链接',
    'Report this message?': '举报这条信息？',
    'Continue to the drill reveal?': '继续查看演练揭晓？',
    'Press the button to continue. Automatic email and messaging link previews cannot record a drill result.': '请按下按钮继续。电子邮件和短信的自动链接预览不会记录演练结果。',
    'CONFIRM REPORT': '确认举报',
    'SHOW DRILL REVEAL': '查看演练揭晓',
    'Drill already completed': '演练已完成',
    'This drill already has a result': '此演练已有结果',
    'SafeSpace kept the first confirmed action and did not replace it with this one.': 'SafeSpace 保留了第一次确认的操作，没有用这次操作取代它。',
    'Drill passed — you reported it': '演练通过——您举报了它',
    'Already reported — nice work': '已举报——做得好',
    'Good catch. This was a SafeSpace drill.': '眼光真准。这是一次 SafeSpace 演练。',
    'You spotted this one and reported it. That instinct — report, then verify through an official channel — is exactly what keeps scammers out.': '您识破并举报了它。先举报，再通过官方渠道核实——这种直觉正是阻挡骗子的关键。',
    'That message was fake, and you did the right thing. Reporting it and checking through an official app or number you find yourself is the reflex that beats real scams.': '那条信息是假的，您做得对。举报它，并通过您自己查到的官方应用或电话核实，这种反应能击败真正的诈骗。',
    'Gotcha — this was a SafeSpace drill': '中招了——这是一次 SafeSpace 演练',
    'You already opened this drill link': '您已经打开过这个演练链接',
    'The message and the organisation were fictional, so you are completely safe. But in a real scam, that click is the moment you would have handed over your details or money. Next time: stop, and check through an official app, number, or website you find yourself — never the link in the message.': '这条信息和机构都是虚构的，所以您完全安全。但在真正的诈骗中，这一下点击就是您交出个人资料或钱财的时刻。下次请先停下来，通过您自己查到的官方应用、电话或网站核实——千万不要点击信息里的链接。',
  },
  ms: {
    'DRILL PASSED': 'LATIHAN LULUS',
    'GOTCHA': 'TERKENA',
    'SAFESPACE': 'SAFESPACE',
    '▸ Return to SafeSpace': '▸ Kembali ke SafeSpace',
    'Verification link invalid': 'Pautan pengesahan tidak sah',
    'This link is invalid or expired': 'Pautan ini tidak sah atau telah tamat tempoh',
    'Return to SafeSpace and request a fresh email verification link.': 'Kembali ke SafeSpace dan minta pautan pengesahan e-mel yang baharu.',
    'Confirm email verification': 'Sahkan pengesahan e-mel',
    'Confirm this inbox': 'Sahkan peti masuk ini',
    'Press the button to confirm that this email belongs to you. SafeSpace does not verify ownership from an automatic link preview.': 'Tekan butang untuk mengesahkan e-mel ini milik anda. SafeSpace tidak mengesahkan pemilikan melalui pratonton pautan automatik.',
    'VERIFY MY EMAIL': 'SAHKAN E-MEL SAYA',
    'Email verified': 'E-mel disahkan',
    'This inbox can now receive your consented SafeSpace email drills.': 'Peti masuk ini kini boleh menerima latihan e-mel SafeSpace yang anda persetujui.',
    'Verification link replaced': 'Pautan pengesahan telah diganti',
    'A newer link replaced this one': 'Pautan yang lebih baharu telah menggantikan pautan ini',
    'Use the most recent verification email, or request another from SafeSpace.': 'Gunakan e-mel pengesahan terkini, atau minta yang lain daripada SafeSpace.',
    'Drill link invalid': 'Pautan latihan tidak sah',
    'This drill link is invalid or expired': 'Pautan latihan ini tidak sah atau telah tamat tempoh',
    'No action was recorded. Return to SafeSpace if you want to start another drill.': 'Tiada tindakan direkodkan. Kembali ke SafeSpace jika anda mahu memulakan latihan lain.',
    'Drill unavailable': 'Latihan tidak tersedia',
    'This drill is no longer available': 'Latihan ini tidak lagi tersedia',
    'No action was recorded.': 'Tiada tindakan direkodkan.',
    'Confirm report': 'Sahkan laporan',
    'Open SafeSpace link': 'Buka pautan SafeSpace',
    'Report this message?': 'Laporkan mesej ini?',
    'Continue to the drill reveal?': 'Teruskan ke pendedahan latihan?',
    'Press the button to continue. Automatic email and messaging link previews cannot record a drill result.': 'Tekan butang untuk meneruskan. Pratonton pautan automatik e-mel dan mesej tidak boleh merekodkan keputusan latihan.',
    'CONFIRM REPORT': 'SAHKAN LAPORAN',
    'SHOW DRILL REVEAL': 'TUNJUKKAN PENDEDAHAN',
    'Drill already completed': 'Latihan sudah selesai',
    'This drill already has a result': 'Latihan ini sudah mempunyai keputusan',
    'SafeSpace kept the first confirmed action and did not replace it with this one.': 'SafeSpace menyimpan tindakan pertama yang disahkan dan tidak menggantikannya dengan tindakan ini.',
    'Drill passed — you reported it': 'Latihan lulus — anda melaporkannya',
    'Already reported — nice work': 'Sudah dilaporkan — syabas',
    'Good catch. This was a SafeSpace drill.': 'Bagus. Ini ialah latihan SafeSpace.',
    'You spotted this one and reported it. That instinct — report, then verify through an official channel — is exactly what keeps scammers out.': 'Anda mengesan dan melaporkannya. Naluri itu — laporkan, kemudian sahkan melalui saluran rasmi — itulah yang menghalang penipu.',
    'That message was fake, and you did the right thing. Reporting it and checking through an official app or number you find yourself is the reflex that beats real scams.': 'Mesej itu palsu, dan anda telah bertindak betul. Melaporkannya dan menyemak melalui aplikasi atau nombor rasmi yang anda cari sendiri ialah refleks yang mengalahkan penipuan sebenar.',
    'Gotcha — this was a SafeSpace drill': 'Terkena — ini ialah latihan SafeSpace',
    'You already opened this drill link': 'Anda sudah membuka pautan latihan ini',
    'The message and the organisation were fictional, so you are completely safe. But in a real scam, that click is the moment you would have handed over your details or money. Next time: stop, and check through an official app, number, or website you find yourself — never the link in the message.': 'Mesej dan organisasi itu adalah rekaan, jadi anda selamat sepenuhnya. Tetapi dalam penipuan sebenar, klik itu ialah saat anda menyerahkan butiran atau wang anda. Lain kali: berhenti, dan semak melalui aplikasi, nombor atau laman web rasmi yang anda cari sendiri — jangan sekali-kali pautan dalam mesej.',
  },
  ta: {
    'DRILL PASSED': 'பயிற்சி வெற்றி',
    'GOTCHA': 'சிக்கிவிட்டீர்கள்',
    'SAFESPACE': 'SAFESPACE',
    '▸ Return to SafeSpace': '▸ SafeSpace-க்குத் திரும்புக',
    'Verification link invalid': 'சரிபார்ப்பு இணைப்பு செல்லாது',
    'This link is invalid or expired': 'இந்த இணைப்பு செல்லாது அல்லது காலாவதியானது',
    'Return to SafeSpace and request a fresh email verification link.': 'SafeSpace-க்குத் திரும்பி, புதிய மின்னஞ்சல் சரிபார்ப்பு இணைப்பைக் கோருங்கள்.',
    'Confirm email verification': 'மின்னஞ்சல் சரிபார்ப்பை உறுதிசெய்க',
    'Confirm this inbox': 'இந்த மின்னஞ்சல் பெட்டியை உறுதிசெய்க',
    'Press the button to confirm that this email belongs to you. SafeSpace does not verify ownership from an automatic link preview.': 'இந்த மின்னஞ்சல் உங்களுடையது என்பதை உறுதிசெய்ய பொத்தானை அழுத்துங்கள். தானியங்கி இணைப்பு முன்னோட்டம் மூலம் SafeSpace உரிமையைச் சரிபார்ப்பதில்லை.',
    'VERIFY MY EMAIL': 'என் மின்னஞ்சலைச் சரிபார்',
    'Email verified': 'மின்னஞ்சல் சரிபார்க்கப்பட்டது',
    'This inbox can now receive your consented SafeSpace email drills.': 'நீங்கள் ஒப்புக்கொண்ட SafeSpace மின்னஞ்சல் பயிற்சிகளை இந்த மின்னஞ்சல் பெட்டி இனி பெறலாம்.',
    'Verification link replaced': 'சரிபார்ப்பு இணைப்பு மாற்றப்பட்டது',
    'A newer link replaced this one': 'புதிய இணைப்பு இதை மாற்றிவிட்டது',
    'Use the most recent verification email, or request another from SafeSpace.': 'சமீபத்திய சரிபார்ப்பு மின்னஞ்சலைப் பயன்படுத்துங்கள், அல்லது SafeSpace-இல் மற்றொன்றைக் கோருங்கள்.',
    'Drill link invalid': 'பயிற்சி இணைப்பு செல்லாது',
    'This drill link is invalid or expired': 'இந்தப் பயிற்சி இணைப்பு செல்லாது அல்லது காலாவதியானது',
    'No action was recorded. Return to SafeSpace if you want to start another drill.': 'எந்தச் செயலும் பதிவு செய்யப்படவில்லை. மற்றொரு பயிற்சியைத் தொடங்க SafeSpace-க்குத் திரும்புங்கள்.',
    'Drill unavailable': 'பயிற்சி கிடைக்கவில்லை',
    'This drill is no longer available': 'இந்தப் பயிற்சி இனி கிடைக்காது',
    'No action was recorded.': 'எந்தச் செயலும் பதிவு செய்யப்படவில்லை.',
    'Confirm report': 'புகாரை உறுதிசெய்க',
    'Open SafeSpace link': 'SafeSpace இணைப்பைத் திற',
    'Report this message?': 'இந்தச் செய்தியைப் புகாரளிக்கவா?',
    'Continue to the drill reveal?': 'பயிற்சி வெளிப்பாட்டுக்குத் தொடரவா?',
    'Press the button to continue. Automatic email and messaging link previews cannot record a drill result.': 'தொடர பொத்தானை அழுத்துங்கள். மின்னஞ்சல் மற்றும் செய்தி இணைப்புகளின் தானியங்கி முன்னோட்டங்கள் பயிற்சி முடிவைப் பதிவு செய்ய முடியாது.',
    'CONFIRM REPORT': 'புகாரை உறுதிசெய்',
    'SHOW DRILL REVEAL': 'வெளிப்பாட்டைக் காட்டு',
    'Drill already completed': 'பயிற்சி ஏற்கனவே முடிந்தது',
    'This drill already has a result': 'இந்தப் பயிற்சிக்கு ஏற்கனவே முடிவு உள்ளது',
    'SafeSpace kept the first confirmed action and did not replace it with this one.': 'SafeSpace முதலில் உறுதிசெய்த செயலை வைத்துக்கொண்டது, இதைக் கொண்டு மாற்றவில்லை.',
    'Drill passed — you reported it': 'பயிற்சி வெற்றி — நீங்கள் புகாரளித்தீர்கள்',
    'Already reported — nice work': 'ஏற்கனவே புகாரளிக்கப்பட்டது — அருமை',
    'Good catch. This was a SafeSpace drill.': 'சரியாகக் கண்டுபிடித்தீர்கள். இது ஒரு SafeSpace பயிற்சி.',
    'You spotted this one and reported it. That instinct — report, then verify through an official channel — is exactly what keeps scammers out.': 'நீங்கள் இதைக் கண்டுபிடித்துப் புகாரளித்தீர்கள். புகாரளித்து, பிறகு அதிகாரப்பூர்வ வழியில் சரிபார்ப்பது — இதுவே மோசடியாளர்களைத் தடுக்கும்.',
    'That message was fake, and you did the right thing. Reporting it and checking through an official app or number you find yourself is the reflex that beats real scams.': 'அந்தச் செய்தி போலியானது, நீங்கள் சரியானதைச் செய்தீர்கள். அதைப் புகாரளித்து, நீங்களே தேடிக் கண்ட அதிகாரப்பூர்வ செயலி அல்லது எண் மூலம் சரிபார்ப்பதே உண்மையான மோசடிகளை வெல்லும்.',
    'Gotcha — this was a SafeSpace drill': 'சிக்கிவிட்டீர்கள் — இது ஒரு SafeSpace பயிற்சி',
    'You already opened this drill link': 'இந்தப் பயிற்சி இணைப்பை ஏற்கனவே திறந்துவிட்டீர்கள்',
    'The message and the organisation were fictional, so you are completely safe. But in a real scam, that click is the moment you would have handed over your details or money. Next time: stop, and check through an official app, number, or website you find yourself — never the link in the message.': 'அந்தச் செய்தியும் நிறுவனமும் கற்பனையானவை, எனவே நீங்கள் முழுமையாகப் பாதுகாப்பாக இருக்கிறீர்கள். ஆனால் உண்மையான மோசடியில், அந்தக் கிளிக்கில்தான் உங்கள் விவரங்களையோ பணத்தையோ இழந்திருப்பீர்கள். அடுத்த முறை: நிறுத்துங்கள், நீங்களே தேடிக் கண்ட அதிகாரப்பூர்வ செயலி, எண் அல்லது இணையதளம் மூலம் சரிபார்க்கவும் — செய்தியில் உள்ள இணைப்பை ஒருபோதும் பயன்படுத்த வேண்டாம்.',
  },
};

export function pageText(language, text) {
  const lang = normalizeLanguage(language);
  if (lang === 'en' || text == null) return text;
  return PAGE_TEXT[lang][text] ?? text;
}
