import React from 'react';
import { Pencil, X, Music2 } from 'lucide-react';
import { formatExploreDisplayTitle } from '../../lib/exploreTitleDisplay';
import { publicationTitleGenre, publicationTitleText, readPublicationTitleDraft, type PublicationTitleDraft } from '../../lib/publicationTitleEdit';

type Props = { source: Record<string, any> | null; title: string; draft?: PublicationTitleDraft | null;
  onDraftChange?: (value: PublicationTitleDraft | null) => void; busy: boolean };
export default function PublicationTitleEditor({source,title,draft,onDraftChange,busy}: Props) {
  const genre = source ? publicationTitleGenre(source) : '';
  const displayed = source ? [genre ? '['+genre+']' : '', publicationTitleText(readPublicationTitleDraft(source))].filter(Boolean).join(' ') : formatExploreDisplayTitle(title);
  return <div className="mt-3 min-w-0">
    <div className="flex min-w-0 items-center gap-2">
      <p className="min-w-0 flex-1 break-words text-base font-bold leading-snug text-white/90">{displayed || '제목 없는 곡'}</p>
      {source && onDraftChange && <button type="button" disabled={busy} aria-label={draft ? '제목 수정 취소' : '제목 수정'} title={draft ? '제목 수정 취소' : '제목 수정'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white/65 hover:bg-white/[0.12] hover:text-white disabled:opacity-40"
        onClick={()=>onDraftChange(draft ? null : readPublicationTitleDraft(source))}>
        {draft ? <X className="h-4 w-4"/> : <Pencil className="h-4 w-4"/>}
      </button>}
    </div>
    {draft && onDraftChange && <div className="mt-2 grid gap-2">
      <input autoFocus disabled={busy} aria-label="한글 제목" placeholder="한글 제목" maxLength={300}
        className="min-w-0 w-full rounded-xl bg-white/[0.08] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#FF7A72]/70" value={draft.korean}
        onChange={event=>onDraftChange({...draft,korean:event.target.value})}/>
      <input disabled={busy} aria-label="외국어 제목" placeholder="외국어 제목 (선택)" maxLength={300}
        className="min-w-0 w-full rounded-xl bg-white/[0.08] px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-[#FF7A72]/70" value={draft.english}
        onChange={event=>onDraftChange({...draft,english:event.target.value})}/>
      <p className="text-[10px] text-white/45">공개 또는 저장을 누르면 뮤직노트 원본 제목도 함께 변경됩니다.</p>
    </div>}
  </div>;
}

// One linked song needs no selection control, badge, or duplicate title.
export function PublicationSingleCover({coverUrl}:{coverUrl?:string|null}) {
  return <div className="mt-5 aspect-[32/9] w-full overflow-hidden rounded-2xl bg-black/24">
    {coverUrl ? <img src={coverUrl} alt="공개할 곡의 썸네일" className="h-full w-full object-cover"/> :
      <div className="flex h-full w-full items-center justify-center text-white/28"><Music2 className="h-6 w-6" aria-hidden="true"/></div>}
  </div>;
}
