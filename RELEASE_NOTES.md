# 스텔라상태 v1.0.6

## Linux AppImage 포크

이번 배포는 `tabiluv/stellastatus_app`을 기반으로 Linux 지원을 추가한 비공식 포크입니다.

### 주요 내용

- Linux x86_64용 AppImage 배포 지원
- Linux용 GitHub Releases 자동 업데이트 확인 및 AppImage 다운로드 지원
- Linux 트레이 아이콘 및 앱 아이콘 설정
- Windows 설치 프로그램 및 macOS DMG 빌드 제거
- Linux 환경에 맞게 README와 배포 workflow 정리

### 설치 방법

1. GitHub Release의 Assets에서 `.AppImage` 파일을 내려받습니다.
2. 실행 권한을 부여합니다.

```bash
chmod +x StellaStatus-*.AppImage
```

3. AppImage를 실행합니다.

```bash
./StellaStatus-*.AppImage
```

### 지원 환경

- Linux x86_64 (x64)
- AppImage

> 이 프로젝트는 StellaLive 공식 서비스가 아닌 비공식 팬 프로젝트이며, 원본 프로젝트의 MIT 라이선스를 따르는 포크입니다.
