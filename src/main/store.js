const Store = require('electron-store');

// 앱 설정 저장소. %APPDATA%/스텔라상태/config.json 에 보관된다.
const store = new Store({
  name: 'config',
  defaults: {
    // 방송 상태 폴링 주기(초). 너무 짧게 두면 치지직/스텔라이트 서버에 부담이 되므로 하한 30초.
    pollIntervalSec: 60,
    // 윈도우 알림 사용 여부
    notifyEnabled: true,
    // 방송 시작 시 시스템 기본 웹브라우저로 자동 열기
    autoOpenLive: false,
    // 자동으로 브라우저를 열 멤버 채널 key 목록. null 이면 전체.
    autoOpenList: null,
    // 알림을 받을 멤버 채널 key 목록. null 이면 전체 구독.
    subscribed: null,
    // 창을 닫으면 트레이로 최소화(종료하지 않음)
    minimizeToTray: true,
    // 윈도우 시작 시 자동 실행
    launchAtStartup: false,
    // 시작 시 창을 숨긴 채(트레이) 실행
    startHidden: false,
    // 카드 썸네일 표시
    showThumbnails: true,
    // 마지막 창 크기/위치
    windowBounds: { width: 1180, height: 780 },
  },
});

module.exports = store;
