const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  Notification,
  shell,
  nativeImage,
  dialog,
} = require('electron');
const updater = require('./updater');
const store = require('./store');
const i18n = require('./i18n');
const { translateBatch } = require('./translate');
const { Poller, MIN_INTERVAL_SEC } = require('./poller');

const APP_ID = 'com.stellastatus.app';
const ICON_PATH = path.join(app.getAppPath(), 'build', 'icon.png');
const isDev = process.argv.includes('--dev') || !app.isPackaged;

let mainWindow = null;
let tray = null;
let isQuitting = false;
const poller = new Poller();

// 윈도우 알림에 앱 이름이 제대로 표시되도록 AppUserModelID 설정
app.setAppUserModelId(APP_ID);

// GPU 셰이더 디스크 캐시가 잠겨(백신 실시간 검사/중복 실행 등) 이동에 실패하면
// "Unable to move the cache (0x5)" / "Gpu Cache Creation failed" 로그가 뜬다(동작엔 무해).
// 디스크 캐시를 쓰지 않게 해 해당 로그를 없앤다.
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu-program-cache');

// 안정성: 예기치 못한 오류로 앱이 강제 종료/오류창이 뜨지 않도록 로깅 후 계속 실행
process.on('uncaughtException', (err) => console.error('메인 예외:', err));
process.on('unhandledRejection', (reason) => console.error('메인 거부:', reason));

// 단일 인스턴스 보장 — 두 번째 실행 시 기존 창을 띄운다.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

