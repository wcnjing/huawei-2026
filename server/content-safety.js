// Shared checks for AI-written drill content (email-writer.js, quiz-writer.js). Drills
// use fictional organisations and must never send anyone to a real phone number, inbox
// or brand. Reference numbers, order numbers, amounts and dates are fine: they are what
// make a drill believable.

// Contact details that could reach a real person or service.
export const CONTACT_RE = [
  /[^\s@]+@[^\s@]+\.[^\s@]+/, // email address
  /\+\d[\d\s()-]{6,}\d/, // international phone number
  /(?<![\w#/-])\d{7,}(?![\w/-])/, // seven or more digits in a row (e.g. 31234567)
  /(?<![\w#/.-])\d{3,4}[\s-]\d{4}(?![\w/.-])/, // split local number (e.g. 6123 4567)
  /\b1[-\s]?[38]00[\s-]?\d{3}[\s-]?\d{3,4}\b/, // toll-free number
];

export function hasContact(text, { allowEmailAddresses = false } = {}) {
  return CONTACT_RE.some((re, i) => !(allowEmailAddresses && i === 0) && re.test(text));
}

// Real organisations a drill must not name. The scam's own impersonated entity is also
// checked separately. Not exhaustive: the prompts forbid any real brand; this catches the
// ones models reach for most often in Singapore scam scenarios.
const REAL_BRANDS = [
  'dbs', 'posb', 'ocbc', 'uob', 'maybank', 'citibank', 'hsbc', 'standard chartered',
  'singpass', 'iras', 'cpf board', 'ica', 'moh', 'singapore police', 'spf', 'scamshield',
  'singpost', 'shopee', 'lazada', 'carousell', 'qoo10', 'amazon', 'grabpay', 'foodpanda',
  'microsoft', 'apple', 'google', 'paypal', 'netflix', 'facebook', 'instagram', 'tiktok',
  'sistic', 'ticketmaster', 'dhl', 'fedex', 'ninja van',
];
const REAL_BRANDS_ZH = ['星展', '华侨银行', '大华银行', '微软', '苹果', '谷歌', '亚马逊', '新加坡警察', '新加坡邮政', '虾皮', '来赞达'];
const BRAND_RE = new RegExp(`\\b(?:${REAL_BRANDS.map((b) => b.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');

export function namesRealBrand(text, impersonatedEntity = null) {
  const lower = String(text || '').toLowerCase();
  const real = String(impersonatedEntity || '').trim().toLowerCase();
  if (real.length >= 3 && lower.includes(real)) return true;
  return BRAND_RE.test(lower) || REAL_BRANDS_ZH.some((brand) => lower.includes(brand));
}
