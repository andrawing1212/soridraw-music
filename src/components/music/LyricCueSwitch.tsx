import React from 'react';

export default function LyricCueSwitch({enabled,onChange,disabled=false}: {enabled:boolean;onChange:(value:boolean)=>void;disabled?:boolean}) {
  return <button type="button" role="switch" aria-checked={enabled} aria-label="큐 on/off" title={enabled?'큐 숨기기':'큐 표시'} disabled={disabled} className="soridraw-lyric-cue-switch" onClick={event=>{event.stopPropagation();onChange(!enabled);}}><span aria-hidden="true"/></button>;
}
