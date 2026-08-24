const { EventEmitter } = require('events');
const { profileFor, orderFor } = require('./roster');

const CHZZK_PUBLIC = 'https://api.chzzk.naver.com';
const MIN_INTERVAL_SEC = 30;

function isNetworkError(err) {
  const code = String(err?.code || '').toUpperCase();
  const msg = String(err?.message || err || '').toLowerCase();

  return [
    'ENETUNREACH', 'EAI_AGAIN', 'ECONNRESET', 'ECONNREFUSED',
    'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', 'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED', 'NETWORK',
  ].includes(code)
    || /network|fetch failed|failed to fetch|internet|offline|socket|dns|timed out|timeout|connection (reset|refused|closed|lost)/i.test(msg);
}

function statusHasNetworkError(status) {
  return !!status?.error && isNetworkError(status.error);
}

/**
 * stellastatus 라이브러리를 사용해 스텔라이브 전체 멤버의 방송 상태를 주기적으로 조회하고,
 * 오프라인 → 라이브 전환을 감지해 이벤트로 알린다.
 *
 * 이벤트:
 *  - 'update'      (members[])            매 폴링마다 전체 멤버 상태
 *  - 'transitions' ({ wentLive, wentOffline })  직전 상태 대비 전환된 멤버
 *  - 'error'       (Error)                폴링 중 오류
 *  - 'polling'     (boolean)              폴링 시작/종료(로딩 표시용)
 */
class Poller extends EventEmitter {
  constructor() {
    super();
    this._client = null;      // { chzzk, schedule }
    this._roster = [];        // listChannels() 결과
    this._timer = null;
    this._intervalMs = 60_000;
    this._prevLive = new Map();       // key -> isLive
    this._avatarCache = new Map();    // channelId -> imageUrl
    this._members = [];               // 마지막 병합 결과
    this._busy = false;
    this._networkOffline = false;
    this._nightAllOfflineNotified = false;
  }

  /** ESM 라이브러리를 로드하고 클라이언트를 초기화한다. */
  async init() {
    // stellastatus 는 ESM 모듈이므로 CommonJS 메인에서 동적 import 로 불러온다.
    const mod = await import('stellastatus');
    this._client = mod.createStellaStatus();
    this._roster = mod.listChannels();
    return this._roster;
  }

  get client() {
    return this._client;
  }

  get members() {
    return this._members;
  }

  get networkOffline() {
    return this._networkOffline;
  }

