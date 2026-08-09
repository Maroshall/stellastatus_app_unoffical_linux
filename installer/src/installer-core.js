// 스텔라상태 커스텀 인스톨러 — 설치/제거 핵심 로직 (per-user, 관리자 권한 불필요)
const { app, shell } = require('electron');
// original-fs 는 Electron 의 asar 패치가 적용되지 않은 원본 fs.
// 이걸 써야 app.asar 를 (가상 폴더가 아니라) 파일 하나로 복사한다.
const fs = require('original-fs');
const fsp = fs.promises;
const path = require('path');
const { execFile } = require('child_process');

const APP_NAME = '스텔라상태';
const APP_EXE = '스텔라상태.exe';
const UNINSTALL_EXE = '스텔라상태 제거.exe';
const PUBLISHER = '스텔라리움';
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\StellaStatus';

// 배포 시 payload(앱 본체)는 리소스로 동봉된다. 개발 중엔 STELLA_PAYLOAD 로 지정 가능.
function payloadDir() {
  if (process.env.STELLA_PAYLOAD) return process.env.STELLA_PAYLOAD;
  return path.join(process.resourcesPath || app.getAppPath(), 'payload');
}

function defaultInstallDir() {
  const base = process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local');
  return path.join(base, 'Programs', APP_NAME);
}

// 실제 실행된 setup exe 경로(portable). 제거 프로그램으로 복사하기 위함.
function selfExe() {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
}

async function listFiles(dir) {
  const out = [];
  async function walk(d) {
    const entries = await fsp.readdir(d, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push(full);
    }
  }
  await walk(dir);
  return out;
}

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout) => resolve({ err, stdout }));
  });
}

// ── 설치 ─────────────────────────────────────
async function install({ targetDir, desktopShortcut = true, startMenuShortcut = true, update = false, onProgress = () => {} }) {
  const src = payloadDir();
  if (!fs.existsSync(src)) throw new Error('설치할 앱 데이터를 찾을 수 없습니다: ' + src);
  const dest = targetDir || defaultInstallDir();

  onProgress({ phase: 'prepare', percent: 0, text: update ? '업데이트를 준비하는 중…' : '설치를 준비하는 중…' });

  // 실행 중인 앱 종료(재설치 시 파일 잠금 방지)
  await run('taskkill', ['/F', '/IM', APP_EXE, '/T']);

  const files = await listFiles(src);
  const total = files.length || 1;
  await fsp.mkdir(dest, { recursive: true });

  let done = 0;
  for (const file of files) {
    const rel = path.relative(src, file);
    const to = path.join(dest, rel);
    await fsp.mkdir(path.dirname(to), { recursive: true });
    await fsp.copyFile(file, to);
    done += 1;
    if (done % 5 === 0 || done === total) {
      onProgress({ phase: 'copy', percent: Math.round((done / total) * 92), text: `파일 복사 중… (${done}/${total})` });
    }
  }

  // 제거 프로그램(현재 setup exe) 복사
  onProgress({ phase: 'register', percent: 94, text: '바로가기와 등록 정보를 만드는 중…' });
  const uninstallerPath = path.join(dest, UNINSTALL_EXE);
  try { await fsp.copyFile(selfExe(), uninstallerPath); } catch { /* portable 아닌 경우 무시 */ }

  const exePath = path.join(dest, APP_EXE);
  const iconPath = exePath;

  // 바로가기 (업데이트 시엔 기존 것을 유지하고 새로 만들지 않음)
  if (!update) {
    if (desktopShortcut) writeShortcut(path.join(app.getPath('desktop'), `${APP_NAME}.lnk`), exePath, iconPath);
    if (startMenuShortcut) {
      const startDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      await fsp.mkdir(startDir, { recursive: true });
      writeShortcut(path.join(startDir, `${APP_NAME}.lnk`), exePath, iconPath);
    }
  }

  // 언인스톨 레지스트리(제어판 프로그램 목록) — 버전 갱신 포함
  await writeUninstallRegistry(dest, uninstallerPath, exePath);

  onProgress({ phase: 'done', percent: 100, text: update ? '업데이트가 완료되었습니다.' : '설치가 완료되었습니다.' });
  return { installDir: dest, exePath };
}

