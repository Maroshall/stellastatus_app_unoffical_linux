(() => {
  const api = window.setup;
  const $ = (s) => document.querySelector(s);

  const state = { mode: 'install', step: 'welcome', dir: '', exePath: '', appName: '스텔라상태', version: '' };

  // 아이콘 팩(Lucide, MIT)
  const ICONS = {
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  };
  function icon(name, size = 18, draw = false) {
    const p = ICONS[name];
    if (!p) return '';
    return `<svg class="${draw ? 'ic-draw' : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }
  const setIcon = (sel, name, size) => { const el = $(sel); if (el) el.innerHTML = icon(name, size); };

  const INSTALL_STEPS = [
    { key: 'welcome', label: '시작' },
    { key: 'terms', label: '이용약관' },
    { key: 'location', label: '설치 위치' },
    { key: 'progress', label: '설치 중' },
    { key: 'finish', label: '완료' },
  ];
  const UNINSTALL_STEPS = [
    { key: 'welcome', label: '시작' },
    { key: 'progress', label: '제거 중' },
    { key: 'finish', label: '완료' },
  ];
  const steps = () => (state.mode === 'uninstall' ? UNINSTALL_STEPS : INSTALL_STEPS);

  function renderSteps() {
    const host = $('#steps');
    const list = steps();
    const curIdx = list.findIndex((s) => s.key === state.step);
    host.innerHTML = '';
    list.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = 'step' + (i === curIdx ? ' active' : '') + (i < curIdx ? ' done' : '');
      el.innerHTML = `<span class="num">${i < curIdx ? icon('check', 14) : i + 1}</span><span>${s.label}</span>`;
      host.appendChild(el);
    });
  }

  function show(step) {
    state.step = step;
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.dataset.step !== step));
    if (step === 'finish') $('#doneBadge').innerHTML = icon('check', 30, true); // 완료 체크 그려지는 애니메이션
    renderSteps();
    updateButtons();
  }

  function updateButtons() {
    const back = $('#btnBack'), next = $('#btnNext'), cancel = $('#btnCancel');
    back.hidden = true; next.hidden = false; cancel.hidden = false; next.disabled = false;
    if (state.mode === 'uninstall') {
      if (state.step === 'welcome') { next.textContent = '제거'; }
      else if (state.step === 'progress') { next.hidden = true; cancel.hidden = true; }
      else if (state.step === 'finish') { next.textContent = '완료'; cancel.hidden = true; }
      return;
    }
    if (state.step === 'welcome') { next.textContent = '다음'; }
    else if (state.step === 'terms') { back.hidden = false; next.textContent = '다음'; next.disabled = !$('#optAgree').checked; }
    else if (state.step === 'location') { back.hidden = false; next.textContent = '설치'; }
    else if (state.step === 'progress') { next.hidden = true; cancel.hidden = true; }
    else if (state.step === 'finish') { next.textContent = '완료'; cancel.hidden = true; }
  }

  // ── 흐름 ─────────────────────────────────────
  async function onNext() {
    if (state.mode === 'uninstall') {
      if (state.step === 'welcome') return doUninstall();
      if (state.step === 'finish') return api.close();
      return;
    }
    if (state.step === 'welcome') return show('terms');
    if (state.step === 'terms') return $('#optAgree').checked && show('location');
    if (state.step === 'location') return doInstall();
    if (state.step === 'finish') return finishInstall();
  }

  async function doInstall() {
    show('progress');
    const res = await api.install({
      targetDir: state.dir,
      desktopShortcut: $('#optDesktop').checked,
      startMenuShortcut: $('#optStart').checked,
    });
    if (!res.ok) {
      $('#progTitle').textContent = '설치 실패';
      $('#progText').textContent = res.error || '알 수 없는 오류';
      return;
    }
    state.exePath = res.exePath;
    show('finish');
  }

  function finishInstall() {
    if ($('#optRun').checked && state.exePath) api.launch(state.exePath);
    api.close();
  }

  async function doUninstall() {
    show('progress');
    $('#progTitle').textContent = '제거하는 중…';
    const res = await api.uninstall();
    $('#finishTitle').textContent = '제거 완료';
    $('#finishDesc').innerHTML = res.ok ? '스텔라상태가 제거되었습니다.' : (res.error || '제거 중 오류가 발생했습니다.');
    $('#runRow').hidden = true;
    $('#doneBadge').style.display = res.ok ? '' : 'none';
    show('finish');
  }

  // ── 이벤트 ───────────────────────────────────
  $('#btnNext').addEventListener('click', onNext);
  $('#btnBack').addEventListener('click', () => {
    if (state.step === 'terms') show('welcome');
    else if (state.step === 'location') show('terms');
  });
  $('#optAgree').addEventListener('change', updateButtons);
  $('#btnCancel').addEventListener('click', () => api.close());
  $('#btnClose').addEventListener('click', () => api.close());
  setIcon('#btnMin', 'minus', 14);
  setIcon('#btnClose', 'x', 14);
  $('#btnBrowse').innerHTML = icon('folder', 15) + ' 찾아보기';
  $('#btnMin').addEventListener('click', () => api.minimize());
  $('#madeBy').addEventListener('click', () => api.openExternal('https://github.com'));
  $('#btnBrowse').addEventListener('click', async () => {
    const d = await api.chooseDir();
    if (d) { state.dir = d.endsWith(state.appName) ? d : `${d}\\${state.appName}`; $('#pathInput').value = state.dir; }
  });

  api.onProgress((p) => {
    $('#barFill').style.width = (p.percent || 0) + '%';
    $('#progText').textContent = p.text || '';
    if (state.mode === 'uninstall') $('#progTitle').textContent = '제거하는 중…';
    else if (state.mode === 'update') $('#progTitle').textContent = p.phase === 'done' ? '업데이트 완료' : '업데이트하는 중…';
    else $('#progTitle').textContent = p.phase === 'done' ? '설치 완료' : '설치하는 중…';
  });

  // 업데이트(무인) 모드 — 기존 설치 위치에 제자리 덮어쓰기 후 재실행
  async function runUpdate() {
    $('#progTitle').textContent = '업데이트하는 중…';
    show('progress');
    const res = await api.install({ targetDir: state.dir, desktopShortcut: false, startMenuShortcut: false, update: true });
    if (!res.ok) {
      $('#progTitle').textContent = '업데이트 실패';
      $('#progText').textContent = res.error || '알 수 없는 오류';
      return;
    }
    $('#progTitle').textContent = '업데이트 완료';
    $('#progText').textContent = '새 버전을 실행합니다…';
    api.launch(res.exePath);
    setTimeout(() => api.close(), 900);
  }

  api.onBoot((b) => {
    state.mode = b.mode;
    state.appName = b.appName || '스텔라상태';
    state.version = b.version || '';
    state.dir = b.defaultDir || '';
    $('#pathInput').value = state.dir;
    $('#verText').textContent = 'v' + state.version;
    if (b.mode === 'update') {
      document.body.classList.add('update-mode');
      state.dir = b.targetDir || b.defaultDir || '';
      runUpdate();
      return;
    }
    if (b.mode === 'uninstall') {
      $('#sideSub').textContent = '제거';
      $('.panel[data-step="welcome"] .p-title').textContent = '스텔라상태 제거';
      $('.panel[data-step="welcome"] .p-desc').innerHTML = '스텔라상태를 컴퓨터에서 제거합니다.<br>설치된 파일과 바로가기가 삭제됩니다.';
      $('.panel[data-step="welcome"] .feature').style.display = 'none';
      $('.panel[data-step="welcome"] .p-hint').textContent = '[제거]를 누르면 제거를 시작합니다.';
    }
    show('welcome');
  });

  // preload boot 가 이미 왔을 수도 있으니 기본 렌더
  renderSteps();
  updateButtons();
})();
