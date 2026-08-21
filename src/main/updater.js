// Linux용 자체 업데이터
// GitHub Releases에서 새 AppImage를 확인하고 다운로드한다.
//
// Linux에서는 Windows의 Setup.exe 같은 설치 프로그램을 사용하지 않는다.
// 새 AppImage를 다운로드한 뒤 사용자가 새 파일을 실행할 수 있도록
// 다운로드 위치를 열어준다.
//
// (커스텀 인스톨러를 사용하지 않으므로 electron-updater 대신 자체 구현)

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { app, shell } = require('electron');
const store = require('./store');

// 버전 문자열이 베타(4자리, 예: 1.0.5.1)인지 확인
function isBetaVersion(v) {
  return String(v || '')
    .replace(/^v/, '')
    .split('.')
    .filter((s) => s !== '')
    .length >= 4;
}

// 베타 채널 사용 여부
function wantsBeta() {
  try {
    if (store.get('betaChannel')) return true;
  } catch {
    // ignore
  }

  return isBetaVersion(currentVersion());
}

// package.json의 GitHub 저장소 정보 사용
let OWNER = '';
let REPO = '';

try {
  const pkg = require('../../package.json');

  const m = /github\.com[/:]([^/]+)\/([^/.]+)(\.git)?/.exec(
    pkg.repository?.url || ''
  );

  if (m) {
    OWNER = m[1];
    REPO = m[2];
  }
} catch {
  // ignore
}

// 현재 앱 버전
function currentVersion() {
  try {
    const pkg = require('../../package.json');

    return pkg.fullVersion || pkg.version || app.getVersion();
  } catch {
    return app.getVersion();
  }
}

let emit = () => {};
let downloadedPath = null;

// 다운로드 대기 중인 업데이트
let pendingDownload = null;

// 초기화
function init(emitter) {
  emit = emitter || (() => {});
}

// GitHub API GET
function ghGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'StellaStatus-Linux',
            Accept: 'application/vnd.github+json',
          },
        },
        (res) => {
          // Redirect
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            res.resume();
            return resolve(ghGet(res.headers.location));
          }

          if (res.statusCode !== 200) {
            res.resume();
            return reject(
              new Error(`GitHub HTTP ${res.statusCode}`)
            );
          }

          const chunks = [];

          res.on('data', (chunk) => {
            chunks.push(chunk);
          });

          res.on('end', () => {
            try {
              const data = JSON.parse(
                Buffer.concat(chunks).toString('utf8')
              );

              resolve(data);
            } catch (e) {
              reject(e);
            }
          });
        }
      )
      .on('error', reject);
  });
}

// 버전 비교
//
// 예:
// 1.0.6 > 1.0.5
// 1.0.5.1 > 1.0.5
function cmpVersion(a, b) {
  const pa = String(a)
    .replace(/^v/, '')
    .split('.')
    .map(Number);

  const pb = String(b)
    .replace(/^v/, '')
    .split('.')
    .map(Number);

  const len = Math.max(pa.length, pb.length);

  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;

    if (x > y) return 1;
    if (x < y) return -1;
  }

  return 0;
}

// 파일 다운로드
function download(url, dest, onProgress) {
  const tmp = `${dest}.part`;

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'StellaStatus-Linux',
        },
      },
      (res) => {
        req.setTimeout(0);

        // Redirect
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();

          return resolve(
            download(res.headers.location, dest, onProgress)
          );
        }

        if (res.statusCode !== 200) {
          res.resume();

          return reject(
            new Error(`다운로드 실패 HTTP ${res.statusCode}`)
          );
        }

        const total = Number(
          res.headers['content-length'] || 0
        );

        let got = 0;
        let settled = false;
        let stall = null;

        const file = fs.createWriteStream(tmp);

        const fail = (err) => {
          if (settled) return;

          settled = true;

          clearTimeout(stall);

          try {
            res.destroy();
          } catch {
            // ignore
          }

          try {
            file.destroy();
          } catch {
            // ignore
          }

          fs.unlink(tmp, () => reject(err));
        };

        // 90초 동안 데이터가 전혀 없으면 실패
        const bumpStall = () => {
          clearTimeout(stall);

          stall = setTimeout(() => {
            fail(
              new Error(
                '다운로드가 멈췄습니다(응답 없음).'
              )
            );
          }, 90000);
        };

        res.on('error', fail);
        file.on('error', fail);

        res.on('data', (chunk) => {
          got += chunk.length;

          bumpStall();

          if (total && typeof onProgress === 'function') {
            onProgress(
              Math.round((got / total) * 100)
            );
          }
        });

        res.pipe(file);

        file.on('finish', () => {
          if (settled) return;

          settled = true;

          clearTimeout(stall);

          file.close(() => {
            // 기존 파일 삭제 후 .part를 최종 파일로 변경
            fs.rm(
              dest,
              { force: true },
              () => {
                fs.rename(
                  tmp,
                  dest,
                  (err) => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve(dest);
                    }
                  }
                );
              }
            );
          });
        });

        bumpStall();
      }
    );

    req.on('error', reject);

    // 최초 연결 타임아웃
    req.setTimeout(30000, () => {
      req.destroy(
        new Error(
          '서버에 연결하지 못했습니다.'
        )
      );
    });
  });
}

