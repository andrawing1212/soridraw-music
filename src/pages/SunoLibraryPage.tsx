import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, Home, Music, RefreshCw, Loader2, AlertCircle, 
  Search, Filter, PlayCircle, MoreVertical, Download, 
  Share2, Star, Trash2, Info, ChevronRight, X, Play,
  Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX
} from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, collectionGroup, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useGlobalPlayer } from '../contexts/GlobalPlayerContext';

export default function SunoLibraryPage() {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusChecking, setStatusChecking] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isSharedView, setIsSharedView] = useState(false);
  const [isSharedOwner, setIsSharedOwner] = useState(false);
  const [sharedTrackLoading, setSharedTrackLoading] = useState(false);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'favorite'>('all');
  const [showDetails, setShowDetails] = useState<any>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const { currentTrack, isPlaying, playTrack } = useGlobalPlayer();

  useEffect(() => {
    const searchParams = new URL(window.location.href).searchParams;
    const trackId = searchParams.get('track');

    if (trackId) {
      setIsSharedView(true);
      setSharedTrackLoading(true);

      const unsubAuth = auth.onAuthStateChanged(async (currentUser) => {
        setUser(currentUser);
        try {
          if (currentUser) {
            const trackRef = doc(db, 'suno_tracks', currentUser.uid, 'tracks', trackId);
            const snap = await getDoc(trackRef);
            if (snap.exists() && !snap.data().hidden) {
              setTracks([{ id: snap.id, ...snap.data() }]);
              setIsSharedOwner(true);
              setSharedTrackLoading(false);
              setLoading(false);
              return;
            }
          }
          
          const q = query(
            collectionGroup(db, 'tracks'),
            where('isPublic', '==', true)
          );
          const querySnapshot = await getDocs(q);
          const publicTrack = querySnapshot.docs.find(d => d.id === trackId && !d.data().hidden);
          
          if (publicTrack) {
            setTracks([{ id: publicTrack.id, ...publicTrack.data() }]);
          } else {
            setTracks([]);
            alert('공유된 곡을 찾을 수 없거나 접근할 수 없습니다.');
          }
        } catch (e) {
          console.error(e);
          setTracks([]);
        } finally {
          setSharedTrackLoading(false);
          setLoading(false);
        }
      });
      return () => unsubAuth();
    }

    const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        setTracks([]);
        return;
      }

      const q = query(
        collection(db, 'suno_tracks', currentUser.uid, 'tracks')
      );

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).filter((docData: any) => !docData.hidden);

        list.sort((a: any, b: any) => {
          const t1 = a.createdAt?.seconds || 0;
          const t2 = b.createdAt?.seconds || 0;
          return t2 - t1;
        });

        setTracks(list);
        setLoading(false);
      }, (error) => {
        console.error('Error fetching tracks:', error);
        setLoading(false);
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

  const filteredTracks = useMemo(() => {
    return tracks.filter(t => {
      const matchesSearch = (t.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (t.prompt || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filter === 'all' || 
                            (filter === 'completed' && t.status === 'completed') || 
                            (filter === 'favorite' && t.favorite); // Favorite is placeholder for now

      return matchesSearch && matchesFilter;
    });
  }, [tracks, searchTerm, filter]);

  const allPlayables = useMemo(() => {
    const list: any[] = [];
    filteredTracks.forEach(group => {
      const items = group.sunoData || (group.audioUrl ? [{ audioUrl: group.audioUrl, title: group.title, imageUrl: group.imageUrl }] : []);
      items.forEach((item: any, idx: number) => {
        const audioUrl = item.audioUrl || item.audio_url || item.streamAudioUrl || item.stream_audio_url || item.sourceAudioUrl || group.audioUrls?.[idx] || group.audioUrl || group.streamAudioUrl;
        if (audioUrl) {
          list.push({ group, item, idx, url: audioUrl });
        }
      });
    });
    return list;
  }, [filteredTracks]);

  const handlePlayTrack = (track: any, subIndex: number = 0) => {
    let url = '';
    let title = track.title || 'Untitled';
    let imageUrl = track.imageUrl || track.image_url || '';
    
    if (track.sunoData && track.sunoData[subIndex]) {
      const item = track.sunoData[subIndex];
      url = item.audioUrl || item.audio_url || item.streamAudioUrl || item.stream_audio_url || item.sourceAudioUrl;
      if (item.title) title = item.title;
      if (item.imageUrl || item.image_url) imageUrl = item.imageUrl || item.image_url;
    } else if (track.audioUrls && track.audioUrls[subIndex]) {
      url = track.audioUrls[subIndex];
    } else {
      url = track.audioUrl || track.streamAudioUrl;
    }

    if (url) {
      const newQueue = allPlayables.map(p => ({
        url: p.url,
        title: p.item?.title || p.group?.title || 'Untitled',
        imageUrl: p.item?.imageUrl || p.item?.image_url || p.group?.imageUrl || p.group?.image_url || '',
        parent: p.group,
        index: p.idx
      }));
      playTrack({ url, title, imageUrl, parent: track, index: subIndex }, newQueue);
    }
  };

  const checkStatus = async (trackId: string, taskId: string) => {
    if (!taskId) {
      alert('taskId가 없어 상태 확인을 할 수 없습니다.');
      return;
    }

    try {
      setStatusChecking(trackId);
      const user = auth.currentUser;

      if (!user) {
        alert('로그인이 필요합니다.');
        return;
      }

      const token = await user.getIdToken();
      const res = await fetch('https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ trackId, taskId })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`상태 확인 실패: ${data.error || 'unknown error'}`);
        return;
      }

      if (data.status === 'completed') {
        alert('생성 완료되었습니다.');
      } else if (data.status === 'failed') {
        alert('생성에 실패했습니다.');
      } else {
        alert('아직 생성 중입니다.');
      }
    } catch (error) {
      console.error(error);
      alert('상태 확인 중 오류가 발생했습니다.');
    } finally {
      setStatusChecking(null);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'completed':
        return null;
      case 'failed':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">실패</span>;
      case 'processing':
      case 'submitted':
      case 'pending':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
             <Loader2 className="w-3 h-3 animate-spin" />
             생성 중...
          </span>
        );
      default:
        return null;
    }
  };

  const formatCreatedAt = (createdAt: any) => {
    try {
      if (!createdAt) return '';
      if (typeof createdAt.toDate === 'function') {
        return new Date(createdAt.toDate()).toLocaleString();
      }
      if (createdAt.seconds) {
        return new Date(createdAt.seconds * 1000).toLocaleString();
      }
      return new Date(createdAt).toLocaleString();
    } catch (error) {
      console.error('createdAt format error:', error);
      return '';
    }
  };

  const handleDownload = (url: string) => {
    if (!url) {
      alert('다운로드 링크를 찾을 수 없습니다.');
      return;
    }
    window.open(url, '_blank');
  };

  const handleShare = async (group: any, item: any) => {
    if (!group) return;
    try {
      if (user) {
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', group.id);
        await updateDoc(trackRef, {
          isPublic: true,
          publicSharedAt: serverTimestamp()
        });
      }
      
      const shareUrl = `${window.location.origin}/suno-library?track=${group.id}`;
      const title = `SORIDRAW Music - ${item?.title || group.title || 'Untitled'}`;
      const text = `SORIDRAW에서 만든 음악을 들어보세요.`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: title,
            text: text,
            url: shareUrl
          });
        } catch (e) {
          console.log('Share failed', e);
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert('공유 링크를 복사했습니다.');
      }
    } catch (e) {
      console.error('Error sharing:', e);
      alert('공유 처리 중 오류가 발생했습니다.');
    }
  };

  const handleApplyNext = (group: any, item: any) => {
    const data = {
      title: item?.title || group.title,
      lyrics: group.lyrics,
      prompt: group.prompt,
      keywords: group.tags || group.style,
      genre: group.style || group.tags,
      taskId: group.taskId,
      source: 'suno-library'
    };
    localStorage.setItem('soridraw_next_suno_apply', JSON.stringify(data));
    alert('다음 곡에 적용할 정보가 저장되었습니다.');
  };

  const handleSavePlaylist = (group: any, item: any, url: string) => {
    const data = {
      title: item?.title || group.title,
      url: url,
      source: 'suno-library',
      groupId: group.id
    };
    localStorage.setItem('soridraw_playlists_pending', JSON.stringify(data));
    alert('플레이리스트 저장 준비가 완료되었습니다.');
  };

  const handleDelete = async (groupId: string) => {
    if (window.confirm("라이브러리에서 이 곡을 숨길까요?")) {
      try {
        const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
        if (user) {
           await updateDoc(doc(db, 'suno_tracks', user.uid, 'tracks', groupId), {
             hidden: true,
             deletedAt: serverTimestamp()
           });
        }
      } catch (e) {
        console.error(e);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-32 text-[var(--text-primary)]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Block */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/')}
              className="mt-1 px-4 py-2.5 text-sm font-bold rounded-xl border border-btn-border bg-btn-bg text-[var(--text-secondary)] hover:bg-btn-hover shadow-btn transition-all shrink-0 flex items-center gap-2"
            >
              <Home className="w-4 h-4" />홈
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                <Music className="w-8 h-8 text-brand-orange" />
                {isSharedView ? '공유된 음악' : 'Suno Library'}
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {isSharedView ? 'SORIDRAW에서 누군가 만든 멋진 곡입니다.' : 'Suno API로 생성한 곡을 조회하고 재생합니다.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 items-center self-end md:self-center">
            <button
              onClick={() => navigate('/suno-api-settings')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[var(--bg-secondary)] border border-btn-border hover:bg-btn-hover transition-all"
            >
              <Settings className="w-4 h-4" />
              API 설정
            </button>
          </div>
        </motion.div>

        {/* Main Music Player relocated to GlobalPlayer */}

        {/* Search & Filter */}
        {!isSharedView && (
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input 
                type="text" 
                placeholder="음악 제목이나 스타일 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-[var(--bg-secondary)] border border-white/10 outline-none focus:border-brand-orange/50 transition-all text-sm"
              />
            </div>
            <div className="flex bg-[var(--bg-secondary)] border border-white/10 p-1 rounded-2xl">
              {(['all', 'completed', 'favorite'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    filter === f ? 'bg-brand-orange text-white' : 'hover:bg-white/5 opacity-60'
                  }`}
                >
                  {f === 'all' ? '전체' : f === 'completed' ? '완료' : '즐겨찾기'}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading || sharedTrackLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h2 className="text-xl font-bold mb-2">로그인이 필요합니다</h2>
            <p className="text-[var(--text-secondary)]">Suno Library를 보려면 로그인해주세요.</p>
          </div>
        ) : filteredTracks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Music className="w-8 h-8 text-[var(--text-secondary)]/50" />
            </div>
            <h2 className="text-xl font-bold mb-2">검색 결과가 없습니다</h2>
            <p className="text-[var(--text-secondary)] mb-8">다른 검색어를 사용하거나 필터를 변경해보세요.</p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {filteredTracks.map((group) => {
              const items = group.sunoData || (group.audioUrl ? [{ audioUrl: group.audioUrl, title: group.title }] : []);
              const dateStr = formatCreatedAt(group.createdAt);
              
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[var(--bg-secondary)] border border-white/10 rounded-2xl"
                >
                  {/* Group Header */}
                  <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02] rounded-t-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-brand-orange">
                        <Music className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold leading-tight">{group.title || 'Untitled Generation'}</h3>
                        <div className="flex items-center gap-2 mt-0.5 opacity-40 text-[10px]">
                          <span>{dateStr}</span>
                          <span>•</span>
                          <span>{items.length}곡</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(group.status)}
                      {group.status !== 'completed' && group.status !== 'failed' && (
                        <button
                          onClick={() => checkStatus(group.id, group.taskId)}
                          disabled={statusChecking === group.id || !group.taskId}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold border border-white/10 transition-all"
                        >
                          {statusChecking === group.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          상태 확인
                        </button>
                      )}
                      {!group.taskId && <span className="text-[10px] opacity-30">Task ID 없음</span>}
                    </div>
                  </div>

                  {/* Tracks List */}
                  <div className="divide-y divide-white/5">
                    {items.length > 0 ? items.map((item: any, idx: number) => {
                      const audioUrl = item.audioUrl || item.audio_url || item.streamAudioUrl || item.stream_audio_url || item.sourceAudioUrl;
                      const isCurrent = currentTrack?.parent?.id === group.id && currentTrack?.index === idx;
                      
                      return (
                        <div 
                          key={`${group.id}-${idx}`} 
                          className={`group flex items-center gap-3 md:gap-4 px-4 md:px-6 py-3 hover:bg-white/[0.03] transition-all cursor-pointer last:rounded-b-2xl ${isCurrent ? 'bg-brand-orange/5' : ''}`}
                          onClick={(e) => {
                             if ((e.target as HTMLElement).closest('button')) return; // ignore if clicking buttons
                             if (audioUrl) handlePlayTrack(group, idx);
                          }}
                        >
                          <button 
                            onClick={(e) => { e.stopPropagation(); if (audioUrl) handlePlayTrack(group, idx); }}
                            disabled={!audioUrl}
                            className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-all ${
                              isCurrent && isPlaying ? 'bg-brand-orange text-white ring-4 ring-brand-orange/20 shadow-lg shadow-brand-orange/40' : 
                              isCurrent ? 'bg-brand-orange/50 text-white' :
                              'bg-white/5 hover:bg-brand-orange/20 text-white group-hover:scale-105'
                            } disabled:opacity-20`}
                          >
                            {isCurrent && isPlaying ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className={`w-3.5 h-3.5 ${isCurrent ? 'fill-white' : ''} ml-0.5`} />}
                          </button>
                          
                          <div className="hidden md:flex w-24 lg:w-32 shrink-0 items-center justify-center bg-white/5 border border-white/5 rounded-lg px-2 py-1.5 text-[10px] text-[var(--text-secondary)] font-medium truncate">
                            {group.style || group.tags || 'Music'}
                          </div>
                          
                          <div className="flex-1 min-w-0 pr-2">
                            <h4 className={`text-sm md:text-base font-bold truncate transition-colors ${isCurrent ? 'text-brand-orange' : 'text-[var(--text-primary)] group-hover:text-white'}`}>
                              {item.title || group.title || `Track ${idx + 1}`}
                            </h4>
                            <p className="md:hidden text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{group.style || group.tags || 'Music'}</p>
                          </div>

                          <div className="text-[10px] opacity-40 font-mono shrink-0 tabular-nums">
                            {item.duration ? `${Math.floor(item.duration / 60)}:${String(Math.floor(item.duration % 60)).padStart(2, '0')}` : '--:--'}
                          </div>

                          <div className="relative shrink-0 ml-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === `${group.id}-${idx}` ? null : `${group.id}-${idx}`); }}
                              className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all"
                            >
                              <MoreVertical className="w-4 h-4 opacity-50" />
                            </button>
                            
                            {/* Actions Menu */}
                            <AnimatePresence>
                              {activeMenu === `${group.id}-${idx}` && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveMenu(null); }} />
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                    className="absolute right-0 top-10 z-50 w-48 bg-[var(--bg-secondary)] border border-white/10 rounded-xl shadow-2xl py-2 overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {[
                                      { icon: Info, label: '상세정보', action: () => { setShowDetails({ ...group, itemIndex: idx }); setActiveMenu(null); } },
                                      { icon: Download, label: '다운로드', action: () => { handleDownload(audioUrl); setActiveMenu(null); } },
                                      { icon: Music, label: '다음곡에 적용', action: () => { handleApplyNext(group, item); setActiveMenu(null); } },
                                      { icon: Share2, label: '공유', action: () => { handleShare(group, item); setActiveMenu(null); } },
                                      { icon: Star, label: '플레이리스트 저장', action: () => { handleSavePlaylist(group, item, audioUrl); setActiveMenu(null); } },
                                      (!isSharedView || isSharedOwner) ? { icon: Trash2, label: '삭제', action: () => { handleDelete(group.id); setActiveMenu(null); }, danger: true } : null,
                                    ].filter(Boolean).map((m: any, i) => (
                                      <button
                                        key={i}
                                        onClick={m.action}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-white/5 transition-all ${m.danger ? 'text-red-400' : ''}`}
                                      >
                                        <m.icon className="w-4 h-4" />
                                        {m.label}
                                      </button>
                                    ))}
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="px-6 py-8 text-center opacity-30 text-xs">
                        {group.status === 'failed' ? (
                          <div className="flex flex-col items-center gap-2">
                             <AlertCircle className="w-6 h-6 text-red-500/50" />
                             <span>생성 실패: {group.apiStatusResponse?.msg || group.apiResponse?.msg || '알 수 없는 오류'}</span>
                          </div>
                        ) : (
                          <span>오디오를 기다리는 중...</span>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {showDetails && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowDetails(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--bg-secondary)] border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h3 className="text-xl font-bold">상세 정보</h3>
                <button 
                  onClick={() => setShowDetails(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-all"
                >
                  <X className="w-6 h-6 opacity-40" />
                </button>
              </div>
              <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6 custom-scrollbar">
                <div className="grid grid-cols-2 gap-6">
                  <DetailItem label="제목" value={showDetails.title || 'Untitled'} />
                  <DetailItem label="상태" value={showDetails.status} isStatus />
                  <DetailItem label="생성일" value={formatCreatedAt(showDetails.createdAt)} />
                  <DetailItem label="Task ID" value={showDetails.taskId} isMono />
                  <DetailItem label="Suno Version" value={showDetails.requestPayload?.model || 'V5_5'} />
                  <DetailItem label="키워드/스타일" value={showDetails.style || showDetails.prompt || '없음'} full />
                  <DetailItem label="가사" value={showDetails.lyrics || '가사 없음'} full isPre />
                  <DetailItem label="오디오 URL" value={showDetails.audioUrl || showDetails.streamAudioUrl} full isMono />
                </div>
              </div>
              <div className="p-6 border-t border-white/5 text-center">
                <button 
                  onClick={() => setShowDetails(null)}
                  className="px-8 py-3 rounded-2xl bg-white/5 hover:bg-white/10 font-bold transition-all"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailItem({ label, value, full = false, isStatus = false, isMono = false, isPre = false }: any) {
  return (
    <div className={`${full ? 'col-span-2' : 'col-span-1'} space-y-1.5`}>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-30">{label}</span>
      <div className={`p-3 rounded-xl bg-white/5 border border-white/5 text-sm ${isMono ? 'font-mono break-all' : ''}`}>
        {isStatus ? (
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${value === 'completed' ? 'bg-green-500' : value === 'failed' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`} />
            <span className="capitalize">{value}</span>
          </div>
        ) : isPre ? (
          <pre className="whitespace-pre-wrap font-sans leading-relaxed opacity-70 italic">{value}</pre>
        ) : (
          <span className="opacity-80">{value || 'N/A'}</span>
        )}
      </div>
    </div>
  );
}

