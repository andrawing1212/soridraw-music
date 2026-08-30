from pathlib import Path

path = Path('src/pages/SunoLibraryPage.tsx')
text = path.read_text(encoding='utf-8')
marker = '// SORIDRAW_EXPLORE_8C_STALE_LIBRARY_RECOVERY_950'

if marker in text:
    print('apply-950: already applied')
    raise SystemExit(0)


def replace_once(source: str, target: str, label: str) -> None:
    global text
    if source not in text:
        raise RuntimeError(f'apply-950: anchor not found: {label}')
    text = text.replace(source, target, 1)


# Metadata-only sunoData must not make an old pending task look healthy forever.
stale_fn_index = text.find('  const isTrackStuck = (group: any) => {')
if stale_fn_index < 0:
    raise RuntimeError('apply-950: isTrackStuck not found')
has_suno_index = text.find('const hasSunoData =', stale_fn_index)
collect_index = text.find('  const collectStatusCandidates = (source: any): string[] => {', stale_fn_index)
if has_suno_index < 0 or collect_index < 0 or has_suno_index > collect_index:
    raise RuntimeError('apply-950: stale metadata guard not found')
line_start = text.rfind('\n', 0, has_suno_index) + 1
if_index = text.find('if (hasAudioUrl || hasSunoData || hasAudioUrls)', has_suno_index, collect_index)
if if_index < 0:
    raise RuntimeError('apply-950: stale completion evidence condition not found')
if_close = text.find('\n    }', if_index, collect_index)
if if_close < 0:
    raise RuntimeError('apply-950: stale completion evidence block malformed')
replace_end = if_close + len('\n    }')
replacement = '''    const hasAudioUrls = Array.isArray(group?.audioUrls) && group.audioUrls.some((entry: any) => {
      const rawUrl = typeof entry === 'string'
        ? entry
        : entry?.url || entry?.audio_url || entry?.audioUrl || '';
      return typeof rawUrl === 'string' && rawUrl.trim().length > 0;
    });

    if (hasAudioUrl || hasAudioUrls) {
      return false;
    }'''
text = text[:line_start] + replacement + text[replace_end:]

# Wait until the normal 10-minute automatic polling window has finished.
collect_anchor = "  const collectStatusCandidates = (source: any): string[] => {"
collect_index = text.find(collect_anchor)
if collect_index < 0:
    raise RuntimeError('apply-950: collectStatusCandidates anchor not found')
helper_code = r'''  const isTrackPastAutoCheckWindow = (group: any) => {
    if (!isTrackStuck(group)) return false;

    let createdTime = 0;
    if (group?.createdAt?.seconds) {
      createdTime = group.createdAt.seconds * 1000;
    } else if (group?.createdAt?.toDate) {
      createdTime = group.createdAt.toDate().getTime();
    } else if (typeof group?.createdAt === 'string' || typeof group?.createdAt === 'number') {
      createdTime = new Date(group.createdAt).getTime();
    }

    if (!createdTime || !Number.isFinite(createdTime)) return false;
    return Date.now() - createdTime > 10 * 60 * 1000;
  };

'''
text = text[:collect_index] + helper_code + text[collect_index:]

# Keep one stale recovery attempt per track for the current SPA session.
replace_once(
    "  const [statusChecking, setStatusChecking] = useState<string | null>(null);",
    "  const [statusChecking, setStatusChecking] = useState<string | null>(null);\n  const staleRecoveryAttemptedRef = useRef<Set<string>>(new Set());",
    'stale recovery session ref',
)

# Replace the old direct 3-minute fail hook. Old pending tasks get one server
# status check after 10 minutes before they are finalized as failed.
safety_comment = '// Identify tracks that have been stuck for more than 3 minutes without audio URLs'
safety_comment_index = text.find(safety_comment)
if safety_comment_index < 0:
    raise RuntimeError('apply-950: old Suno Safety Hook comment not found')
safety_start = text.rfind('  useEffect(() => {', 0, safety_comment_index)
next_effect = text.find('  useEffect(() => {\n    if (isSharedView || !user) return;', safety_comment_index)
if safety_start < 0 or next_effect < 0:
    raise RuntimeError('apply-950: Suno Safety Hook boundaries not found')

