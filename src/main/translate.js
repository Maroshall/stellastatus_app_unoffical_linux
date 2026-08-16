// 방송 제목 번역(베스트 에포트).
//  - 렌더러는 CSP(connect-src 'self')로 외부 요청이 막히므로, 메인 프로세스에서 번역한다.
//  - 무료 공개 번역 엔드포인트(google translate gtx)를 사용하며, 결과는 메모리에 캐시한다.
//  - 실패하면 원문을 그대로 돌려준다(그레이스풀). 방송 제목은 공개 정보다.
const https = require('node:https');

const cache = new Map(); // `${target}:${text}` -> 번역문

// 방송 은어 용어집 — 구글 번역이 엉뚱하게 음역하는 표현을 고정 번역으로 바꾼다.
//  예) '저챗'(저스트 채팅)을 구글은 'Jeochat' 으로 음역한다 → 'Talk' 로 고정.
// 긴 표현부터 먼저 치환되도록 길이 내림차순으로 정렬해 사용한다.
const GLOSSARY = {
  '저챗': { en: 'Talk', ja: 'トーク' },
};
const GLOSSARY_KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);

// 원문에서 용어집 표현을 대상 언어 고정어로 미리 치환한다.
// (치환된 토큰은 이미 영어/가타카나라 구글 번역이 그대로 두는 경향이 있어, 긴 제목 속 '저챗'도 처리된다.)
function applyGlossary(text, target) {
  let out = text;
  for (const ko of GLOSSARY_KEYS) {
    if (out.includes(ko)) out = out.split(ko).join(GLOSSARY[ko][target] || ko);
  }
  return out;
}

// 성공하면 번역문(string), 실패하면 null 을 돌려준다.
// (예전엔 실패 시 원문을 돌려주고 그것을 캐시해, 일시적 실패가 '영구 한국어'로 굳던 문제가 있었다.)
function fetchTranslation(text, target) {
  return new Promise((resolve) => {
    const url =
      'https://translate.googleapis.com/translate_a/single' +
      `?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); } // 429(rate-limit) 등 → 실패
      let buf = '';
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        try {
          const j = JSON.parse(buf);
          const tr = (j[0] || []).map((seg) => (seg && seg[0]) || '').join('');
          resolve(tr || null);
        } catch { resolve(null); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
  });
}

// 성공하면 번역문, 실패(일시적 오류)면 null. 성공한 결과만 캐시한다 → 실패는 다음에 다시 시도된다.
async function translateOne(text, target) {
  const key = target + ':' + text;
  if (cache.has(key)) return cache.get(key);
  // 분해형(NFD) 한글을 완성형(NFC)으로 정규화한다. macOS·일부 API 는 한글을 초성/중성/종성으로
  // 분해해 보내는데, 그러면 '가-힣' 매칭이 안 돼(모음/자음이 따로 떨어져) 번역이 안 되거나 깨진다.
  const norm = String(text).normalize('NFC');
  // 용어집을 먼저 적용한 뒤, 아직 한글이 남아 있으면 번역 API 로 넘긴다.
  // ('저챗' 단독처럼 치환 후 한글이 없으면 API 호출 없이 고정어를 그대로 사용)
  const pre = applyGlossary(norm, target);
  if (!/[가-힣]/.test(pre)) { cache.set(key, pre); return pre; } // 한글 없음 → 안정적 결과, 캐시
  const tr = await fetchTranslation(pre, target);
  if (tr != null) { cache.set(key, tr); return tr; } // 성공만 캐시
  return null; // 일시적 실패 → 캐시하지 않음(렌더러가 원문 유지 후 재시도)
}

// 여러 비동기 작업을 동시 실행 수(limit)로 제한해 처리한다(구글 무료 엔드포인트 rate-limit 회피).
async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]); }
  });
  await Promise.all(workers);
}

// texts: string[], target: 'en' | 'ja'  →  { [원문]: 번역문 }  (실패 항목은 결과에 넣지 않는다)
async function translateBatch(texts, target) {
  const out = {};
  if (!Array.isArray(texts) || !['en', 'ja'].includes(target)) return out;
  const uniq = [...new Set(texts.filter((t) => t && typeof t === 'string'))].slice(0, 120);
  // 동시 요청을 6개로 제한 → 한꺼번에 수십 개를 던져 rate-limit 에 걸리던 문제를 막는다.
  await mapLimit(uniq, 6, async (t) => { const tr = await translateOne(t, target); if (tr != null) out[t] = tr; });
  return out;
}

module.exports = { translateBatch };
