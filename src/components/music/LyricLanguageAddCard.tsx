import { useState } from 'react';
import { Languages } from 'lucide-react';
import type { LanguageCode } from '../MusicApiGenerateModal';

type Props = {
  options: {value:LanguageCode;label:string;disabled?:boolean}[];
  replacing?:boolean;
  sourceLabel:string;
  disabled:boolean;
  onGenerate:(lang:LanguageCode)=>void;
  accent?:'note';
};

// Only the explicit button invokes generation. The selection belongs to
// this mounted song/card and is never persisted or sent to the server.
export default function LyricLanguageAddCard({options,sourceLabel,disabled,onGenerate,accent,replacing}:Props) {
  const [selected,setSelected]=useState<LanguageCode|''>('');
  const choice=options.find(x=>x.value===selected&&!x.disabled)||options.find(x=>!x.disabled);
  const tone=accent==='note'?'text-[#FFC1BC]':'text-[#e3a13a]';
  return <div className={`flex min-h-[240px] flex-1 flex-col gap-4 overflow-y-auto p-4 ${replacing?'soridraw-lyric-picker-transition':''}`}>
    <select aria-label="추가할 가사 언어" value={choice?.value||''} disabled={disabled||!choice}
      onChange={event=>setSelected(event.target.value as LanguageCode)}
      className="w-full rounded-xl bg-[var(--card-bg,#202022)] px-3 py-2 text-sm font-semibold text-[var(--text-primary,#fff)] disabled:opacity-40">
      {!choice&&<option value="" disabled>추가할 언어가 없습니다.</option>}
      {options.map(option=><option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>)}
    </select>
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Languages className={`h-7 w-7 ${tone}`}/>
      <p className="text-sm font-semibold text-[var(--text-primary,#fff)]">{choice ? `${sourceLabel}를 기준으로 ${choice.label} 가사 생성` : '추가할 언어가 없습니다.'}</p>
      <button type="button" disabled={disabled||!choice} onClick={()=>{if(choice&&!disabled)onGenerate(choice.value);}}
        className={`rounded-xl bg-white/5 px-5 py-3 text-sm font-bold disabled:opacity-40 ${tone}`}>
        {choice?.value==='ko'?'한글 추가 생성':'외국어 추가 생성'}
      </button>
    </div>
    <p className="text-center text-xs text-[var(--text-secondary,#aaa)]">생성 버튼을 누르는 순간 기준 확정</p>
  </div>;
}
