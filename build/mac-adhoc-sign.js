// electron-builder afterPack 훅 — macOS 앱을 ad-hoc(-) 서명한다.
//
// 왜 필요한가:
//  - 인증서(Apple Developer)가 없으면 electron-builder 는 서명을 건너뛴다.
//  - 그런데 Apple Silicon(arm64) 은 '서명 없는' 앱을 실행 자체를 막아,
//    다운로드해 열면 "'스텔라상태'은(는) 손상되었기 때문에 열 수 없습니다" 가 뜬다.
//  - ad-hoc 서명(codesign -s -)만 해줘도 "손상됨"(실행 불가) → "확인되지 않은 개발자"
//    (우클릭 → 열기로 실행 가능) 로 바뀐다. (정식 배포는 Developer ID + 공증 필요)
const { execSync } = require('node:child_process');
const path = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return; // 맥에서만
  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  console.log(`  • ad-hoc 서명: ${appPath}`);
  // --deep: 내부 프레임워크/헬퍼까지 재귀 서명, -s -: ad-hoc(인증서 없음)
  execSync(`codesign --force --deep --sign - ${JSON.stringify(appPath)}`, { stdio: 'inherit' });
};