// ── 창 ────────────────────────────────────────────────────
function createWindow() {
  const bounds = store.get('windowBounds');
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 940,
    minHeight: 640,
    show: false,
    // macOS: 네이티브 신호등 버튼(좌측 상단)을 쓰되 타이틀바는 숨겨 콘텐츠를 위로 끌어올린다.
    //        (trafficLightPosition 으로 커스텀 타이틀바 높이(--tb-h:44px) 중앙에 맞춘다.)
    // Windows/기타: 프레임을 없애고 우측 커스텀 버튼(min/max/close)을 사용한다.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 14, y: 15 } }
      : { frame: false }),
    backgroundColor: '#0b0a1a',
    icon: ICON_PATH,
    title: '스텔라상태',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    // 부팅 자동 실행(--hidden) 또는 startHidden 설정이면 창을 띄우지 않고 트레이에만 상주
    const startHidden = process.argv.includes('--hidden') || store.get('startHidden');
    if (!startHidden) showWindow();
  });

  // 창 크기/위치 저장
  const saveBounds = () => {
    if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  // 닫기 → 트레이로 최소화(설정에 따라)
  mainWindow.on('close', (e) => {
    if (!isQuitting && store.get('minimizeToTray')) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximized', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized', false));

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

function showWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ── 트레이 ────────────────────────────────────────────────
function createTray() {
  let img = nativeImage.createFromPath(ICON_PATH);
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setToolTip('스텔라상태');
  rebuildTrayMenu([]);
  tray.on('double-click', () => showWindow());
  tray.on('click', () => showWindow());
}

let lastTrayMembers = [];
function rebuildTrayMenu(members) {
  if (!tray) return;
  lastTrayMembers = members; // 언어 변경 시 같은 목록으로 다시 그리기 위해 보관
  const live = members.filter((m) => m.isLive);
  const liveItems = live.length
    ? live.map((m) => ({
        label: `🔴 ${i18n.memberName(m)}  ${m.viewerCount != null ? i18n.t('tray.viewers', { n: m.viewerCount.toLocaleString() }) : ''}`,
        click: () => shell.openExternal(m.liveUrl),
      }))
    : [{ label: i18n.t('tray.noLive'), enabled: false }];

  const menu = Menu.buildFromTemplate([
    { label: i18n.t('tray.header', { n: live.length }), enabled: false },
    { type: 'separator' },
    ...liveItems,
    { type: 'separator' },
    { label: i18n.t('tray.open'), click: () => showWindow() },
    { label: i18n.t('tray.refresh'), click: () => poller.pollOnce() },
    { type: 'separator' },
    { label: i18n.t('tray.quit'), click: () => quitApp() },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(i18n.t('tray.tooltip', { n: live.length }));
}

function quitApp() {
  isQuitting = true;
  poller.stop();
  app.quit();
}

// ── 알림 ──────────────────────────────────────────────────
function isSubscribed(key) {
  const subs = store.get('subscribed');
  return subs == null || (Array.isArray(subs) && subs.includes(key));
}

function maybeAutoOpen(member) {
  if (!store.get('autoOpenLive')) return;
  const list = store.get('autoOpenList'); // null = 전체
  if (Array.isArray(list) && !list.includes(member.key)) return;
  if (member.liveUrl) shell.openExternal(member.liveUrl);
}

function notifyLive(member) {
  if (!store.get('notifyEnabled')) return;
  if (!isSubscribed(member.key)) return;
  if (!Notification.isSupported()) return;

  const n = new Notification({
    title: i18n.t('notify.liveTitle', { name: i18n.memberName(member) }),
    body: member.title || i18n.t('notify.liveBody'),
    icon: ICON_PATH,
    silent: false,
  });
  n.on('click', () => shell.openExternal(member.liveUrl));
  n.show();
}

// ── 자동 업데이트 ─────────────────────────────────────────
let lastNotifiedUpdate = null;

function notifyUpdate(info) {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: i18n.t('notify.updTitle', { v: info.version }),
    body: info.mandatory ? i18n.t('notify.updBodyReq') : i18n.t('notify.updBody'),
    icon: ICON_PATH,
    silent: false,
  });
  n.on('click', () => showWindow());
  n.show();
}

function setupAutoUpdater() {
  updater.init((payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('update:status', payload);
    // 업데이트가 감지되면 윈도우 알림(버전당 1회)
    if (payload.state === 'available' && payload.version && payload.version !== lastNotifiedUpdate) {
      lastNotifiedUpdate = payload.version;
      notifyUpdate(payload);
    }
    // 필수(강제) 업데이트는 트레이에 숨어 있어도 창을 띄워 안내가 반드시 보이도록 한다.
    if (payload.state === 'available' && payload.mandatory) showWindow();
  });

  if (!isDev) {
    updater.check({ manual: false });
    setInterval(() => updater.check({ manual: false }), 6 * 60 * 60 * 1000);
  }
}

// ── 자동 실행(로그인 시) ──────────────────────────────────
function applyLaunchAtStartup(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: ['--hidden'],
  });
}

