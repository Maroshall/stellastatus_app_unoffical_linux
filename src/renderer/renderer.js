/* 스텔라상태 — 렌더러 UI 로직 */
(() => {
  const api = window.stella;

  const state = {
    members: [],
    settings: {},
    filter: 'all',
    search: '',
    manualUpdateCheck: false,
    scheduleItems: null,
    updateInfo: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const grid = $('#memberScroll');

  // ── 아이콘 팩(Lucide, MIT) ───────────────────
  const ICONS = {
    refresh: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    minus: '<path d="M5 12h14"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    check: '<path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    checkmark: '<path d="M20 6 9 17l-5-5"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    sliders: '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  };
  const FILLED = new Set(['play']);
  function icon(name, size = 18) {
    const p = ICONS[name];
    if (!p) return '';
    const attrs = FILLED.has(name)
      ? 'fill="currentColor" stroke="none"'
      : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" ${attrs}>${p}</svg>`;
  }
  function setIcon(sel, name, size) {
    const el = $(sel);
    if (el) el.innerHTML = icon(name, size);
  }

  // ── 유틸 ────────────────────────────────────
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nfmt = (n) => (n == null ? '' : Number(n).toLocaleString('ko-KR'));
  const openLink = (url) => url && api.openExternal(url);

  // 강조색이 밝으면 어두운 글자, 어두우면 흰 글자
  function inkFor(hex) {
    const c = String(hex || '').replace('#', '');
    if (c.length < 6) return '#fff';
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return L > 0.62 ? '#1c1720' : '#ffffff';
  }

  // 시각 파싱(KST 고정) — 치지직/StelLight 값은 타임존 표기가 없는 한국 시각(UTC+9)이므로
  // PC 시간대와 무관하게 KST 벽시계로 해석해 절대시간(UTC ms)으로 변환한다.
  const KST_OFFSET = 9 * 60 * 60 * 1000;
  function parseOpen(d) {
    if (!d) return null;
    const s = String(d).trim();
    // 이미 타임존(Z 또는 +hh:mm)이 있으면 그대로 절대시간으로 파싱
    if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
      const ms = Date.parse(s.replace(' ', 'T'));
      return Number.isNaN(ms) ? null : ms;
    }
    const m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
    if (!m) { const ms = Date.parse(s.replace(' ', 'T')); return Number.isNaN(ms) ? null : ms; }
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) - KST_OFFSET;
  }
  function fmtUptime(openMs) {
    if (!openMs) return '';
    const diff = Date.now() - openMs;
    if (diff < 0) return '';
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 시작';
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}시간 ${m}분째` : `${m}분째`;
  }

  // 간단 마크다운 → HTML (릴리스 노트용). 입력은 먼저 이스케이프하여 XSS 방지.
  function mdToHtml(src) {
    const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let list = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    const inline = (t) => {
      t = esc(t);
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, txt, url) => `<a class="md-link" data-url="${esc(url)}">${txt}</a>`);
      return t;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) { closeList(); continue; }
      let m;
      if ((m = /^###\s+(.*)/.exec(line))) { closeList(); out.push(`<h4>${inline(m[1])}</h4>`); continue; }
      if ((m = /^##\s+(.*)/.exec(line))) { closeList(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
      if ((m = /^#\s+(.*)/.exec(line))) { closeList(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
      if (/^(-{3,}|={3,})$/.test(line)) { closeList(); out.push('<hr>'); continue; }
      if ((m = /^\s*[-*]\s+(.*)/.exec(line))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      if ((m = /^\s*\d+\.\s+(.*)/.exec(line))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
    closeList();
    return out.join('');
  }

  // CSP(script-src 'self')에서 인라인 onerror 가 막히므로 폴백은 JS 로 연결한다.
  function wireImgFallback(img, fallback) {
    img.addEventListener('error', function handler() {
      img.removeEventListener('error', handler);
      if (fallback) img.src = fallback;
      else img.style.display = 'none';
    });
  }

  // ── 멤버 카드 렌더 ───────────────────────────
  function memberCard(m) {
    const card = document.createElement('article');
    card.className = 'card' + (m.isLive ? ' live' : '');
    card.style.setProperty('--card-accent', m.accent);
    card.style.setProperty('--card-accent2', m.accent2);
    card.style.setProperty('--card-ink', inkFor(m.accent));

    const showThumb = state.settings.showThumbnails !== false;
    const liveThumb = m.isLive && showThumb && m.thumbnail;

    // 오프라인/썸네일 끔: 멤버 로고(로컬 → 치지직 → 별)
    const logoInner = `<img class="mlogo" src="assets/logos/${esc(m.logo || m.key)}.png" alt="">`;
    const thumb = liveThumb
      ? `<img class="mthumb" src="${esc(m.thumbnail)}" alt="">`
      : `<div class="thumb-logo">${logoInner}</div>`;

    const openMs = m.isLive ? parseOpen(m.openDate) : null;
    const badge = m.isLive
      ? `<span class="live-badge"><span class="b-dot"></span>LIVE</span>
         ${m.viewerCount != null ? `<span class="viewers">${icon('eye', 13)} ${nfmt(m.viewerCount)}</span>` : ''}
         ${openMs ? `<span class="live-elapsed" data-open="${openMs}">${icon('clock', 12)} ${esc(fmtUptime(openMs))}</span>` : ''}`
      : `<span class="offline-tag">OFFLINE</span>`;

    const avatar = m.avatar
      ? `<img class="avatar mava" src="${esc(m.avatar)}" alt="">`
      : `<img class="avatar star-mark" src="assets/logo_star.png" alt="">`;

    const titleHtml = m.isLive
      ? `<div class="m-title">${esc(m.title || '방송 중')}</div>
         <div class="m-category">${esc(m.category || '')}</div>`
      : `<div class="m-title offline">${m.error ? '상태를 불러오지 못했어요' : '지금은 방송 중이 아니에요'}</div>
         <div class="m-category"></div>`;

    card.innerHTML = `
      <div class="thumb-wrap">${thumb}${badge}</div>
      <div class="card-body">
        <div class="member-head">
          ${avatar}
          <div class="m-names">
            <div class="m-name">${esc(m.name)} <span class="gen-chip">${esc(m.genName)}</span></div>
            <div class="m-eng">${esc(m.nameEng || '')}</div>
          </div>
        </div>
        ${titleHtml}
        <div class="card-actions">
          <button class="btn btn-live ${m.isLive ? '' : 'disabled'}" data-url="${esc(m.liveUrl)}">
            ${m.isLive ? icon('play', 15) + ' 라이브 바로가기' : '방송 대기중'}
          </button>
          <button class="btn btn-ch" data-url="${esc(m.channelUrl || m.liveUrl)}" title="채널" aria-label="채널">${icon('external', 17)}</button>
        </div>
      </div>`;

    // 이미지 폴백 연결(CSP 대응)
    const mlogo = card.querySelector('.mlogo');
    if (mlogo) wireImgFallback(mlogo, m.avatar || 'assets/logo_star.png');
    const mava = card.querySelector('.mava');
    if (mava) wireImgFallback(mava, 'assets/logo_star.png');
    const mthumb = card.querySelector('.mthumb');
    if (mthumb) wireImgFallback(mthumb, null);

    card.querySelectorAll('[data-url]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!b.classList.contains('disabled')) openLink(b.dataset.url);
      });
    });
    return card;
  }

  function applyFilter(list) {
    let out = list;
    if (state.filter === 'live') out = out.filter((m) => m.isLive);
    else if (state.filter === 'gen1') out = out.filter((m) => m.gen === 1);
    else if (state.filter === 'gen2') out = out.filter((m) => m.gen === 2);
    else if (state.filter === 'gen3') out = out.filter((m) => m.gen === 3);
    if (state.search) {
      const q = state.search.toLowerCase();
      out = out.filter((m) => m.name.toLowerCase().includes(q) || (m.nameEng || '').toLowerCase().includes(q));
    }
    return [...out].sort((a, b) => Number(b.isLive) - Number(a.isLive) || a.gen - b.gen);
  }

  function render() {
    const list = applyFilter(state.members);
    grid.innerHTML = '';
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state">${state.members.length ? '조건에 맞는 스텔라가 없어요.' : '스텔라 정보를 불러오는 중…'}</div>`;
    } else {
      const frag = document.createDocumentFragment();
      list.forEach((m) => frag.appendChild(memberCard(m)));
      grid.appendChild(frag);
    }
    updateSummary();
  }

  function updateSummary() {
    const live = state.members.filter((m) => m.isLive);
    const el = $('#liveSummaryText');
    if (!state.members.length) el.textContent = '불러오는 중…';
    else if (live.length) el.innerHTML = `지금 <b>${live.length}</b>명의 스텔라가 방송 중이에요`;
    else el.textContent = '지금은 모두 휴방 중이에요';
  }

  // ── 인앱 토스트(위→아래 플로팅) ───────────────
  function showToast({ icon: ic, avatar, accent, title, desc, actionLabel, onAction, url, duration = 5000, spin = false }) {
    const host = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    if (accent) t.style.setProperty('--toast-accent', accent);
    const media = avatar
      ? `<img class="t-ava" src="${esc(avatar)}" alt="">`
      : `<div class="t-ico">${icon(ic || 'bell', 18)}</div>`;
    t.innerHTML = `
      ${media}
      <div class="t-body">
        <div class="t-title">${esc(title)}</div>
        ${desc ? `<div class="t-desc">${esc(desc)}</div>` : ''}
      </div>
      ${actionLabel ? `<button class="mini-btn t-act">${esc(actionLabel)}</button>` : ''}
      <button class="t-close" aria-label="닫기">${icon('x', 15)}</button>`;

    const ava = t.querySelector('.t-ava');
    if (ava) wireImgFallback(ava, 'assets/logo_star.png');

    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      t.classList.remove('show');
      setTimeout(() => t.remove(), 320);
    };
    t.querySelector('.t-close').addEventListener('click', (e) => { e.stopPropagation(); close(); });
    const act = t.querySelector('.t-act');
    if (act) act.addEventListener('click', (e) => { e.stopPropagation(); onAction && onAction(); close(); });
    if (url) t.addEventListener('click', () => { openLink(url); close(); });

    if (spin) t.querySelector('.t-ico svg')?.classList.add('spin');

    host.appendChild(t);
    void t.offsetHeight; // 강제 리플로우로 진입 애니메이션 보장
    t.classList.add('show');
    if (duration > 0) setTimeout(close, duration);
    return close;
  }

  // ── 스케줄(뱅온) — StelLight 요청은 시작 시 1회, 표시는 라이브 상태에 맞춰 갱신 ──
  const timeLabel = (dt) => { const m = /T(\d{2}):(\d{2})/.exec(dt || ''); return m ? `${m[1]}:${m[2]}` : ''; };
  const isRest = (title) => /휴방/.test(title || '');

  // 스케줄 항목의 멤버가 현재 방송 중인지
  function scheduleMemberLive(it) {
    const m =
      state.members.find((x) => x.key && x.key === it.channelKey) ||
      state.members.find((x) => x.name === it.stellarName);
    return m ? m.isLive : false;
  }

  async function loadSchedule() {
    const data = await api.getTodaySchedule();
    if (data && data.error) { state.scheduleItems = 'error'; renderSchedule(true); return; }
    let items = Array.isArray(data) ? data : [];
    // 강지(스텔라이브 멤버 아님) 제외
    state.scheduleItems = items.filter((it) => !/강지/.test(it.stellarName || ''));
    renderSchedule(true);
  }

  // 뱅온 항목을 현재 시각 + 라이브 상태로 분류(재요청 없이 앱에서 계산)
  function classifyScheduleRows() {
    const items = state.scheduleItems;
    if (!Array.isArray(items)) return null;
    const now = Date.now();
    // 방송 중 → '시작됨', 시간이 지났고 오프라인(방송 꺼짐) → '종료'. 둘 다 맨 뒤 + 흐리게.
    return items
      .map((it) => {
        const rest = isRest(it.title);
        const t = parseOpen(it.startDateTime) ?? Infinity; // KST 기준 절대시간
        const live = !rest && scheduleMemberLive(it);
        const ended = !rest && !live && t < now;
        return { it, t, rest, live, ended, done: live || ended };
      })
      .sort((a, b) => (a.done !== b.done ? (a.done ? 1 : -1) : a.t - b.t));
  }
  const scheduleSig = (rows) => rows.map((r) => `${r.it.stellarName}|${r.t}|${r.live ? 'L' : r.ended ? 'E' : '-'}`).join(';');

  function renderSchedule(force = false) {
    const strip = $('#schedStrip');
    if (state.scheduleItems === 'error') { strip.innerHTML = `<div class="sched-error">스케줄을 불러오지 못했어요.</div>`; return; }
    const items = state.scheduleItems;
    if (!Array.isArray(items)) return; // 아직 로드 전
    if (!items.length) { strip.innerHTML = `<div class="sched-empty">오늘 등록된 뱅온 정보가 없어요.</div>`; return; }

    const rows = classifyScheduleRows();
    const sig = scheduleSig(rows);
    // 분류(시작/종료/순서)가 실제로 바뀔 때만 다시 그린다(마퀴 애니메이션 리셋 방지).
    if (!force && sig === state._schedSig) return;
    state._schedSig = sig;

    strip.innerHTML = '';
    rows.forEach(({ it, rest, live, ended, done }) => {
      const badge = live
        ? '<span class="sched-started">시작됨</span>'
        : ended
          ? '<span class="sched-started ended">종료</span>'
          : '';
      const card = document.createElement('div');
      card.className = 'sched-card' + (done ? ' past' : '');
      card.innerHTML = `
        <div class="sched-time-row">
          <span class="sched-time ${rest ? 'rest' : ''}">${rest ? '휴방' : (it.isFixedTime ? timeLabel(it.startDateTime) : timeLabel(it.startDateTime) + '~')}</span>
          ${badge}
        </div>
        <div class="sched-name">${esc(it.stellarName)}</div>
        ${it.title && !rest ? `<div class="sched-title"><span class="stt">${esc(it.title)}</span></div>` : ''}`;
      strip.appendChild(card);
      applyMarquee(card.querySelector('.sched-title'));
    });
  }

  // 제목이 카드 폭보다 길면 양쪽 그라데이션 + 좌우 왕복(마퀴) 애니메이션
  function applyMarquee(box) {
    if (!box) return;
    const text = box.querySelector('.stt');
    if (!text) return;
    const over = text.scrollWidth - box.clientWidth;
    if (over > 4) {
      box.classList.add('marquee');
      box.style.setProperty('--shift', over + 'px');
      box.style.setProperty('--dur', Math.max(2.5, over / 22).toFixed(1) + 's');
    }
  }

  // ── 설정 모달(사이드바) ──────────────────────
  function fillSettings() {
    const s = state.settings;
    $('#setNotify').checked = s.notifyEnabled !== false;
    $('#setAutoOpen').checked = !!s.autoOpenLive;
    $('#setThumbs').checked = s.showThumbnails !== false;
    $('#setTray').checked = s.minimizeToTray !== false;
    $('#setStartup').checked = !!s.launchAtStartup;
    $('#setInterval').value = String(s.pollIntervalSec || 60);
    buildMemberList('#subList', s.subscribed, saveSubscriptions);
    buildMemberList('#autoOpenList', s.autoOpenList, saveAutoOpen);
    updateAutoOpenEnabled();
  }

  // 멤버 프로필 선택 목록 생성(알림/브라우저 공용)
  function buildMemberList(sel, selected, onChange) {
    const host = $(sel);
    if (!host) return;
    host.innerHTML = '';
    state.members.forEach((m) => {
      const on = selected == null || selected.includes(m.key);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mpick' + (on ? ' on' : '');
      btn.dataset.key = m.key;
      btn.style.setProperty('--card-accent', m.accent);
      btn.innerHTML = `
        <img class="mpick-ava" src="${esc(m.avatar || 'assets/logo_star.png')}" alt="">
        <span class="mpick-name">${esc(m.name)}</span>
        <span class="mpick-check">${icon('checkmark', 12)}</span>`;
      wireImgFallback(btn.querySelector('.mpick-ava'), 'assets/logo_star.png');
      btn.addEventListener('click', () => { btn.classList.toggle('on'); onChange(); });
      host.appendChild(btn);
    });
  }
  function collectKeys(sel) {
    const items = [...document.querySelectorAll(`${sel} .mpick`)];
    const checked = items.filter((b) => b.classList.contains('on')).map((b) => b.dataset.key);
    return checked.length === items.length ? null : checked; // 전부 = null(전체)
  }
  async function saveSubscriptions() { state.settings = await api.setSettings({ subscribed: collectKeys('#subList') }); }
  async function saveAutoOpen() { state.settings = await api.setSettings({ autoOpenList: collectKeys('#autoOpenList') }); }
  function updateAutoOpenEnabled() {
    const on = $('#setAutoOpen').checked;
    $('#autoOpenList').classList.toggle('disabled', !on);
  }

  function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  function openSettings() {
    fillSettings();
    switchTab('general');
    const m = $('#settingsModal');
    m.hidden = false;
    void m.offsetHeight; // 리플로우 후 열기 애니메이션
    m.classList.add('open');
  }
  let closeTimer = null;
  function closeSettings() {
    const m = $('#settingsModal');
    if (m.hidden) return;
    m.classList.remove('open');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { m.hidden = true; }, 240); // 닫기 애니메이션 후 숨김
  }

  function wireSettings() {
    $('#btnSettings').addEventListener('click', openSettings);
    $('#closeSettings').addEventListener('click', closeSettings);
    $('#settingsModal').addEventListener('click', (e) => { if (e.target.id === 'settingsModal') closeSettings(); });
    document.querySelectorAll('.nav-item[data-tab]').forEach((n) => n.addEventListener('click', () => switchTab(n.dataset.tab)));

    // 라이브러리/출처 링크
    document.querySelectorAll('.lib-link').forEach((el) => el.addEventListener('click', () => openLink(el.dataset.url)));

    const save = async (patch) => (state.settings = await api.setSettings(patch));
    $('#setNotify').addEventListener('change', (e) => save({ notifyEnabled: e.target.checked }));
    $('#setAutoOpen').addEventListener('change', (e) => { save({ autoOpenLive: e.target.checked }); updateAutoOpenEnabled(); });
    $('#setThumbs').addEventListener('change', (e) => { save({ showThumbnails: e.target.checked }); render(); });
    $('#setTray').addEventListener('change', (e) => save({ minimizeToTray: e.target.checked }));
    $('#setStartup').addEventListener('change', (e) => save({ launchAtStartup: e.target.checked }));
    $('#setInterval').addEventListener('change', (e) => save({ pollIntervalSec: Number(e.target.value) }));

    $('#btnCheckUpdate').addEventListener('click', () => { state.manualUpdateCheck = true; api.checkUpdate(); });
    $('#btnUninstall').addEventListener('click', () => api.uninstall());
  }

  // ── 업데이트 모달 ────────────────────────────
  function openUpdateModal(info) {
    state.updateInfo = info;
    $('#umVersion').textContent = 'v' + (info.version || '');
    $('#umRepo').textContent = info.repo || '';
    $('#umNotes').innerHTML = mdToHtml(info.notes || '(변경 내용 없음)');
    $('#umBadge').innerHTML = icon('download', 24);
    // 강제 업데이트: 취소 불가
    $('#umRequired').hidden = !info.mandatory;
    $('#umLater').hidden = !!info.mandatory;
    // 진행 상태 초기화
    $('#umBar').style.width = '0%';
    $('#umProgText').textContent = '업데이트를 내려받는 중…';
    $('#umProgress').hidden = false;
    $('#umInstall').disabled = true;
    const m = $('#updateModal');
    m.hidden = false;
    void m.offsetHeight;
    m.classList.add('open');
  }
  function closeUpdateModal() {
    if (state.updateInfo && state.updateInfo.mandatory) return; // 강제 업데이트는 닫기 불가
    const m = $('#updateModal');
    m.classList.remove('open');
    setTimeout(() => (m.hidden = true), 240);
  }
  function setUpdateProgress(percent) {
    $('#umBar').style.width = (percent || 0) + '%';
    $('#umProgText').textContent = `업데이트를 내려받는 중… ${percent || 0}%`;
  }
  function updateReady() {
    $('#umBar').style.width = '100%';
    $('#umProgText').textContent = '설치 준비가 완료되었습니다.';
    $('#umInstall').disabled = false;
  }

  let checkingToastClose = null;
  function closeChecking() { if (checkingToastClose) { checkingToastClose(); checkingToastClose = null; } }

  function handleUpdate(payload) {
    const manual = state.manualUpdateCheck;
    switch (payload.state) {
      case 'checking':
        // 결과가 나오면 닫히도록 지속(duration 0). 자동 확인 때는 표시하지 않음.
        if (manual) checkingToastClose = showToast({ icon: 'refresh', title: '업데이트를 확인하는 중…', duration: 0, spin: true });
        break;
      case 'available':
        closeChecking();
        openUpdateModal(payload);
        state.manualUpdateCheck = false;
        break;
      case 'downloading':
        if (!$('#updateModal').hidden) setUpdateProgress(payload.percent);
        break;
      case 'downloaded':
        closeChecking();
        if ($('#updateModal').hidden) openUpdateModal(payload);
        updateReady();
        state.manualUpdateCheck = false;
        break;
      case 'none':
        closeChecking();
        if (manual) showToast({ icon: 'check', title: '현재 최신 버전이에요', duration: 3500 });
        state.manualUpdateCheck = false;
        break;
      case 'dev':
        closeChecking();
        if (manual) showToast({ icon: 'alert', title: '개발 모드에서는 업데이트를 확인할 수 없어요', duration: 4000 });
        state.manualUpdateCheck = false;
        break;
      case 'error':
        closeChecking();
        showToast({ icon: 'alert', title: '업데이트를 확인할 수 없어요', desc: manual ? '네트워크나 배포 설정을 확인해 주세요.' : '', duration: 5000 });
        state.manualUpdateCheck = false;
        break;
    }
  }

  function wireUpdateModal() {
    $('#umInstall').addEventListener('click', () => {
      $('#umInstall').disabled = true;
      $('#umInstall').textContent = '설치 중…';
      api.installUpdate();
    });
    $('#umLater').addEventListener('click', closeUpdateModal);
    $('#updateModal').addEventListener('click', (e) => { if (e.target.id === 'updateModal') closeUpdateModal(); });
    $('#umLink').addEventListener('click', () => state.updateInfo && openLink(state.updateInfo.htmlUrl));
  }

  // ── 공용 모달 열기/닫기(애니메이션) ───────────
  function openModalEl(sel) { const m = $(sel); m.hidden = false; void m.offsetHeight; m.classList.add('open'); }
  function closeModalEl(sel) { const m = $(sel); m.classList.remove('open'); setTimeout(() => (m.hidden = true), 240); }

  // ── 문의하기(이메일 · GitHub 이슈 · X) ────────
  function wireContact() {
    const CONTACT = {
      email: 'mailto:contact@stellarium.kr?subject=' + encodeURIComponent('[스텔라상태] 문의'),
      github: 'https://github.com/tabiluv/stellastatus_app/issues/new',
      x: 'https://x.com/tabi_1uv',
    };
    const xSub = $('#coXsub'); if (xSub) xSub.textContent = '@tabi_1uv';
    $('#btnContact').addEventListener('click', () => openModalEl('#contactModal'));
    $('#closeContact').addEventListener('click', () => closeModalEl('#contactModal'));
    $('#contactModal').addEventListener('click', (e) => { if (e.target.id === 'contactModal') closeModalEl('#contactModal'); });
    document.querySelectorAll('.contact-opt').forEach((b) =>
      b.addEventListener('click', () => { openLink(CONTACT[b.dataset.contact]); closeModalEl('#contactModal'); }),
    );
  }

  // ── 업데이트 기록 ────────────────────────────
  async function openChangelog() {
    openModalEl('#changelogModal');
    const host = $('#clList');
    host.innerHTML = '<div class="cl-empty">불러오는 중…</div>';
    const [cur, rels] = await Promise.all([api.getVersion(), api.getChangelog()]);
    if (!rels || !rels.length) { host.innerHTML = '<div class="cl-error">업데이트 기록을 불러오지 못했어요.</div>'; return; }
    host.innerHTML = '';
    rels.forEach((r) => {
      const isCur = r.version === cur;
      const el = document.createElement('div');
      el.className = 'cl-item' + (isCur ? ' current' : '');
      el.innerHTML = `
        <div class="cl-ver-row">
          <span class="cl-ver">v${esc(r.version)}</span>
          ${isCur ? '<span class="cl-now">현재</span>' : ''}
          <span class="cl-date">${esc(r.date || '')}</span>
        </div>
        <div class="cl-notes">${mdToHtml(r.notes || '(변경 내용 없음)')}</div>`;
      host.appendChild(el);
    });
  }
  function wireChangelog() {
    $('#btnChangelog').addEventListener('click', openChangelog);
    $('#closeChangelog').addEventListener('click', () => closeModalEl('#changelogModal'));
    $('#changelogModal').addEventListener('click', (e) => { if (e.target.id === 'changelogModal') closeModalEl('#changelogModal'); });
  }

  // ── 가로 스크롤(휠/드래그, 스크롤바 숨김) ──────
  function attachHScroll(el) {
    el.addEventListener('wheel', (e) => { if (e.deltaY !== 0) { el.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    let down = false, startX = 0, startLeft = 0, moved = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft; el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    });
    const end = () => { if (!down) return; down = false; el.classList.remove('dragging'); if (moved) { el._suppressClick = true; setTimeout(() => (el._suppressClick = false), 0); } };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('click', (e) => { if (el._suppressClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  // ── 배선 ────────────────────────────────────
  function wireToolbar() {
    $('#filterPills').addEventListener('click', (e) => {
      const p = e.target.closest('.pill');
      if (!p) return;
      document.querySelectorAll('.pill').forEach((x) => x.classList.remove('active'));
      p.classList.add('active');
      state.filter = p.dataset.filter;
      render();
    });
    let t;
    $('#searchInput').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 120); });

    const refreshBtn = $('#btnRefresh');
    refreshBtn.addEventListener('click', async () => { refreshBtn.querySelector('svg')?.classList.add('spin'); await api.refresh(); });

    // 멤버는 세로 스크롤 그리드, 스케줄만 가로 스크롤(휠/드래그)
    attachHScroll($('#schedStrip'));
  }
  function wireWindowControls() {
    $('#winMin').addEventListener('click', () => api.minimize());
    $('#winMax').addEventListener('click', () => api.maximizeToggle());
    $('#winClose').addEventListener('click', () => api.close());
  }
  function installIcons() {
    setIcon('#btnRefresh', 'refresh', 16);
    setIcon('#btnSettings', 'settings', 16);
    setIcon('#searchIcon', 'search', 16);
    setIcon('#winMin', 'minus', 14);
    setIcon('#winMax', 'square', 13);
    setIcon('#winClose', 'x', 14);
    setIcon('#closeSettings', 'x', 14);
    setIcon('#closeContact', 'x', 14);
    setIcon('#closeChangelog', 'x', 14);
    // data-icon 속성이 있는 요소(설정 사이드바, 링크 등) 일괄 채우기
    document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon, 16)));
  }

  // ── 초기화 ──────────────────────────────────
  let started = false;
  async function init() {
    if (started) return;
    started = true;
    installIcons();
    wireToolbar();
    wireWindowControls();
    wireSettings();
    wireUpdateModal();
    wireContact();
    wireChangelog();

    state.settings = await api.getSettings();
    state.members = (await api.getMembers()) || [];
    render();
    loadSchedule(); // 뱅온은 시작 시 1회 + 이후 1시간마다 재조회
    setInterval(loadSchedule, 60 * 60 * 1000);
    // 시간이 지나며 시작/종료가 바뀌는 것을 앱이 주기적으로 재판정(재요청 없음, 변화 있을 때만 다시 그림)
    setInterval(() => renderSchedule(), 30000);
    // 라이브 카드의 방송 경과 시간 1분마다 갱신(전체 리렌더 없이 텍스트만)
    setInterval(() => {
      document.querySelectorAll('.live-elapsed[data-open]').forEach((el) => {
        el.innerHTML = icon('clock', 12) + ' ' + esc(fmtUptime(+el.dataset.open));
      });
    }, 60000);
    // 릴리스 노트 등 마크다운 링크 클릭 → 외부 브라우저
    document.body.addEventListener('click', (e) => {
      const a = e.target.closest('.md-link');
      if (a) { e.preventDefault(); openLink(a.dataset.url); }
    });

    api.getVersion().then((v) => ($('#appVersion').textContent = 'v' + v));

    api.onMembers((members) => {
      state.members = members || [];
      $('#btnRefresh').querySelector('svg')?.classList.remove('spin');
      render();
      renderSchedule(); // 라이브 상태 변화 반영(내부에서 변화 있을 때만 다시 그림)
      if (!$('#settingsModal').hidden) {
        buildMemberList('#subList', state.settings.subscribed, saveSubscriptions);
        buildMemberList('#autoOpenList', state.settings.autoOpenList, saveAutoOpen);
        updateAutoOpenEnabled();
      }
    });
    api.onPolling((busy) => {
      const svg = $('#btnRefresh').querySelector('svg');
      if (svg) busy ? svg.classList.add('spin') : svg.classList.remove('spin');
    });
    // 방송 시작 → 인앱 플로팅 알림
    api.onLive((live) => {
      (live || []).forEach((m) =>
        showToast({ avatar: m.avatar, accent: m.accent, title: `🔴 ${m.name} 방송 시작`, desc: m.title || '치지직에서 라이브 중', url: m.liveUrl, duration: 7000 }),
      );
    });
    api.onUpdateStatus(handleUpdate);
  }

  window.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();
