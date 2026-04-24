import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Settings, Home, Music, RefreshCw, Play, Loader2, AlertCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function SunoLibraryPage() {
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusChecking, setStatusChecking] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
      const unsubscribeAuth = auth.onAuthStateChanged((currentUser) => {
        console.log("Suno Library 현재 rcZ2GZrBndOZzT8C635eiNBjYIJ2:", currentUser?.uid);
        console.log("Suno Library 현재 andrawing1212@gmail.com:", currentUser?.email);

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
        }));
        
        list.sort((a: any, b: any) => {
          const t1 = a.createdAt?.seconds || 0;
          const t2 = b.createdAt?.seconds || 0;
          return t2 - t1;
        });

        setTracks(list);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching tracks:", error);
        setLoading(false);
      });

      return () => unsubscribeSnapshot();
    });

    return () => unsubscribeAuth();
  }, []);

  const checkStatus = async (trackId: string, taskId: string) => {
    try {
      setStatusChecking(trackId);
      const user = auth.currentUser;
      if (!user) {
        alert("로그인이 필요합니다.");
        return;
      }
      const token = await user.getIdToken();
      const res = await fetch("https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ trackId, taskId })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`상태 확인 실패: ${data.error || "unknown error"}`);
        return;
      }
      if (data.status === "completed") {
        alert("생성 완료되었습니다.");
      } else if (data.status === "failed") {
        alert("생성에 실패했습니다.");
      } else {
        alert("아직 생성 중입니다.");
      }
    } catch (error) {
      console.error(error);
      alert("상태 확인 중 오류가 발생했습니다.");
    } finally {
      setStatusChecking(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">완료됨</span>;
      case 'failed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">실패</span>;
      case 'processing':
      case 'submitted':
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">생성 중...</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] px-4 md:px-6 pt-24 pb-16 text-[var(--text-primary)]">
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
                Suno Library
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Suno API로 생성한 곡을 조회하고 재생합니다.
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

        {/* Info Box */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl bg-brand-orange/5 border border-brand-orange/20 text-[var(--text-secondary)] text-sm space-y-2 leading-relaxed"
        >
          <p>💡 음원 파일은 서버에 저장되지 않고 외부 URL을 통해 바로 재생됩니다.</p>
          <p>💡 생성 중인 곡은 <strong>해당 곡 카드의 "상태 확인" 버튼</strong>을 눌러 결과를 가져올 수 있습니다.</p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h2 className="text-xl font-bold mb-2">로그인이 필요합니다</h2>
            <p className="text-[var(--text-secondary)]">Suno Library를 보려면 로그인해주세요.</p>
          </div>
        ) : tracks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]"
          >
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Music className="w-8 h-8 text-[var(--text-secondary)]/50" />
            </div>
            <h2 className="text-xl font-bold mb-2">아직 생성된 Suno API 곡이 없습니다.</h2>
            <p className="text-[var(--text-secondary)] mb-8">
              설정에서 API Key를 등록한 후 새로운 곡을 생성해보세요.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-xl bg-brand-orange text-white font-bold hover:bg-brand-orange/90 transition-all active:scale-95"
            >
              생성 페이지로 가기
            </button>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[var(--bg-secondary)] border border-white/10 rounded-2xl p-5 flex flex-col"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg leading-tight line-clamp-1">{track.title || "Untitled"}</h3>
                  {getStatusBadge(track.status)}
                </div>
                
                <div className="text-xs text-[var(--text-secondary)] flex flex-col gap-1 mb-4 flex-1">
                  <span className="line-clamp-2"><strong>스타일:</strong> {track.style || track.prompt || "없음"}</span>
                  <span className="line-clamp-3"><strong>가사:</strong> {track.lyrics || "없음"}</span>
                  <span className="text-white/30 text-[10px] mt-1 break-all">Task ID: {track.taskId}</span>
                  {track.apiResponse?.msg && track.status === 'failed' && (
                    <span className="text-red-400/80 bg-red-400/10 p-1.5 rounded mt-2 flex gap-1.5 items-start">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {track.apiResponse.msg}
                    </span>
                  )}
                </div>

                <div className="space-y-3 mt-auto">
                  {track.audioUrl || track.streamAudioUrl ? (
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                      <audio controls className="w-full h-10 outline-none" preload="metadata">
                        <source src={track.audioUrl || track.streamAudioUrl} type="audio/mpeg" />
                        브라우저가 오디오 재생을 지원하지 않습니다.
                      </audio>
                    </div>
                  ) : track.status !== "failed" && track.status !== "completed" ? (
                    <button
                      onClick={() => checkStatus(track.id, track.taskId)}
                      disabled={statusChecking === track.id}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {statusChecking === track.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      상태 확인
                    </button>
                  ) : null}
                  
                  <div className="text-right text-[10px] text-[var(--text-secondary)] opacity-50">
                    {track.createdAt ? new Date(track.createdAt.toDate()).toLocaleString() : ''}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
