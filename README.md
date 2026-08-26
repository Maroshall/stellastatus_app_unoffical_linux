# 스텔라상태 (StellaStatus)

**한국어** | [English](README.en.md) | [日本語](README.jp.md)

스텔라이브 멤버의 치지직 방송 상태를 확인하고, 방송이 시작되면 데스크톱 알림을 보내주는 **Linux용 비공식 포크**입니다.

> ⚠️ 이 저장소는 원본 프로젝트의 포크입니다.  
> 원본 프로젝트: https://github.com/tabiluv/stellastatus_app  
> 이 포크는 원본 프로젝트를 기반으로 Linux 환경에서 사용할 수 있도록 **AppImage 빌드 및 Linux 지원을 추가**한 버전입니다.
>
> 원본 프로젝트의 기능과 MIT 라이선스를 따르며, Linux 관련 변경사항을 제외한 기본적인 프로젝트 방향은 원본을 따릅니다.

스텔라이브가 제공하는 공식 서비스가 아니며 팬이 제작·배포하는 비공식 프로그램입니다.

방송 상태는 치지직, 방송 스케줄(뱅온)은 StelLight 데이터를 사용하며,
[`stellastatus`](https://www.npmjs.com/package/stellastatus) 라이브러리와 Electron으로 만들어졌습니다.


## 기능

- 전 멤버의 치지직 방송 상태를 주기적으로 확인
- 구독한 멤버의 방송이 시작되면 데스크톱 알림
- 방송 시작 시 기본 브라우저로 자동 열기 (선택)
- 멤버별 프로필, 라이브 제목·카테고리·시청자 수, 썸네일 표시
- 오늘의 뱅온(StelLight 데이터 기반) 표시
- 트레이 상주 및 로그인 시 자동 실행 옵션
- GitHub Releases를 통한 Linux AppImage 업데이트 확인 및 다운로드

## Linux 지원

현재 배포 대상은 다음과 같습니다.

- **Linux x86_64 (x64)**
- **AppImage**

Electron 기반이므로 배포판에 따라 동작 차이가 있을 수 있습니다. 이 포크는 Arch Linux 등 일반적인 x86_64 Linux 환경을 기준으로 테스트합니다.

## 설치

GitHub Releases에서 `.AppImage` 파일을 내려받습니다.

실행 권한을 부여한 뒤 실행하세요.

```bash
chmod +x StellaStatus-*.AppImage
./StellaStatus-*.AppImage
```

파일 관리자에서 실행 권한을 설정하여 실행해도 됩니다.

## 개발 / 실행

Node.js 24 이상을 권장합니다.

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm start
```

개발자 도구를 함께 열려면:

```bash
npm run dev
```# 스텔라상태 (StellaStatus)

**한국어** | [English](README.en.md) | [日本語](README.jp.md)

스텔라이브 멤버의 치지직 방송 상태를 확인하고, 방송이 시작되면 데스크톱 알림을 보내주는 **Linux용 비공식 포크**입니다.

> ⚠️ 이 저장소는 원본 프로젝트의 포크입니다.  
> 원본 프로젝트: https://github.com/tabiluv/stellastatus_app  
> 이 포크는 원본 프로젝트를 기반으로 Linux 환경에서 사용할 수 있도록 **AppImage 빌드 및 Linux 지원을 추가**한 버전입니다.
>
> 원본 프로젝트의 기능과 MIT 라이선스를 따르며, Linux 관련 변경사항을 제외한 기본적인 프로젝트 방향은 원본을 따릅니다.

스텔라이브가 제공하는 공식 서비스가 아니며 팬이 제작·배포하는 비공식 프로그램입니다.

방송 상태는 치지직, 방송 스케줄(뱅온)은 StelLight 데이터를 사용하며,
[`stellastatus`](https://www.npmjs.com/package/stellastatus) 라이브러리와 Electron으로 만들어졌습니다.


## 기능

- 전 멤버의 치지직 방송 상태를 주기적으로 확인
- 구독한 멤버의 방송이 시작되면 데스크톱 알림
- 방송 시작 시 기본 브라우저로 자동 열기 (선택)
- 멤버별 프로필, 라이브 제목·카테고리·시청자 수, 썸네일 표시
- 오늘의 뱅온(StelLight 데이터 기반) 표시
- 트레이 상주 및 로그인 시 자동 실행 옵션
- GitHub Releases를 통한 Linux AppImage 업데이트 확인 및 다운로드

## Linux 지원

현재 배포 대상은 다음과 같습니다.

- **Linux x86_64 (x64)**
- **AppImage**

Electron 기반이므로 배포판에 따라 동작 차이가 있을 수 있습니다. 이 포크는 Arch Linux 등 일반적인 x86_64 Linux 환경을 기준으로 테스트합니다.

## 설치

GitHub Releases에서 `.AppImage` 파일을 내려받습니다.

실행 권한을 부여한 뒤 실행하세요.

```bash
chmod +x StellaStatus-*.AppImage
./StellaStatus-*.AppImage
```

파일 관리자에서 실행 권한을 설정하여 실행해도 됩니다.

## 개발 / 실행

Node.js 24 이상을 권장합니다.

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm start
```

개발자 도구를 함께 열려면:

```bash
npm run dev
```

## AppImage 빌드

Linux 환경에서:

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm run dist
```

결과물은 `dist/*.AppImage`에 생성됩니다.

GitHub Actions에서는 **Actions → Build Linux → Run workflow**로 테스트 빌드를 만들 수 있습니다.

## 업데이트

앱은 GitHub Releases API를 통해 새 버전을 확인합니다.

새 AppImage가 있으면 앱에서 다운로드할 수 있으며, 다운로드한 AppImage를 실행하여 새 버전으로 전환합니다.

> Linux AppImage는 일반적인 설치 프로그램과 달리 기존 설치본을 덮어쓰지 않습니다. 업데이트 시 새 AppImage가 별도 파일로 다운로드될 수 있습니다.

## 데이터 출처

- 방송 상태: 치지직 내부 API. 공식 문서가 없는 엔드포인트이므로 응답 구조가 바뀌거나 차단될 수 있으며, 개인·비상업 용도를 전제로 합니다.
- 방송 스케줄: 팬 제작 서비스 StelLight의 공개 API를 사용합니다. 서버 부담을 줄이기 위해 확인 주기는 최소 30초로 제한됩니다.

## 개인정보 처리방침

- 이 앱은 사용자의 개인정보를 수집하거나 외부로 전송하지 않습니다.
- 앱은 아래 서비스에만 네트워크 요청을 보냅니다.
  - **치지직(CHZZK)** — 방송 상태 조회
  - **StelLight** — 방송 스케줄(뱅온) 조회
  - **GitHub** — 업데이트 확인 및 다운로드
- 알림 구독 목록, 확인 주기 등 모든 설정은 사용자 PC에 로컬로 저장됩니다.
- 사용자가 요청하지 않은 정보는 외부 서버로 전송하지 않습니다.

## 라이선스 및 저작권

이 프로젝트는 **MIT License**에 따라 배포됩니다.

이 저장소는 다음 원본 프로젝트의 포크입니다.

- 원본: https://github.com/tabiluv/stellastatus_app
- 포크: https://github.com/Maroshall/stellastatus_app

원본 프로젝트의 저작권 및 MIT 라이선스 조건을 존중하며, 이 포크에서 추가·수정한 Linux 관련 코드는 동일한 프로젝트 라이선스 조건에 따라 배포됩니다.

자세한 내용은 저장소의 `LICENSE` 파일을 확인하세요.


## AppImage 빌드

Linux 환경에서:

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm run dist
```

결과물은 `dist/*.AppImage`에 생성됩니다.

GitHub Actions에서는 **Actions → Build Linux → Run workflow**로 테스트 빌드를 만들 수 있습니다.

## 업데이트

앱은 GitHub Releases API를 통해 새 버전을 확인합니다.

새 AppImage가 있으면 앱에서 다운로드할 수 있으며, 다운로드한 AppImage를 실행하여 새 버전으로 전환합니다.

> Linux AppImage는 일반적인 설치 프로그램과 달리 기존 설치본을 덮어쓰지 않습니다. 업데이트 시 새 AppImage가 별도 파일로 다운로드될 수 있습니다.

## 데이터 출처

- 방송 상태: 치지직 내부 API. 공식 문서가 없는 엔드포인트이므로 응답 구조가 바뀌거나 차단될 수 있으며, 개인·비상업 용도를 전제로 합니다.
- 방송 스케줄: 팬 제작 서비스 StelLight의 공개 API를 사용합니다. 서버 부담을 줄이기 위해 확인 주기는 최소 30초로 제한됩니다.

## 개인정보 처리방침

- 이 앱은 사용자의 개인정보를 수집하거나 외부로 전송하지 않습니다.
- 앱은 아래 서비스에만 네트워크 요청을 보냅니다.
  - **치지직(CHZZK)** — 방송 상태 조회
  - **StelLight** — 방송 스케줄(뱅온) 조회
  - **GitHub** — 업데이트 확인 및 다운로드
- 알림 구독 목록, 확인 주기 등 모든 설정은 사용자 PC에 로컬로 저장됩니다.
- 사용자가 요청하지 않은 정보는 외부 서버로 전송하지 않습니다.

## 라이선스 및 저작권

이 프로젝트는 **MIT License**에 따라 배포됩니다.

이 저장소는 다음 원본 프로젝트의 포크입니다.

- 원본: https://github.com/tabiluv/stellastatus_app
- 포크: https://github.com/Maroshall/stellastatus_app

원본 프로젝트의 저작권 및 MIT 라이선스 조건을 존중하며, 이 포크에서 추가·수정한 Linux 관련 코드는 동일한 프로젝트 라이선스 조건에 따라 배포됩니다.

자세한 내용은 저장소의 `LICENSE` 파일을 확인하세요.
