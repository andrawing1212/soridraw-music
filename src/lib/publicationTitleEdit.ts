// Reuse Music Note's legacy title conventions; never mutate genre or song identity.
import { getResolvedGenre } from './songUtils';
export type PublicationTitleDraft = { korean: string; english: string };
export type PublicationTitleUpdater = (id:string, updates:Record<string,any>, lyricExpectedFingerprint?:string, sourceForTitleEdit?:Record<string,any>)=>void|Promise<any>;
const parseLegacyTitles = (song: any): { korean: string; english: string } => {
  const rawTitle = String(song?.title || '').trim();

  if (!rawTitle) {
    return { korean: '', english: '' };
  }

  const cleaned = rawTitle.replace(/^(\[[^\]]+\]\s*)+/g, '');

  const pipeParts = cleaned
    .split(/[|│]/)
    .map((v: string) => v.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

  if (pipeParts.length >= 2) {
    const first = pipeParts[0];
    const second = pipeParts[1];
    const firstHasKorean = /[가-힣]/.test(first);
    const secondHasKorean = /[가-힣]/.test(second);

    if (firstHasKorean && !secondHasKorean) {
      return { korean: first, english: second };
    }

    if (!firstHasKorean && secondHasKorean) {
      return { korean: second, english: first };
    }

    return { korean: first, english: second };
  }

  const quotedParts = [...cleaned.matchAll(/'([^']+)'|\"([^\"]+)\"/g)]
    .map((match) => (match[1] || match[2] || '').trim())
    .filter(Boolean);

  if (quotedParts.length >= 2) {
    const first = quotedParts[0];
    const second = quotedParts[1];
    const firstHasKorean = /[가-힣]/.test(first);
    const secondHasKorean = /[가-힣]/.test(second);

    if (firstHasKorean && !secondHasKorean) {
      return { korean: first, english: second };
    }

    if (!firstHasKorean && secondHasKorean) {
      return { korean: second, english: first };
    }

    return { korean: first, english: second };
  }

  const single = cleaned.replace(/^['"]|['"]$/g, '').trim();
  if (/[가-힣]/.test(single)) {
    return { korean: single, english: '' };
  }

  return { korean: '', english: single };
};

const getNormalizedTitles = (song: any) => {
  const legacy = parseLegacyTitles(song);

  return {
    korean: String(song?.koreanTitle || '').trim() || legacy.korean,
    english: String(song?.englishTitle || '').trim() || legacy.english,
  };
};

const cleanTitlePart = (value: any): string => {
  return String(value || '')
    .replace(/^\[[^\]]+\]\s*/, '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();
};

const normalizeTitlePartForCompare = (value: any): string => cleanTitlePart(value)
  .toLowerCase()
  .normalize('NFKC')
  .replace(/[\u200B-\u200D\uFEFF]/g, '')
  .replace(/[^0-9a-zA-Zㄱ-ㅎㅏ-ㅣ가-힣\s-]/g, ' ')
  .replace(/-/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const areTitlePartsSame = (a: any, b: any): boolean => {
  const first = normalizeTitlePartForCompare(a);
  const second = normalizeTitlePartForCompare(b);
  return Boolean(first && second && first === second);
};

const cleanTitlePair = (korean: any, foreign: any): { korean: string; foreign: string } => {
  const ko = cleanTitlePart(korean);
  const secondary = cleanTitlePart(foreign);
  if (ko && secondary && areTitlePartsSame(ko, secondary)) {
    return { korean: ko, foreign: '' };
  }
  return { korean: ko, foreign: secondary };
};


export const readPublicationTitleDraft = (source: Record<string, any>): PublicationTitleDraft => {
  const { korean, english } = getNormalizedTitles(source);
  const pair = cleanTitlePair(korean, english);
  return { korean: pair.korean, english: pair.foreign };
};
export const publicationTitleGenre = (source: Record<string, any>): string =>
  String(source.displayGenre || source.titleGenre || String(source.title || '').match(/^\[([^\]]+)\]/)?.[1] || getResolvedGenre(source) || '').replace(/^\[|\]$/g, '').trim();
export const publicationTitleText = (draft: PublicationTitleDraft): string => {
  const { korean, foreign } = cleanTitlePair(draft.korean, draft.english);
  return [korean, foreign].filter(Boolean).join(' | ');
};
export const buildPublicationTitlePatch = (source: Record<string, any>, draft: PublicationTitleDraft | null | undefined) => {
  if (!draft) return null;
  const original = readPublicationTitleDraft(source);
  const { korean, foreign: english } = cleanTitlePair(draft.korean, draft.english);
  const title = publicationTitleText({ korean, english });
  if (!title || title.length > 300) throw new Error('곡 제목은 1~300자로 입력해주세요.');
  if (korean === original.korean && english === original.english) return null;
  return { title, koreanTitle: korean, englishTitle: english };
};
export const isPublicationTitleSource = (source: Record<string,any> | null, uid:string, sourceId:string) =>
  Boolean(source && uid && sourceId && String(source.firestoreId || source.id || '').trim() === sourceId
    && String(source.uid || source.ownerUid || uid).trim() === uid
    && source.sharedReadOnly !== true && source.hidden !== true && source.favoriteHidden !== true
    && source.favoriteRemoved !== true && source.saved !== false && !source.deletedAt && !source.trashedAt);
export const assertPublicationTitleNotSuperseded = (original:Record<string,any>, latest:Record<string,any>, draft:PublicationTitleDraft) => {
  const old = readPublicationTitleDraft(original), current = readPublicationTitleDraft(latest);
  if (old.korean === current.korean && old.english === current.english) return;
  if (!buildPublicationTitlePatch(latest,draft)) return;
  throw new Error('다른 곳에서 제목이 변경되었습니다. 창을 다시 열어 수정해주세요.');
};
