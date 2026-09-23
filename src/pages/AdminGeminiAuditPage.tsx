import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Cpu,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import AdminPageLayout from '../components/AdminPageLayout';
import {
  clearGeminiAuditSessions,
  GEMINI_AUDIT_EVENT,
  getGeminiAuditSessions,
  summarizeGeminiAuditSession,
  type GeminiAuditModelSkip,
  type GeminiAuditSession,
} from '../services/geminiAuditLog';
import {
  getV1ProductionCueOwnershipAudits,
  V1_PRODUCTION_CUE_OWNERSHIP_AUDIT_EVENT,
  type V1ProductionCueOwnershipAuditItem,
} from '../services/generation/v1/sections/productionCueOwnership';

const CONTEXT_LABELS: Record<string, string> = {
  generateSong: '최초 곡 생성',
  'generateSong v2 clean-room': 'V2 최초 곡 생성',
  generateSongCompactFallback: '간소화 긴급 생성',
  repairClassicAtmosphereFromSource: '분위기 문장 보완',
  repairMissingV1Sections: '누락 섹션 보완',
  repairV1SectionBodies: '섹션 본문 보완',
  repairSparseLyrics: '가사 밀도 보완',
  repairSparseLyricsSecondPass: '가사 밀도 2차 보완',
  languageMixWholeLyricRetry: '언어 혼합 재작성',
  languageMixLockedWholeRewrite: '언어 혼합 가사 재작성',
  repairV1FinalProductionCues: '섹션 지시문 보완',
  rewriteLyricHardBanLines: '금지어 줄 교정',
  rewriteLyricHardBanLinesSecondPass: '금지어 2차 교정',
  rewriteLyricHardBanCards: '금지어 통합 교정',
  regenerateLyricsOnly: '가사 새로고침',
  translateTitleAndLyrics: '제목·가사 번역',
  translateLyrics: '가사 번역',
  translateKoreanTitleToEnglish: '한국어 제목 영어 변환',
  generateCustomSectionMetadata: '사용자 섹션 분석',
};

const SORIDRAW_888_ADMIN_CONTEXT_LABELS = true;

function contextLabel(context: string): string {
  const clean = String(context || '').trim();
  if (clean.startsWith('languageMixLockedWholeRewrite')) return '언어 혼합 가사 재작성';
  return CONTEXT_LABELS[clean] || clean || 'Gemini 호출';
}

function productionCueOwnerReasonText(reason: V1ProductionCueOwnershipAuditItem['ownerReasons'][number]): string {
  if (reason === 'canonical-plan') return '곡 설계에 실제 사운드 이벤트 있음';
  if (reason === 'custom-production') return '사용자 섹션에 악기/효과 지시 있음';
  return '연주·브레이크 등 프로덕션 전용 섹션';
}

function numberText(value: number): string {
  return Math.max(0, Number(value) || 0).toLocaleString('ko-KR');
}

function durationText(ms: number): string {
  const safe = Math.max(0, Number(ms) || 0);
  if (safe < 1000) return `${Math.round(safe)}ms`;
  if (safe < 60_000) return `${(safe / 1000).toFixed(1)}초`;
  const minutes = Math.floor(safe / 60_000);
  const seconds = Math.round((safe % 60_000) / 1000);
  return `${minutes}분 ${seconds}초`;
}