function writeShortcut(linkPath, target, icon, args) {
  try {
    shell.writeShortcutLink(linkPath, 'create', {
      target,
      args: args || '',
      cwd: path.dirname(target),
      icon,
      iconIndex: 0,
      description: APP_NAME,
    });
  } catch (e) {
    /* 바로가기 실패는 치명적이지 않음 */
  }
}

async function dirSizeKB(dir) {
  try {
    const files = await listFiles(dir);
    let bytes = 0;
    for (const f of files) { try { bytes += (await fsp.stat(f)).size; } catch {} }
    return Math.round(bytes / 1024);
  } catch { return 0; }
}

async function writeUninstallRegistry(installDir, uninstallerPath, exePath) {
  const version = app.getVersion();
  const sizeKB = await dirSizeKB(installDir);
  const set = (name, type, value) => run('reg', ['add', UNINSTALL_KEY, '/v', name, '/t', type, '/d', String(value), '/f']);
  await set('DisplayName', 'REG_SZ', APP_NAME);
  await set('DisplayVersion', 'REG_SZ', version);
  await set('Publisher', 'REG_SZ', PUBLISHER);
  await set('DisplayIcon', 'REG_SZ', exePath);
  await set('InstallLocation', 'REG_SZ', installDir);
  await set('UninstallString', 'REG_SZ', `"${uninstallerPath}" --uninstall`);
  await set('EstimatedSize', 'REG_DWORD', sizeKB);
  await set('NoModify', 'REG_DWORD', 1);
  await set('NoRepair', 'REG_DWORD', 1);
}

function launch(exePath) {
  const { spawn } = require('child_process');
  spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
}

// ── 제거 ─────────────────────────────────────
async function uninstall({ onProgress = () => {} } = {}) {
  onProgress({ phase: 'prepare', percent: 5, text: '제거를 준비하는 중…' });
  await run('taskkill', ['/F', '/IM', APP_EXE, '/T']);

  // 설치 위치 파악
  const q = await run('reg', ['query', UNINSTALL_KEY, '/v', 'InstallLocation']);
  let installDir = defaultInstallDir();
  const m = /InstallLocation\s+REG_SZ\s+(.+)/.exec(q.stdout || '');
  if (m) installDir = m[1].trim();

  onProgress({ phase: 'remove', percent: 40, text: '파일을 삭제하는 중…' });
  // 바로가기 제거
  try { await fsp.rm(path.join(app.getPath('desktop'), `${APP_NAME}.lnk`), { force: true }); } catch {}
  try { await fsp.rm(path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_NAME}.lnk`), { force: true }); } catch {}
  // 레지스트리 제거
  await run('reg', ['delete', UNINSTALL_KEY, '/f']);

  onProgress({ phase: 'remove', percent: 70, text: '설치 폴더를 정리하는 중…' });
  // 설치 폴더 삭제(자기 자신=제거 exe 는 나중에 정리)
  try {
    const entries = await fsp.readdir(installDir);
    for (const name of entries) {
      if (name === UNINSTALL_EXE) continue;
      await fsp.rm(path.join(installDir, name), { recursive: true, force: true });
    }
  } catch {}

  // 제거 exe 자신은 재부팅 후 삭제되도록 예약(간단히: 배치로 지연 삭제)
  scheduleSelfDelete(installDir);

  onProgress({ phase: 'done', percent: 100, text: '제거가 완료되었습니다.' });
  return { installDir };
}

function scheduleSelfDelete(installDir) {
  try {
    const bat = path.join(require('os').tmpdir(), 'stella_uninstall_cleanup.bat');
    const content =
      '@echo off\r\n' +
      'ping 127.0.0.1 -n 3 > nul\r\n' +
      `rmdir /s /q "${installDir}"\r\n` +
      `del "%~f0"\r\n`;
    fs.writeFileSync(bat, content);
    const { spawn } = require('child_process');
    spawn('cmd', ['/c', bat], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  } catch {}
}

module.exports = { install, uninstall, defaultInstallDir, launch, APP_NAME };
