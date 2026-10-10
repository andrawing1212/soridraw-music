
import React from 'react';
import { createRoot } from 'react-dom/client';
import StudioSplitEngineWorkspace from '../../src/components/studio/StudioSplitEngineWorkspace';
import '../../src/components/studio/studioLayout.css';
document.documentElement.dataset.soridrawTheme = 'studio-black';
document.body.style.margin='0';
const rows=Array.from({length:140},(_,i)=><div key={i} style={{height:68,padding:8,borderBottom:'1px solid #444'}}>Row {i+1}</div>);
function App(){return <div style={{width:'100%',height:750}}>
 <StudioSplitEngineWorkspace engine="lite" v2DragPerfMode="pure-pane-hybrid" workspaceView="library" viewMode="split">
 <div id="builder-list" style={{height:600,overflow:'auto'}}>{rows}</div>
 <div id="result-list" style={{height:600,overflow:'auto'}}>{rows}</div>
 </StudioSplitEngineWorkspace>
 </div>}
createRoot(document.getElementById('root')!).render(<App/>);
