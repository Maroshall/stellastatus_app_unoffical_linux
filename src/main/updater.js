// 자체 업데이터 — GitHub Releases 를 확인해 새 버전의 Setup.exe 를 받아 실행한다.
// (커스텀 인스톨러를 쓰므로 electron-updater 대신 사용)
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, shell } = require('electron');
const { spawn } = require('child_process');

let OWNER = '';
let REPO = '';
try {
  const pkg = require('../../package.json');
  const m = /github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/.exec(pkg.repository?.url || '');
  if (m) { OWNER = m[1]; REPO = m[2]; }
} catch { /* ignore */ }

let emit = () => {};
let downloadedPath = null;

function init(emitter) { emit = emitter || (() => {}); }

function ghGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'stellastatus', Accept: 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(ghGet(res.headers.location));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('GitHub HTTP ' + res.statusCode)); }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function cmpVersion(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number);
  const pb = String(b).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return 1; if ((pa[i] || 0) < (pb[i] || 0)) return -1; }
  return 0;
}

function download(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'stellastatus' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(download(res.headers.location, dest, onProgress));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('다운로드 실패 HTTP ' + res.statusCode)); }
      const total = Number(res.headers['content-length'] || 0);
      let got = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', (c) => { got += c.length; if (total) onProgress(Math.round((got / total) * 100)); });
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve(dest)));
      file.on('error', reject);
    }).on('error', reject);
  });
}

// 릴리스 노트에 <!-- force-update --> 마커가 있으면 강제(취소 불가) 업데이트로 처리
function isMandatory(body) {
  return /<!--\s*force-?update\s*-->/i.test(body || '');
}

// 최신 릴리스 확인 → 새 버전이면 자동 다운로드까지 진행
async function check({ manual = false } = {}) {
  if (!OWNER || OWNER === 'YOUR_GITHUB_USERNAME' || !REPO) {
    emit({ state: manual ? 'error' : 'none', message: '배포 저장소가 설정되지 않았습니다.' });
    return;
  }
  try {
    emit({ state: 'checking' });
    const rel = await ghGet(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`);
    const latest = rel.tag_name || rel.name || '0.0.0';
    if (cmpVersion(latest, app.getVersion()) <= 0) { emit({ state: 'none' }); return; }

    const asset = (rel.assets || []).find((a) => /Setup.*\.exe$/i.test(a.name) || /\.exe$/i.test(a.name));
    if (!asset) { emit({ state: 'error', message: '설치 파일을 찾을 수 없습니다.' }); return; }

    const info = {
      version: String(latest).replace(/^v/, ''),
      mandatory: isMandatory(rel.body),
      notes: (rel.body || '').replace(/<!--[\s\S]*?-->/g, '').trim(),
      repo: `${OWNER}/${REPO}`,
      htmlUrl: rel.html_url || `https://github.com/${OWNER}/${REPO}/releases/latest`,
    };

    emit({ state: 'available', ...info });
    const dest = path.join(os.tmpdir(), asset.name);
    await download(asset.browser_download_url, dest, (percent) => emit({ state: 'downloading', percent }));
    downloadedPath = dest;
    emit({ state: 'downloaded', ...info });
  } catch (e) {
    emit({ state: 'error', message: String(e?.message || e) });
  }
}

// 받은 Setup.exe 를 '업데이트(무인) 모드'로 실행 → 기존 설치 위치에 제자리 덮어쓰기 후 재실행
function runInstaller() {
  if (!downloadedPath || !fs.existsSync(downloadedPath)) {
    shell.openExternal(`https://github.com/${OWNER}/${REPO}/releases/latest`);
    return;
  }
  const installDir = path.dirname(process.execPath);
  spawn(downloadedPath, ['--update', '--dir', installDir], { detached: true, stdio: 'ignore' }).unref();
  setTimeout(() => app.quit(), 400);
}

// 업데이트 기록(릴리스 목록)
async function getReleases() {
  if (!OWNER || OWNER === 'YOUR_GITHUB_USERNAME' || !REPO) return [];
  try {
    const list = await ghGet(`https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=20`);
    if (!Array.isArray(list)) return [];
    return list
      .filter((r) => !r.draft)
      .map((r) => ({
        version: String(r.tag_name || r.name || '').replace(/^v/, ''),
        notes: (r.body || '').replace(/<!--[\s\S]*?-->/g, '').trim(),
        date: (r.published_at || r.created_at || '').slice(0, 10),
        htmlUrl: r.html_url,
      }));
  } catch {
    return [];
  }
}

module.exports = { init, check, runInstaller, getReleases };
