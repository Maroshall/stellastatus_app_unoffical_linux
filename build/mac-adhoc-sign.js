// electron-builder afterPack 훅 — macOS 앱을 ad-hoc(-) 서명한다.
//
// 왜 필요한가:
//  - 인증서(Apple Developer)가 없으면 electron-builder 는 서명을 건너뛴다.
//  - Apple Silicon(arm64) 은 서명 없는 앱을 실행 자체를 막아 "손상됨"으로 열리지 않는다.
//  - ad-hoc 서명만 해줘도 "손상됨" → "확인되지 않은 개발자"(우클릭→열기) 로 바뀐다.
//
// codesign --deep 로 앱 번들 내부(Framework/Helper.app/dylib)를 한 번에 재귀 서명한다.
// (직접 안쪽부터 서명하려 하면 확장자 없는 Mach-O 바이너리를 놓쳐 빌드가 실패한다.
//  --deep 은 codesign 이 알아서 재귀 처리하므로 빌드가 안정적으로 성공한다.)
//
// 참고: macOS 27(베타)에서는 Electron 33 이 V8 시작 시 크래시하는 별개 이슈가 있다.
// 지원 목표는 macOS 26(안정 버전)까지이며, 그 환경에서 정상 동작한다.
const { execSync } = require('node:child_process');
const path = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return; // 맥에서만
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`  • ad-hoc 서명(--deep): ${appPath}`);
  execSync(`codesign --force --deep --sign - ${JSON.stringify(appPath)}`, { stdio: 'inherit' });
};
