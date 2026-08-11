// electron-builder afterPack 훅 — macOS 앱을 ad-hoc(-) 서명한다.
//
// 왜 필요한가:
//  - 인증서(Apple Developer)가 없으면 electron-builder 는 서명을 건너뛴다.
//  - Apple Silicon(arm64) 은 서명 없는 앱을 실행 자체를 막아 "손상됨"으로 열리지 않는다.
//  - ad-hoc 서명만 해줘도 "손상됨" → "확인되지 않은 개발자"(우클릭→열기) 로 바뀐다.
//
// ⚠️ 주의: `codesign --deep` 는 Electron 의 중첩 구조(Framework/Helper.app/dylib)를
//   올바른 순서로 서명하지 못해, 실행 시 dyld 가 "Code Signature Invalid" 로 죽이는
//   크래시가 난다. 반드시 '안쪽(가장 깊은 것)부터 → 바깥(최상위 .app)' 순서로 서명한다.
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return; // 맥에서만

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  // 하드닝(--options runtime)은 넣지 않는다: Electron 은 JIT 를 쓰는데 하드닝을 켜면
  // entitlements(allow-jit 등) 없이는 실행이 막힌다. ad-hoc 은 하드닝 없이 서명한다.
  const sign = (p) =>
    execSync(`codesign --force --timestamp=none --sign - ${JSON.stringify(p)}`, { stdio: 'inherit' });

  // 중첩 코드(.framework / .app 헬퍼 / .dylib / .node)를 깊이 우선으로 모아 안쪽부터 서명
  const nested = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (/\.(framework|app)$/.test(e.name)) { walk(full); nested.push(full); } // 자식 먼저, 그 다음 자신
        else walk(full);
      } else if (/\.(dylib|node)$/.test(e.name)) {
        nested.push(full);
      }
    }
  };
  walk(appPath);

  for (const item of nested) sign(item); // 안쪽부터
  sign(appPath);                         // 최상위 앱은 마지막
  // 검증 (실패하면 빌드도 실패시켜 문제를 조기에 드러낸다)
  execSync(`codesign --verify --deep --strict --verbose=2 ${JSON.stringify(appPath)}`, { stdio: 'inherit' });
  console.log(`  • ad-hoc 서명 완료 (중첩 ${nested.length}개 + 앱): ${appPath}`);
};
