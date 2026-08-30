const OFFICIAL_ORIGIN = 'https://soridraw.web.app';
const ALLOWED_RETURN_ORIGINS = new Set([
  OFFICIAL_ORIGIN,
  'https://soridraw-music.vercel.app',
  'https://soridraw-music-git-main-andrawing1212.vercel.app',
  'https://soridraw-music-git-preview-andrawing1212.vercel.app',
  'https://preview.soridraw.com',
  'https://soridraw-preview.web.app',
  'https://soridraw-preview.firebaseapp.com',
  'https://test.soridraw.com',
  'https://soridraw-test.web.app',
  'https://soridraw-test.firebaseapp.com',
]);

const getSafeReturnOrigin = () => {
  if (typeof window === 'undefined') return OFFICIAL_ORIGIN;
  return ALLOWED_RETURN_ORIGINS.has(window.location.origin) ? window.location.origin : OFFICIAL_ORIGIN;
};

export const buildEmailVerificationActionSettings = (uid: string) => ({
  // Firebase 기본 인증 화면을 사용하더라도 인증 완료 후 계정 혼선을 막는
  // SORIDRAW 전용 확인 경로로 돌아오게 한다.
  url: `${getSafeReturnOrigin()}/auth/verified?uid=${encodeURIComponent(uid)}`,
  handleCodeInApp: false,
} as const);