// Release 설명에 강제 업데이트 마커가 있는지 확인
function isMandatory(body) {
  return /<!--\s*force-?update\s*-->/i.test(
    body || ''
  );
}

// 업데이트 대상 Release 선택
async function fetchTargetRelease(beta) {
  // 정식 버전
  if (!beta) {
    return ghGet(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`
    );
  }

  // 베타 버전
  const list = await ghGet(
    `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=30`
  );

  if (!Array.isArray(list)) {
    return null;
  }

  const candidates = list.filter(
    (release) => !release.draft
  );

  if (!candidates.length) {
    return null;
  }

  return candidates.reduce((best, release) => {
    const bestVersion =
      best.tag_name || best.name || '0';

    const releaseVersion =
      release.tag_name || release.name || '0';

    return cmpVersion(
      releaseVersion,
      bestVersion
    ) > 0
      ? release
      : best;
  });
}

// 최신 Linux AppImage 확인
async function check({ manual = false } = {}) {
  if (
    !OWNER ||
    OWNER === 'YOUR_GITHUB_USERNAME' ||
    !REPO
  ) {
    emit({
      state: manual ? 'error' : 'none',
      message: '배포 저장소가 설정되지 않았습니다.',
    });

    return;
  }

  try {
    emit({
      state: 'checking',
    });

    const beta = wantsBeta();

    const release =
      await fetchTargetRelease(beta);

    if (!release) {
      emit({
        state: 'none',
      });

      return;
    }

    const latest =
      release.tag_name ||
      release.name ||
      '0.0.0';

    // 현재 버전보다 같거나 낮으면 업데이트 없음
    if (
      cmpVersion(
        latest,
        currentVersion()
      ) <= 0
    ) {
      emit({
        state: 'none',
      });

      return;
    }

    // ─────────────────────────────────────
    // Linux AppImage 선택
    // ─────────────────────────────────────

    const assets =
      release.assets || [];

    // 현재 Linux 빌드는 x64 AppImage만 생성하므로
    // x64 이름이 있다면 우선 선택한다.
    const appImages = assets.filter(
      (asset) =>
        /\.AppImage$/i.test(asset.name)
    );

    let asset = null;

    if (process.arch === 'x64') {
      asset =
        appImages.find((a) =>
          /(x64|amd64)/i.test(a.name)
        ) || appImages[0];
    } else if (process.arch === 'arm64') {
      asset =
        appImages.find((a) =>
          /(arm64|aarch64)/i.test(a.name)
        );
    } else {
      asset = appImages[0];
    }

    if (!asset) {
      emit({
        state: 'error',
        message:
          'Linux AppImage 업데이트 파일을 찾을 수 없습니다.',
      });

      return;
    }

    const info = {
      version: String(latest).replace(/^v/, ''),
      mandatory: isMandatory(
        release.body
      ),
      beta: !!release.prerelease,

      notes: (release.body || '')
        .replace(
          /<!--(?!\s*i18n:)[\s\S]*?-->/g,
          ''
        )
        .trim(),

      repo: `${OWNER}/${REPO}`,

      htmlUrl:
        release.html_url ||
        `https://github.com/${OWNER}/${REPO}/releases/latest`,
    };

    pendingDownload = {
      url: asset.browser_download_url,
      name: asset.name,
      info,
    };

    downloadedPath = null;

    emit({
      state: 'available',
      ...info,
    });

    // 강제 업데이트면 즉시 다운로드
    if (info.mandatory) {
      await downloadPending();
    }
  } catch (e) {
    emit({
      state: 'error',
      message: String(
        e?.message || e
      ),
    });
  }
}