function dateText(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function geminiErrorText(value?: string): string {
  const clean = String(value || '').trim();
  if (!clean) return '';

  const exactReasons: Record<string, string> = {
    model_unavailable_or_overloaded: '모델을 일시적으로 사용할 수 없거나 요청이 몰린 상태',
    daily_quota_exhausted: '무료 등급 일일 요청 한도 소진 · 태평양 시간 자정 리셋까지 건너뜀',
    quota_or_rate_limit: '요청 한도 또는 할당량 초과',
    model_not_found_or_rollout: '모델을 찾을 수 없거나 단계적 배포 중',
    attempt_timeout: '응답 시간 초과',
  };
  if (exactReasons[clean]) return exactReasons[clean];

  let translated = clean;

  translated = translated.replace(
    /Rate limit exceeded for model\s+([^\s(]+)\s*\(limit:\s*(\d+)\s+requests per day on Free Tier\)\.\s*(?:Please retry in\s*(\d+)s\s*or\s*)?(?:Please retry later\s*or\s*)?upgrade your tier at\s*https?:\/\/\S+\.?/gi,
    (_match, model, limit, retrySeconds) =>
      retrySeconds
        ? `${model}의 무료 등급 일일 요청 한도(${limit}회)를 초과했습니다. ${retrySeconds}초 후 다시 시도하거나 API 요금제와 사용 한도를 확인해 주세요.`
        : `${model}의 무료 등급 일일 요청 한도(${limit}회)를 초과했습니다. 태평양 시간 자정 리셋 후 다시 시도하거나 API 요금제와 사용 한도를 확인해 주세요.`,
  );

  translated = translated.replace(
    /Rate limit exceeded for model\s+([^\s(]+)(?:\s*\([^)]*\))?(?:\.\s*[^\n]*)?/gi,
    (_match, model) => `${model}의 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.`,
  );

  translated = translated.replace(
    /(gemini-[\w.-]+)\s+is currently experiencing high demand,?\s*spikes in demand are usually temporary\.?/gi,
    (_match, model) =>
      `${model}에 현재 요청이 몰려 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.`,
  );

  translated = translated.replace(
    /This model is currently experiencing high demand\.\s*Spikes in demand are usually temporary\.\s*Please try again later\.?/gi,
    '현재 해당 Gemini 모델에 요청이 몰려 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  );

  translated = translated.replace(
    /The operation was aborted due to timeout\.?/gi,
    '응답 시간이 초과되어 요청이 중단되었습니다.',
  );

  translated = translated.replace(
    /Resource has been exhausted\.?/gi,
    '현재 사용 가능한 요청 한도 또는 자원이 소진되었습니다.',
  );

  translated = translated.replace(
    /Too many requests\.?/gi,
    '요청이 너무 많아 일시적으로 처리할 수 없습니다.',
  );

  translated = translated.replace(
    /Please retry in\s*(\d+)s\.?/gi,
    (_match, retrySeconds) => `${retrySeconds}초 후 다시 시도해 주세요.`,
  );

  translated = translated.replace(
    /Please try again later\.?/gi,
    '잠시 후 다시 시도해 주세요.',
  );

  translated = translated.replace(
    /upgrade your tier/gi,
    'API 요금제를 상향해 주세요',
  );

  translated = translated
    .replace(/model_unavailable_or_overloaded/gi, '모델을 일시적으로 사용할 수 없거나 요청이 몰린 상태')
    .replace(/daily_quota_exhausted/gi, '무료 등급 일일 요청 한도 소진 · 태평양 시간 자정 리셋까지 건너뜀')
    .replace(/quota_or_rate_limit/gi, '요청 한도 또는 할당량 초과')
    .replace(/model_not_found_or_rollout/gi, '모델을 찾을 수 없거나 단계적 배포 중');

  return translated;
}

function modelSkipReasonText(skip: GeminiAuditModelSkip): string {
  if (skip.reason === 'in_flight') return '다른 생성이 같은 모델 시험 중';
  if (skip.reason === 'slow_success') return '같은 곡에서 느린 성공 모델 제외';
  if (skip.reason === 'cooldown') {
    const remaining = skip.remainingMs ? ` · ${durationText(skip.remainingMs)} 남음` : '';
    return `쿨다운${remaining}`;
  }
  return geminiErrorText(skip.detail) || '모델 상태 정책으로 제외';
}

function statusBadge(session: GeminiAuditSession) {
  if (session.status === 'success') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-1 text-[11px] font-black text-emerald-400">
        <CheckCircle2 className="h-3 w-3" /> 완료
      </span>
    );
  }
  if (session.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2 py-1 text-[11px] font-black text-red-400">
        <AlertTriangle className="h-3 w-3" /> 실패
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-1 text-[11px] font-black text-amber-300">
      <RefreshCw className="h-3 w-3 animate-spin" /> 진행 중
    </span>
  );
}

export default function AdminGeminiAuditPage() {
  const [sessions, setSessions] = useState<GeminiAuditSession[]>(() => getGeminiAuditSessions());
  const [cueOwnershipAudits, setCueOwnershipAudits] = useState(() => getV1ProductionCueOwnershipAudits());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = () => {
    setSessions(getGeminiAuditSessions());
    setCueOwnershipAudits(getV1ProductionCueOwnershipAudits());
  };

  useEffect(() => {
    const handleUpdate = () => refresh();
    window.addEventListener(GEMINI_AUDIT_EVENT, handleUpdate);
    window.addEventListener(V1_PRODUCTION_CUE_OWNERSHIP_AUDIT_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(GEMINI_AUDIT_EVENT, handleUpdate);
      window.removeEventListener(V1_PRODUCTION_CUE_OWNERSHIP_AUDIT_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const totals = useMemo(() => {
    return sessions.reduce((acc, session) => {
      const summary = summarizeGeminiAuditSession(session);
      acc.sessions += 1;
      acc.calls += summary.callCount;
      acc.prompt += summary.promptTokens;
      acc.output += summary.outputTokens;
      acc.thoughts += summary.thoughtsTokens;
      acc.cached += summary.cachedTokens;
      acc.total += summary.totalTokens;
      acc.failed += summary.failedCallCount;
      return acc;
    }, { sessions: 0, calls: 0, prompt: 0, output: 0, thoughts: 0, cached: 0, total: 0, failed: 0 });
  }, [sessions]);

  const handleClear = () => {
    if (!window.confirm('이 기기에 저장된 Gemini 호출 기록을 모두 삭제할까요?')) return;
    clearGeminiAuditSessions();
    setExpandedId(null);
    refresh();
  };

  return (
    <AdminPageLayout
      title="Gemini 호출 기록"
      description="일반 사용자에게는 보이지 않는 관리자용 호출·토큰 감사 화면입니다."
      actions={(
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-btn-border bg-btn-bg px-3 text-xs font-black text-[var(--text-secondary)] transition hover:bg-btn-hover hover:text-[var(--text-primary)]"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 새로고침
          </button>
          <button
            onClick={handleClear}
            disabled={!sessions.length}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 text-xs font-black text-red-400 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 className="h-3.5 w-3.5" /> 기록 삭제
          </button>
        </div>
      )}
    >
      <div className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.055] px-4 py-3 text-xs leading-5 text-amber-100/75">
        현재 기록은 <strong className="text-amber-200">이 브라우저·이 기기에서 발생한 호출만</strong> 저장합니다. 프롬프트와 가사 원문은 저장하지 않고, 호출 사유·모델·토큰·시간·오류만 보관합니다.<br />
        곡 생성은 <strong className="text-amber-200">실제 API 요청 최대 5회</strong>, 그중 자동 품질 보정은 <strong className="text-amber-200">최대 1회</strong>로 강제 제한됩니다. 정상 생성은 1회이고, 필수 섹션 누락·개발 섹션의 극단적 밀도 부족·금지어 교정이 실제로 필요할 때만 추가 호출됩니다.
      </div>

      {cueOwnershipAudits.length > 0 && (
        <div className="rounded-2xl border border-brand-orange/15 bg-brand-orange/[0.045] px-4 py-3">
          <div className="text-xs font-black text-[var(--text-primary)]">최근 섹션 지시문 보완 판정</div>
          <div className="mt-2 space-y-1.5">
            {cueOwnershipAudits.slice(0, 4).map((audit) => (
              <div key={`${audit.createdAt}-${audit.signature}`} className="rounded-xl bg-btn-bg px-3 py-2 text-[10px] leading-4 text-[var(--text-secondary)]">
                <div className="font-bold">{dateText(audit.createdAt)}{audit.repeatCount > 1 ? ` · 동일 판정 ${audit.repeatCount}회` : ''}</div>
                {audit.missing.map((item) => (
                  <div key={item.sectionName} className="mt-0.5">
                    <span className="font-black text-brand-orange">{item.sectionName}</span>
                    {' · '}
                    {item.ownerReasons.map(productionCueOwnerReasonText).join(' + ')}
                    {' · 렌더링된 사운드 지시 없음'}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: '작업 수', value: numberText(totals.sessions), icon: Activity },
          { label: '총 호출', value: numberText(totals.calls), icon: Cpu },
          { label: '총 토큰', value: numberText(totals.total), icon: Activity },
          { label: '실패 호출', value: numberText(totals.failed), icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-btn-border bg-[var(--bg-secondary)] p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
              <Icon className="h-3.5 w-3.5 text-brand-orange" /> {label}
            </div>
            <div className="mt-2 text-xl font-black text-[var(--text-primary)]">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['입력 토큰', totals.prompt],
          ['출력 토큰', totals.output],
          ['추론 토큰', totals.thoughts],
          ['캐시 적중', totals.cached],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-btn-border bg-btn-bg px-3 py-2.5">
            <div className="text-[11px] font-bold text-[var(--text-secondary)]">{label}</div>
            <div className="mt-1 text-sm font-black text-[var(--text-primary)]">{numberText(Number(value))}</div>
          </div>
        ))}
      </div>

      {!sessions.length ? (
        <div className="rounded-3xl border border-dashed border-btn-border bg-[var(--bg-secondary)] px-6 py-16 text-center">
          <Activity className="mx-auto h-9 w-9 text-[var(--text-secondary)]/35" />
          <p className="mt-3 text-sm font-black text-[var(--text-primary)]">아직 기록된 Gemini 호출이 없습니다.</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">이 기기에서 곡 생성이나 가사 새로고침을 실행하면 자동 기록됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const summary = summarizeGeminiAuditSession(session);
            const expanded = expandedId === session.id;
            return (
              <div key={session.id} className="overflow-hidden rounded-2xl border border-btn-border bg-[var(--bg-secondary)]">
                <button
                  onClick={() => setExpandedId(expanded ? null : session.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-btn-hover/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-black text-[var(--text-primary)]">{session.operation}</span>
                      {statusBadge(session)}
                      {summary.callCount > 1 && (
                        <span className="rounded-full bg-brand-orange/12 px-2 py-1 text-[11px] font-black text-brand-orange">
                          추가 호출 {summary.callCount - 1}회
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
                      <span>{dateText(session.startedAt)}</span>
                      <span>호출 {summary.callCount}회</span>
                      <span>전체 {numberText(summary.totalTokens)}토큰</span>
                      <span>{durationText(summary.durationMs)}</span>
                    </div>
                    {session.resultLabel && (
                      <p className="mt-1 truncate text-xs font-semibold text-[var(--text-secondary)]">{session.resultLabel}</p>
                    )}
                  </div>
                  {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" /> : <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />}
                </button>

                {expanded && (
                  <div className="border-t border-btn-border px-4 py-4">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      {[
                        ['입력', summary.promptTokens],
                        ['출력', summary.outputTokens],
                        ['추론', summary.thoughtsTokens],
                        ['전체', summary.totalTokens],
                        ['처리시간', durationText(summary.durationMs)],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl bg-btn-bg px-3 py-2.5">
                          <div className="text-[10px] font-bold text-[var(--text-secondary)]">{label}</div>
                          <div className="mt-1 text-xs font-black text-[var(--text-primary)]">
                            {typeof value === 'number' ? numberText(value) : value}
                          </div>
                        </div>
                      ))}
                    </div>

                    {session.errorMessage && (
                      <div className="mt-3 rounded-xl border border-red-500/15 bg-red-500/[0.07] px-3 py-2 text-xs leading-5 text-red-300">
                        {geminiErrorText(session.errorMessage)}
                      </div>
                    )}

                    {Boolean(session.modelSkips?.length) && (
                      <div className="mt-4 space-y-1.5">
                        {session.modelSkips!.map((skip) => (
                          <div key={skip.id} className="rounded-xl bg-amber-400/[0.065] px-3 py-2 text-[10px] leading-4 text-amber-100/80">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-black text-amber-300">{skip.model} 건너뜀</span>
                              <span>{modelSkipReasonText(skip)}</span>
                              <span className="text-[var(--text-secondary)]">· {contextLabel(skip.context)}</span>
                            </div>
                            {skip.detail && skip.reason !== 'in_flight' && (
                              <div className="mt-0.5 break-words text-[var(--text-secondary)]">사유: {geminiErrorText(skip.detail)}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      {session.calls.map((call) => (
                        <div key={call.id} className="rounded-xl border border-btn-border bg-btn-bg px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/5 px-1.5 text-[10px] font-black text-[var(--text-secondary)]">
                                {call.sequence}
                              </span>
                              <span className="truncate text-xs font-black text-[var(--text-primary)]">
                                {contextLabel(call.context)}
                              </span>
                              {call.fallbackAttempt > 1 && (
                                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-black text-amber-300">
                                  모델 재시도 {call.fallbackAttempt}차
                                </span>
                              )}
                            </div>
                            <span className={call.status === 'success' ? 'text-[10px] font-black text-emerald-400' : 'text-[10px] font-black text-red-400'}>
                              {call.status === 'success' ? '성공' : '실패'}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--text-secondary)]">
                            <span>{call.model}</span>
                            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {durationText(call.durationMs)}</span>
                            <span>입력 {numberText(call.usage.promptTokens)}</span>
                            <span>출력 {numberText(call.usage.outputTokens)}</span>
                            <span>추론 {numberText(call.usage.thoughtsTokens)}</span>
                            {call.usage.cachedTokens > 0 && <span>캐시 {numberText(call.usage.cachedTokens)}</span>}
                            <span>전체 {numberText(call.usage.totalTokens)}</span>
                          </div>
                          {call.usage.requestTotalChars > 0 && (
                            <div className="mt-2 rounded-lg bg-black/10 px-2.5 py-2 text-[10px] leading-4 text-[var(--text-secondary)]">
                              요청크기 {numberText(call.usage.requestTotalChars)}자
                              {' · '}내용 {numberText(call.usage.requestContentsChars)}
                              {' · '}시스템 {numberText(call.usage.requestSystemInstructionChars)}
                              {' · '}응답스키마 {numberText(call.usage.requestResponseSchemaChars)}
                              {' · '}기타설정 {numberText(call.usage.requestOtherConfigChars)}
                              {call.usage.requestFallbackInstructionChars > 0 && (
                                <> {' · '}fallback {numberText(call.usage.requestFallbackInstructionChars)}</>
                              )}
                            </div>
                          )}
                          {call.errorMessage && (
                            <p className="mt-2 break-words text-[10px] leading-4 text-red-300/80">{geminiErrorText(call.errorMessage)}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminPageLayout>
  );
}