new_safety_effect = r'''  useEffect(() => {
    if (!user || isSharedView || tracks.length === 0) return;

    const staleTracks = tracks.filter((group) => {
      const id = String(group?.id || '').trim();
      return Boolean(id)
        && isTrackPastAutoCheckWindow(group)
        && !staleRecoveryAttemptedRef.current.has(id)
        && !checkingIdsRef.current.has(id);
    });

    staleTracks.forEach((group) => {
      const id = String(group.id || '').trim();
      if (!id) return;

      staleRecoveryAttemptedRef.current.add(id);
      checkingIdsRef.current.add(id);

      void (async () => {
        const trackRef = doc(db, 'suno_tracks', user.uid, 'tracks', id);
        const markTimedOut = async (reason: string) => {
          await updateDoc(trackRef, {
            status: 'failed',
            failedAt: serverTimestamp(),
            failureReason: reason,
            errorMessage: reason,
            lastStatusRaw: 'timeout | stale_recovery',
            lastStatusCheckedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        };

        try {
          if (!group.taskId) {
            await markTimedOut('생성 상태 확인 불가 (10분 초과 · Task ID 없음)');
            return;
          }

          const token = await user.getIdToken();
          const res = await fetch('https://us-central1-soridraw-app-866a5.cloudfunctions.net/getSunoTrackStatus', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ trackId: id, taskId: group.taskId }),
          });

          let data: any = null;
          try {
            data = await res.json();
          } catch {
            data = null;
          }

          if (!res.ok || !data) {
            await markTimedOut('상태 조회 실패 및 생성 시간 초과 (10분 경과)');
            return;
          }

          const resolved = await syncStatusResponseToFirestore(id, group.taskId, data);
          const resolvedStatus = String(resolved?.status || '').toLowerCase();
          if (['completed', 'success', 'failed', 'cancelled', 'canceled'].includes(resolvedStatus)) {
            return;
          }

          await markTimedOut('생성 상태 장기 미확정 (10분 초과)');
        } catch (error) {
          console.warn(`[Suno stale recovery] ${id}`, error);
          try {
            await markTimedOut('상태 조회 실패 및 생성 시간 초과 (10분 경과)');
          } catch (writeError) {
            console.error('[Suno stale recovery] failed to finalize stale track:', writeError);
          }
        } finally {
          checkingIdsRef.current.delete(id);
        }
      })();
    });
  }, [tracks, user, isSharedView]);

'''
text = text[:safety_start] + new_safety_effect + text[next_effect:]

old_badge = '''      case 'processing':
      case 'submitted':
      case 'pending':
        badges.push(
          <span key="processing" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
             <Loader2 className="w-3 h-3 animate-spin" />
             생성 중...
          </span>
        );
        break;'''
new_badge = '''      case 'processing':
      case 'submitted':
      case 'pending':
        if (isTrackPastAutoCheckWindow(group)) {
          badges.push(
            <span key="stale-processing" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/12 text-amber-300">
              <RefreshCw className="w-3 h-3" />
              상태 확인 필요
            </span>
          );
        } else {
          badges.push(
            <span key="processing" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              생성 중...
            </span>
          );
        }
        break;'''
replace_once(old_badge, new_badge, 'stale status header badge')

replace_once(
    "                      const isPending = !isFailed && !audioUrl;",
    "                      const isStalePending = !isFailed && !audioUrl && isTrackPastAutoCheckWindow(group);\n                      const isPending = !isFailed && !audioUrl && !isStalePending;",
    'workspace stale pending state',
)

old_pending_row = '''                            ) : isPending ? (
                              <span className="text-xs opacity-50 truncate flex items-center gap-1.5 text-blue-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                생성 중...
                              </span>
                            ) : null}'''
new_pending_row = '''                            ) : isStalePending ? (
                              <span className="text-xs opacity-60 truncate flex items-center gap-1.5 text-amber-300">
                                <RefreshCw className="w-3.5 h-3.5" />
                                상태 확인 필요
                              </span>
                            ) : isPending ? (
                              <span className="text-xs opacity-50 truncate flex items-center gap-1.5 text-blue-400">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                생성 중...
                              </span>
                            ) : null}'''
replace_once(old_pending_row, new_pending_row, 'workspace stale pending label')

text = text.replace('export default function SunoLibraryPage', marker + '\nexport default function SunoLibraryPage', 1)

required = [
    'const isTrackPastAutoCheckWindow = (group: any) =>',
    'staleRecoveryAttemptedRef',
    '생성 상태 장기 미확정 (10분 초과)',
    '상태 확인 필요',
    'const isStalePending =',
]
for fragment in required:
    if fragment not in text:
        raise RuntimeError(f'apply-950: verification failed: {fragment}')
if 'hasAudioUrl || hasSunoData || hasAudioUrls' in text:
    raise RuntimeError('apply-950: metadata-only stale bypass still present')

path.write_text(text, encoding='utf-8')
print('apply-950: normal routing preserved and stale Library status recovery verified')