// 업데이트 파일 다운로드
async function downloadPending() {
  if (!pendingDownload) {
    throw new Error(
      '내려받을 업데이트 정보가 없습니다.'
    );
  }

  const {
    url,
    name,
    info,
  } = pendingDownload;

  // Linux 임시 디렉터리
  const dest = path.join(
    os.tmpdir(),
    name
  );

  emit({
    state: 'downloading',
    percent: 0,
    ...info,
  });

  // 최대 3회 재시도
  const MAX = 3;

  let lastError;

  for (
    let attempt = 1;
    attempt <= MAX;
    attempt++
  ) {
    try {
      await download(
        url,
        dest,
        (percent) => {
          emit({
            state: 'downloading',
            percent,
          });
        }
      );

      downloadedPath = dest;

      // AppImage 실행 권한 부여
      try {
        fs.chmodSync(
          downloadedPath,
          0o755
        );
      } catch {
        // chmod 실패 시에도 계속 진행
      }

      emit({
        state: 'downloaded',
        ...info,
      });

      return;
    } catch (e) {
      lastError = e;

      if (attempt >= MAX) {
        break;
      }

      emit({
        state: 'downloading',
        percent: 0,
        ...info,
      });

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            1500 * attempt
          )
      );
    }
  }

  throw lastError;
}

// [설치하기] 클릭
async function downloadAndInstall() {
  try {
    if (
      !downloadedPath ||
      !fs.existsSync(downloadedPath)
    ) {
      await downloadPending();
    }

    runInstaller();
  } catch (e) {
    // 다운로드 실패 시 GitHub Release 페이지 열기
    const url =
      pendingDownload?.url ||
      `https://github.com/${OWNER}/${REPO}/releases/latest`;

    try {
      shell.openExternal(url);
    } catch {
      // ignore
    }

    emit({
      state: 'manual-download',
      message: String(
        e?.message || e
      ),
    });
  }
}

// 다운로드된 Linux AppImage 실행
function runInstaller() {
  if (
    !downloadedPath ||
    !fs.existsSync(downloadedPath)
  ) {
    shell.openExternal(
      `https://github.com/${OWNER}/${REPO}/releases/latest`
    );

    return;
  }

  // AppImage 실행 권한 보장
  try {
    fs.chmodSync(
      downloadedPath,
      0o755
    );
  } catch {
    // ignore
  }

  // Linux AppImage는 현재 실행 중인 AppImage를
  // 자기 자신이 덮어쓸 수 없으므로,
  // 새 AppImage를 별도로 실행한다.
  //
  // 새 버전이 실행되면 기존 앱을 종료한다.
  try {
    const { spawn } =
      require('child_process');

    const child = spawn(
      downloadedPath,
      [],
      {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(
          downloadedPath
        ),
      }
    );

    child.unref();

    emit({
      state: 'installing',
    });

    // 새 AppImage가 시작할 시간을 준 뒤 기존 앱 종료
    setTimeout(() => {
      app.quit();
    }, 1500);
  } catch (e) {
    // 실행 실패 시 파일 위치를 열어준다.
    emit({
      state: 'error',
      message:
        '새 AppImage를 실행하지 못했습니다.',
    });

    try {
      shell.showItemInFolder(
        downloadedPath
      );
    } catch {
      // ignore
    }
  }
}

// 업데이트 기록
async function getReleases() {
  if (
    !OWNER ||
    OWNER === 'YOUR_GITHUB_USERNAME' ||
    !REPO
  ) {
    return [];
  }

  try {
    const beta = wantsBeta();

    const list = await ghGet(
      `https://api.github.com/repos/${OWNER}/${REPO}/releases?per_page=20`
    );

    if (!Array.isArray(list)) {
      return [];
    }

    return list
      .filter(
        (release) =>
          !release.draft &&
          (beta || !release.prerelease)
      )
      .map((release) => ({
        version: String(
          release.tag_name ||
            release.name ||
            ''
        ).replace(/^v/, ''),

        beta: !!release.prerelease,

        notes: (release.body || '')
          .replace(
            /<!--(?!\s*i18n:)[\s\S]*?-->/g,
            ''
          )
          .trim(),

        date: (
          release.published_at ||
          release.created_at ||
          ''
        ).slice(0, 10),

        htmlUrl:
          release.html_url,
      }));
  } catch {
    return [];
  }
}

module.exports = {
  init,
  check,
  runInstaller,
  downloadAndInstall,
  getReleases,
};
