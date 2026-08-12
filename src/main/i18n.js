// 메인 프로세스(트레이 메뉴 · 시스템 알림) 다국어 문자열.
// 표시 언어는 store 의 'language' 설정을 따른다(설정 화면에서 변경).
const store = require('./store');

const STR = {
  ko: {
    'tray.header': '스텔라상태 · 현재 {n}명 방송 중',
    'tray.noLive': '방송 중인 멤버가 없습니다',
    'tray.viewers': '· {n}명',
    'tray.open': '창 열기',
    'tray.refresh': '지금 새로고침',
    'tray.quit': '종료',
    'tray.tooltip': '스텔라상태 · {n}명 방송 중',
    'notify.liveTitle': '🔴 {name} 님이 방송을 시작했어요!',
    'notify.liveBody': '치지직에서 라이브 중입니다.',
    'notify.updTitle': '새 버전 {v} 업데이트',
    'notify.updBodyReq': '안정성을 위한 필수 업데이트가 있어요. 클릭해서 업데이트하세요.',
    'notify.updBody': '새로운 업데이트가 있어요. 클릭해서 확인하세요.',
  },
  en: {
    'tray.header': 'StellaStatus · {n} live now',
    'tray.noLive': 'No one is streaming',
    'tray.viewers': '· {n}',
    'tray.open': 'Open window',
    'tray.refresh': 'Refresh now',
    'tray.quit': 'Quit',
    'tray.tooltip': 'StellaStatus · {n} live',
    'notify.liveTitle': '🔴 {name} is live!',
    'notify.liveBody': 'Streaming on CHZZK now.',
    'notify.updTitle': 'Update {v} available',
    'notify.updBodyReq': 'A required update is available. Click to update.',
    'notify.updBody': 'A new update is available. Click to view.',
  },
  ja: {
    'tray.header': 'StellaStatus · 現在 {n}人 配信中',
    'tray.noLive': '配信中のメンバーはいません',
    'tray.viewers': '· {n}人',
    'tray.open': 'ウィンドウを開く',
    'tray.refresh': '今すぐ更新',
    'tray.quit': '終了',
    'tray.tooltip': 'StellaStatus · {n}人 配信中',
    'notify.liveTitle': '🔴 {name} が配信を開始しました！',
    'notify.liveBody': 'CHZZK でライブ配信中です。',
    'notify.updTitle': '新しいバージョン {v}',
    'notify.updBodyReq': '安定性のための必須アップデートがあります。クリックして更新してください。',
    'notify.updBody': '新しいアップデートがあります。クリックして確認してください。',
  },
};

function lang() {
  const l = String(store.get('language') || 'ko').toLowerCase();
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('en')) return 'en';
  return 'ko';
}

function t(key, params) {
  const table = STR[lang()] || STR.ko;
  let s = table[key] != null ? table[key] : STR.ko[key];
  if (s == null) return key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? String(params[k]) : m));
  return s;
}

// 멤버 표시 이름: ko=한국어, en/ja=로마자(nameEng) → 없으면 한국어.
function memberName(m) {
  if (!m) return '';
  const l = lang();
  if (l === 'ko') return m.name || m.nameEng || '';
  if (l === 'ja') return m.nameJa || m.nameEng || m.name || '';
  return m.nameEng || m.name || '';
}

module.exports = { t, lang, memberName };
