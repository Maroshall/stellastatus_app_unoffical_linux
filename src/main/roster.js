// 라이브러리(stellastatus)의 STELLIVE_CHANNELS 로스터에 UI 표현용 메타데이터를 덧붙인다.
// key 는 stellastatus 의 채널 key 와 동일해야 한다.
// 색상은 각 스텔라의 이미지 컬러를 참고한 강조색이다.

const PROFILES = {
  // 1기 — 에버리스 (EVERLASTING)
  'ayatsuno-yuni': {
    nameEng: 'Ayatsuno Yuni',
    accent: '#6D78E2',
    accent2: '#6D78E2',
    channelUrl: 'https://chzzk.naver.com/45e71a76e949e16a34764deb962f9d9f',
    cafe: 'https://cafe.naver.com/stellive',
  },
  'sakihane-huya': {
    nameEng: 'Sakihane Huya',
    logoKey: 'sakihane-huya', // 로고 파일명(assets/logos/sakihane-huya.png)
    accent: '#59467C',
    accent2: '#59467C',
    channelUrl: 'https://chzzk.naver.com/36ddb9bb4f17593b60f1b63cec86611d',
    cafe: 'https://cafe.naver.com/stellive',
  },

  // 2기 — 유니버스 (UNIVERSE)
  'shirayuki-hina': {
    nameEng: 'Shirayuki Hina',
    accent: '#EEDDC2',
    accent2: '#EEDDC2',
    channelUrl: 'https://chzzk.naver.com/b044e3a3b9259246bc92e863e7d3f3b8',
    cafe: 'https://cafe.naver.com/stellive',
  },
  'neneko-mashiro': {
    nameEng: 'Neneko Mashiro',
    accent: '#525054',
    accent2: '#525054',
    channelUrl: 'https://chzzk.naver.com/4515b179f86b67b4981e16190817c580',
    cafe: 'https://cafe.naver.com/stellive',
  },
  'akane-lize': {
    nameEng: 'Akane Lize',
    accent: '#8C2830',
    accent2: '#8C2830',
    channelUrl: 'https://chzzk.naver.com/4325b1d5bbc321fad3042306646e2e50',
    cafe: 'https://cafe.naver.com/stellive',
  },
  'arahashi-tabi': {
    nameEng: 'Arahashi Tabi',
    accent: '#97C3E7',
    accent2: '#97C3E7',
    channelUrl: 'https://chzzk.naver.com/a6c4ddb09cdb160478996007bff35296',
    cafe: 'https://cafe.naver.com/stellive',
  },

  // 3기 — 클리셰 (CLICHÉ)
  'tenko-shibuki': {
    nameEng: 'Tenko Shibuki',
    accent: '#BDA4E4',
    accent2: '#BDA4E4',
    channelUrl: 'https://chzzk.naver.com/64d76089fba26b180d9c9e48a32600d9',
    cafe: 'https://cafe.naver.com/stellive',
  },
  'aokumo-rin': {
    nameEng: 'Aokumo Rin',
    accent: '#3B64BA',
    accent2: '#3B64BA',
    channelUrl: 'https://chzzk.naver.com/516937b5f85cbf2249ce31b0ad046b0f',
    cafe: 'https://cafe.naver.com/stellive',
  },
  'hanako-nana': {
    nameEng: 'Hanako Nana',
    accent: '#D17C85',
    accent2: '#D17C85',
    channelUrl: 'https://chzzk.naver.com/4d812b586ff63f8a2946e64fa860bbf5',
    cafe: 'https://cafe.naver.com/stellive',
  },
  'yuzuha-riko': {
    nameEng: 'Yuzuha Riko',
    accent: '#AECEA9',
    accent2: '#AECEA9',
    channelUrl: 'https://chzzk.naver.com/8fd39bb8de623317de90654718638b10',
    cafe: 'https://cafe.naver.com/stellive',
  },
};

// stellastatus 라이브러리의 채널 key 가 프로필 key 와 다른 경우 매핑.
// (라이브러리는 'sakihane-fuya' 로 내보내지만, 프로필/로고는 'sakihane-huya' 를 사용한다.)
const KEY_ALIAS = {
  'sakihane-fuya': 'sakihane-huya',
};

const DEFAULT_PROFILE = {
  nameEng: '',
  accent: '#8a7ffb',
  accent2: '#b6a6ff',
  channelUrl: null,
  cafe: 'https://cafe.naver.com/stellive',
};

function profileFor(key) {
  return PROFILES[key] || PROFILES[KEY_ALIAS[key]] || DEFAULT_PROFILE;
}

module.exports = { PROFILES, DEFAULT_PROFILE, KEY_ALIAS, profileFor };