  /** 오프라인 멤버도 프로필 이미지를 표시하기 위해 채널 이미지를 조회(캐시). 실패해도 무시. */
  async _fetchAvatar(channelId) {
    if (this._avatarCache.has(channelId)) return this._avatarCache.get(channelId);
    try {
      const res = await fetch(`${CHZZK_PUBLIC}/service/v1/channels/${channelId}`, {
        headers: { 'User-Agent': 'stellastatus-app', Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const url = json?.content?.channelImageUrl || null;
        this._avatarCache.set(channelId, url);
        return url;
      }
    } catch {
      /* 네트워크 오류는 조용히 무시(아바타는 부가 정보) */
    }
    this._avatarCache.set(channelId, null);
    return null;
  }

  /** 라이브러리 상태 + 프로필 메타 + 아바타를 하나의 멤버 객체로 병합. */
  _merge(status, meta) {
    const p = profileFor(meta.key);
    const avatar = status.channel?.imageUrl || this._avatarCache.get(meta.id) || null;
    return {
      key: meta.key,
      id: meta.id,
      name: meta.name,
      nameEng: p.nameEng,
      nameJa: p.nameJa,
      nameJaKana: p.nameJaKana,
      logo: p.logoKey || meta.key, // 로고 파일명(assets/logos/<logo>.png)
      gen: meta.gen,
      genName: meta.genName,
      order: orderFor(meta.key), // 로스터(기수) 정렬 순서

      accent: p.accent,
      accent2: p.accent2,
      emoji: p.emoji,
      channelUrl: p.channelUrl,
      cafe: p.cafe,
      // 프로필 아이콘 팝아웃용 소셜 링크(있는 것만 표시). chzzk 는 채널 URL 에서 자동 채움.
      social: {
        chzzk: p.channelUrl || null,
        youtube: p.youtube || null,
        x: p.x || null,
        instagram: p.instagram || null,
      },
      avatar,
      isLive: Boolean(status.isLive),
      title: status.title || null,
      category: status.category || null,
      tags: status.tags || [],
      viewerCount: status.viewerCount ?? null,
      thumbnail: status.thumbnail || null,
      openDate: status.openDate || null,
      followerCount: status.channel?.followerCount ?? null,
      liveUrl: status.liveUrl || p.channelUrl,
      error: status.error || null,
    };
  }

  /** 자정(00:00)부터 오전 06:00 사이 모든 멤버가 오프라인인지 확인한다.
   *
   * 알림 조건:
   *  1) 프로그램을 계속 켜둔 상태에서 마지막 라이브 멤버가 오프라인이 됨
   *  2) 프로그램을 완전히 재시작했고, 첫 정상 조회부터 이미 전원 오프라인임
   *
   * 같은 밤 동안에는 중복 알림을 보내지 않는다.
   */
  _checkNightAllOffline(members, hadLiveBeforePoll) {
    const hour = new Date().getHours();
    const inNightWindow = hour >= 0 && hour < 6;

    if (!inNightWindow) {
      this._nightAllOfflineNotified = false;
      return;
    }

    if (!members.length) return;

    const allOffline = members.every((m) => !m.isLive);

    if (allOffline && !this._nightAllOfflineNotified) {
      // 첫 정상 조회에서 이미 전원 오프라인인 경우도 허용한다.
      // hadLiveBeforePoll이 true면 마지막 라이브가 방금 종료된 경우다.
      // 둘 다 한 번만 알림한다.
      this._nightAllOfflineNotified = true;
      this.emit('night-all-offline', {
        title: '스텔라 모두가 오프라인이에요!',
        message: '잘자요 🌙',
        reason: hadLiveBeforePoll ? 'last-live-offline' : 'startup-all-offline',
      });
    }
  }

  /** 한 번 폴링한다. */
  async pollOnce() {
    if (!this._client) await this.init();
    if (this._busy) return this._members;
    this._busy = true;
    this.emit('polling', true);
    try {
      const statuses = await this._client.chzzk.getAllLiveStatuses();

      if (!Array.isArray(statuses)) {
        const err = new Error('Invalid live status response');
        err.code = 'NETWORK';
        throw err;
      }

      // 라이브러리가 네트워크 오류를 예외 대신 status.error로 반환하는 경우도
      // 정상적인 OFFLINE 데이터로 취급하지 않는다.
      const networkStatusError = statuses.find(statusHasNetworkError);
      if (networkStatusError) {
        const err = new Error(String(networkStatusError.error));
        err.code = 'NETWORK';
        throw err;
      }

      // 로스터가 존재하는데 상태 목록이 완전히 비어 있으면 연결/응답 이상으로 처리한다.
      if (this._roster.length > 0 && statuses.length === 0) {
        const err = new Error('Live status response is empty');
        err.code = 'NETWORK';
        throw err;
      }

      const wasNetworkOffline = this._networkOffline;
      this._networkOffline = false;
      if (wasNetworkOffline) this.emit('network-restored');

      // 아바타 선(先)조회(캐시에 없을 때만). 병렬.
      await Promise.all(
        this._roster.map((ch) =>
          this._avatarCache.has(ch.id) ? Promise.resolve() : this._fetchAvatar(ch.id),
        ),
      );

      // 이번 정상 응답을 반영하기 직전의 상태를 기억한다.
      // 네트워크 오류에서는 이 지점까지 오지 않으므로 마지막 라이브 상태가 보존된다.
      const hadLiveBeforePoll = this._members.some((m) => m.isLive);

      // roster 순서(기수별)로 병합
      const byKey = new Map(statuses.map((s) => [s.channel?.key, s]));
      const members = this._roster.map((ch) => {
        const st = byKey.get(ch.key) || { isLive: false, channel: { id: ch.id, key: ch.key, name: ch.name } };
        return this._merge(st, ch);
      });

      // 전환 감지
      const wentLive = [];
      const wentOffline = [];
      for (const m of members) {
        const prev = this._prevLive.get(m.key);
        if (prev === false && m.isLive) wentLive.push(m);
        if (prev === true && !m.isLive) wentOffline.push(m);
        this._prevLive.set(m.key, m.isLive);
      }

      this._members = members;
      this.emit('update', members);
      this._checkNightAllOffline(members, hadLiveBeforePoll);
      if (wentLive.length || wentOffline.length) {
        this.emit('transitions', { wentLive, wentOffline });
      }
      return members;
    } catch (err) {
      const network = err?.code === 'NETWORK' || isNetworkError(err);

      if (network) {
        const wasOffline = this._networkOffline;
        this._networkOffline = true;

        // 네트워크 오류에서는 _members / _prevLive를 절대 갱신하지 않는다.
        if (!wasOffline) {
          this.emit('network', {
            initial: this._members.length === 0,
            error: err,
          });
        }
      }

      this.emit('error', err);
      return this._members;
    } finally {
      this._busy = false;
      this.emit('polling', false);
    }
  }

  /** 폴링 시작. intervalSec 이하로는 MIN_INTERVAL_SEC 로 보정. */
  start(intervalSec) {
    this.setInterval(intervalSec);
    this.pollOnce();
    this._arm();
  }

  _arm() {
    this.stop();
    this._timer = setInterval(() => this.pollOnce(), this._intervalMs);
  }

  setInterval(intervalSec) {
    const sec = Math.max(MIN_INTERVAL_SEC, Number(intervalSec) || 60);
    this._intervalMs = sec * 1000;
    if (this._timer) this._arm();
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }
}

module.exports = { Poller, MIN_INTERVAL_SEC };