// ── IPC ───────────────────────────────────────────────────
function registerIpc() {
  ipcMain.handle('members:get', () => poller.members);
  ipcMain.handle('members:refresh', () => poller.pollOnce());

  ipcMain.handle('settings:get', () => store.store);
  ipcMain.handle('settings:set', (_e, patch) => {
    const before = store.store;
    store.set(patch);
    if ('pollIntervalSec' in patch) poller.setInterval(patch.pollIntervalSec);
    if ('launchAtStartup' in patch && patch.launchAtStartup !== before.launchAtStartup) {
      applyLaunchAtStartup(patch.launchAtStartup);
    }
    // 언어가 바뀌면 트레이 메뉴/툴팁을 새 언어로 다시 그린다(알림은 표시 시점에 현재 언어 사용).
    if ('language' in patch && patch.language !== before.language) {
      rebuildTrayMenu(lastTrayMembers);
    }
    return store.store;
  });

  // 방송 제목 번역(베스트 에포트). 렌더러가 en/ja 일 때만 호출한다.
  ipcMain.handle('i18n:translate', async (_e, payload) => {
    try { return await translateBatch(payload?.texts, payload?.target); }
    catch { return {}; }
  });

  ipcMain.handle('schedule:today', async () => {
    try {
      return await poller.client.schedule.getSchedulesByDate();
    } catch (e) {
      return { error: String(e?.message || e) };
    }
  });
  ipcMain.handle('schedule:artist', async (_e, key) => {
    try {
      return await poller.client.schedule.getArtistSchedule(key);
    } catch (e) {
      return { error: String(e?.message || e) };
    }
  });

  ipcMain.handle('open:external', (_e, url) => {
    if (typeof url === 'string' && /^(https?:\/\/|mailto:)/.test(url)) shell.openExternal(url);
  });

  ipcMain.handle('update:check', () => {
    if (isDev) {
      // 개발 모드(패키징 전)에서는 업데이트를 확인할 수 없다.
      mainWindow?.webContents.send('update:status', { state: 'dev' });
      return;
    }
    updater.check({ manual: true });
  });
  // [설치하기] — 일반 업데이트는 이때 비로소 다운로드하고, 복사/설치는 인스톨러에 넘긴다.
  // (isQuitting 은 실제 설치 실행 시 app.quit → before-quit 에서 설정된다.
  //  다운로드가 실패해 설치로 넘어가지 않으면 앱은 계속 트레이에 상주한다.)
  ipcMain.handle('update:install', () => {
    updater.downloadAndInstall();
  });

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:changelog', () => updater.getReleases());

  // 앱 제거 — 설치 폴더의 제거 프로그램 실행
  ipcMain.handle('app:uninstall', async () => {
    const uninstaller = path.join(path.dirname(process.execPath), '스텔라상태 제거.exe');
    if (isDev || !fs.existsSync(uninstaller)) {
      await dialog.showMessageBox(mainWindow, {
        type: 'info', title: '제거', message: '제거 프로그램을 찾을 수 없습니다.',
        detail: '정식 설치본에서만 제거할 수 있습니다.',
      });
      return;
    }
    const r = await dialog.showMessageBox(mainWindow, {
      type: 'warning', buttons: ['제거', '취소'], defaultId: 1, cancelId: 1,
      title: '스텔라상태 제거', message: '스텔라상태를 제거할까요?',
      detail: '설치된 파일과 바로가기가 삭제됩니다.',
    });
    if (r.response === 0) {
      spawn(uninstaller, ['--uninstall'], { detached: true, stdio: 'ignore' }).unref();
      isQuitting = true;
      app.quit();
    }
  });

  // 커스텀 타이틀바 창 제어
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:maximize-toggle', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.on('window:hide', () => mainWindow?.hide());
}

// ── 앱 수명주기 ───────────────────────────────────────────
app.whenReady().then(async () => {
  registerIpc();
  createWindow();
  createTray();

  // 로그인 시 자동 실행 설정 반영
  applyLaunchAtStartup(store.get('launchAtStartup'));

  // 폴러 이벤트 연결
  poller.on('update', (members) => {
    rebuildTrayMenu(members);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('members:update', members);
    }
  });
  poller.on('transitions', ({ wentLive }) => {
    wentLive.forEach((m) => {
      notifyLive(m);
      maybeAutoOpen(m);
    });
    // 앱이 열려 있으면 인앱 플로팅 알림도 함께 표시
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('members:live', wentLive);
    }
  });
  poller.on('polling', (busy) => {
    mainWindow?.webContents.send('members:polling', busy);
  });
  poller.on('error', (err) => {
    mainWindow?.webContents.send('members:error', String(err?.message || err));
  });

  await poller.init().catch(() => {});
  poller.start(store.get('pollIntervalSec'));

  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on('window-all-closed', () => {
  // 트레이 상주 앱이므로 창이 모두 닫혀도 종료하지 않는다(트레이 최소화 시).
  if (!store.get('minimizeToTray')) quitApp();
});

app.on('before-quit', () => {
  isQuitting = true;
});
