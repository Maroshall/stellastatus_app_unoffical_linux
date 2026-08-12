// 방송 제목 번역(베스트 에포트).
//  - 렌더러는 CSP(connect-src 'self')로 외부 요청이 막히므로, 메인 프로세스에서 번역한다.
//  - 무료 공개 번역 엔드포인트(google translate gtx)를 사용하며, 결과는 메모리에 캐시한다.
//  - 실패하면 원문을 그대로 돌려준다(그레이스풀). 방송 제목은 공개 정보다.
const https = require('node:https');

const cache = new Map(); // `${target}:${text}` -> 번역문

function fetchTranslation(text, target) {
  return new Promise((resolve) => {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      `?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(text); }
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        try {
          const j = JSON.parse(buf);
          const tr = (j[0] || []).map((seg) => (seg && seg[0]) || '').join('');
          resolve(tr || text);
        } catch { resolve(text); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(text); });
    req.on('error', () => resolve(text));
  });
}

async function translateOne(text, target) {
  const key = target + ':' + text;
  if (cache.has(key)) return cache.get(key);
  const tr = await fetchTranslation(text, target);
  cache.set(key, tr);
  return tr;
}

// texts: string[], target: 'en' | 'ja'  →  { [원문]: 번역문 }
async function translateBatch(texts, target) {
  const out = {};
  if (!Array.isArray(texts) || !['en', 'ja'].includes(target)) return out;
  const uniq = [...new Set(texts.filter((t) => t && typeof t === 'string'))].slice(0, 60); // 과도한 요청 방지
  await Promise.all(uniq.map(async (t) => { out[t] = await translateOne(t, target); }));
  return out;
}

module.exports = { translateBatch };
