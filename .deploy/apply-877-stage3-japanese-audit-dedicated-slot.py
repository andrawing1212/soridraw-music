from pathlib import Path

service_path = Path('src/services/geminiService.ts')
service = service_path.read_text(encoding='utf-8')
proxy_path = Path('src/services/geminiProxyClient.ts')
proxy = proxy_path.read_text(encoding='utf-8')
marker = 'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT'
if marker in service and marker in proxy:
    print('877 dedicated Japanese audit slot already applied')
    raise SystemExit(0)

if 'SORIDRAW_876_JAPANESE_AUDIT_MICROTUNE' not in service:
    raise SystemExit('877 requires 876 Japanese audit microtune first')

# 1) Keep the existing five-call general budget, but allow exactly one final Japanese
# audit logical operation to run after it is exhausted. If reservation succeeded earlier,
# the audit still stays inside the original five; the extra slot is only used when needed.
budget_type_anchor = """type GeminiGenerationRequestBudget = {
  maxRequests: number;
  maxCorrectionRequests: number;
  usedRequests: number;
  usedCorrectionRequests: number;
  reservedFinalJapaneseAuditRequests: number;
};"""
budget_type_replacement = """type GeminiGenerationRequestBudget = {
  maxRequests: number;
  maxCorrectionRequests: number;
  usedRequests: number;
  usedCorrectionRequests: number;
  reservedFinalJapaneseAuditRequests: number;
  usedDedicatedFinalJapaneseAuditOperations: number;
};"""
if service.count(budget_type_anchor) != 1:
    raise SystemExit(f'877 budget type anchor mismatch: {service.count(budget_type_anchor)}')
service = service.replace(budget_type_anchor, budget_type_replacement, 1)

budget_init_anchor = """    usedRequests: 0,
    usedCorrectionRequests: 0,
    reservedFinalJapaneseAuditRequests: 0,
  });"""
budget_init_replacement = """    usedRequests: 0,
    usedCorrectionRequests: 0,
    reservedFinalJapaneseAuditRequests: 0,
    usedDedicatedFinalJapaneseAuditOperations: 0,
  });"""
if service.count(budget_init_anchor) != 1:
    raise SystemExit(f'877 budget init anchor mismatch: {service.count(budget_init_anchor)}')
service = service.replace(budget_init_anchor, budget_init_replacement, 1)

consume_anchor = """  const reservedForFinalJapaneseAudit = Math.max(0, budget.reservedFinalJapaneseAuditRequests || 0);
  const isFinalJapaneseAudit = String(context || '').trim() === '일본어 네이티브 의미 검수';
  const effectiveMaxForOtherCalls = Math.max(0, budget.maxRequests - reservedForFinalJapaneseAudit);
  if (!isFinalJapaneseAudit && reservedForFinalJapaneseAudit > 0 && budget.usedRequests >= effectiveMaxForOtherCalls) {
    throw new GeminiRequestBudgetExceededError(
      `최종 일본어 네이티브 의미 검수 1회를 위해 남은 호출을 예약하여 ${context} 호출을 생략했습니다.`,
    );
  }
  if (budget.usedRequests >= budget.maxRequests) {
    throw new GeminiRequestBudgetExceededError(
      `곡 생성 Gemini 호출 상한(${budget.maxRequests}회)에 도달해 ${context} 호출을 생략했습니다.`,
    );
  }"""
consume_replacement = """  const reservedForFinalJapaneseAudit = Math.max(0, budget.reservedFinalJapaneseAuditRequests || 0);
  const isFinalJapaneseAudit = String(context || '').trim() === '일본어 네이티브 의미 검수';
  const effectiveMaxForOtherCalls = Math.max(0, budget.maxRequests - reservedForFinalJapaneseAudit);
  if (isFinalJapaneseAudit) {
    if ((budget.usedDedicatedFinalJapaneseAuditOperations || 0) >= 1) {
      throw new GeminiRequestBudgetExceededError('최종 일본어 네이티브 의미 검수 전용 호출은 곡당 1회만 허용됩니다.');
    }
    budget.usedDedicatedFinalJapaneseAuditOperations += 1;
    budget.usedRequests += 1;
    return;
  }
  if (reservedForFinalJapaneseAudit > 0 && budget.usedRequests >= effectiveMaxForOtherCalls) {
    throw new GeminiRequestBudgetExceededError(
      `최종 일본어 네이티브 의미 검수 1회를 위해 남은 호출을 예약하여 ${context} 호출을 생략했습니다.`,
    );
  }
  if (budget.usedRequests >= budget.maxRequests) {
    throw new GeminiRequestBudgetExceededError(
      `곡 생성 Gemini 호출 상한(${budget.maxRequests}회)에 도달해 ${context} 호출을 생략했습니다.`,
    );
  }"""
if service.count(consume_anchor) != 1:
    raise SystemExit(f'877 consume anchor mismatch: {service.count(consume_anchor)}')
service = service.replace(consume_anchor, consume_replacement, 1)

# 2) A server-side fallback within the same dedicated audit operation is not a second
# browser audit operation. Do not let local accounting retroactively close the result.
server_account_anchor = """    if (index > 0) {
      try {
        consumeGeminiGenerationRequestBudget(sessionId, context, physicalAttempt);"""
server_account_replacement = """    if (index > 0 && String(context || '').trim() !== '일본어 네이티브 의미 검수') {
      try {
        consumeGeminiGenerationRequestBudget(sessionId, context, physicalAttempt);"""
if service.count(server_account_anchor) != 1:
    raise SystemExit(f'877 server accounting anchor mismatch: {service.count(server_account_anchor)}')
service = service.replace(server_account_anchor, server_account_replacement, 1)

# 3) Keep local audit logs grouped under the original song session, but use a dedicated
# backend guard session only for the final Japanese audit. This bypasses the shared five-call
# per-song Functions guard without changing or weakening that guard for normal generation.
forward_anchor = """        const context = meta?.context || 'Gemini 호출';
        consumeGeminiGenerationRequestBudget(sessionId, context, meta?.fallbackAttempt || 1);
        const startedAtMs = Date.now();"""
forward_replacement = """        const context = meta?.context || 'Gemini 호출';
        consumeGeminiGenerationRequestBudget(sessionId, context, meta?.fallbackAttempt || 1);
        const isDedicatedFinalJapaneseAudit = String(context || '').trim() === '일본어 네이티브 의미 검수';
        const serverSessionId = isDedicatedFinalJapaneseAudit
          ? `${sessionId.slice(0, 148)}:ja-final`
          : sessionId;
        const startedAtMs = Date.now();"""
if service.count(forward_anchor) != 1:
    raise SystemExit(f'877 forwarded context anchor mismatch: {service.count(forward_anchor)}')
service = service.replace(forward_anchor, forward_replacement, 1)

meta_anchor = """                  sessionId,
                  context,
                  fallbackAttempt: meta?.fallbackAttempt || 1,"""
meta_replacement = """                  sessionId,
                  serverSessionId,
                  context,
                  fallbackAttempt: meta?.fallbackAttempt || 1,"""
if service.count(meta_anchor) != 1:
    raise SystemExit(f'877 forwarded meta anchor mismatch: {service.count(meta_anchor)}')
service = service.replace(meta_anchor, meta_replacement, 1)

marker_anchor = "const SORIDRAW_876_JAPANESE_AUDIT_MICROTUNE = true;"
marker_replacement = marker_anchor + "\nconst SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;"
if service.count(marker_anchor) != 1:
    raise SystemExit(f'877 marker anchor mismatch: {service.count(marker_anchor)}')
service = service.replace(marker_anchor, marker_replacement, 1)
service_path.write_text(service, encoding='utf-8')

# 4) The Firebase proxy sends the dedicated server guard session while keeping the original
# session id for client-side audit grouping and UI history.
proxy_session_anchor = """  const sessionId = String(meta.sessionId || '').trim();
  const context = String(meta.context || 'Gemini 호출').trim();"""
proxy_session_replacement = """  const sessionId = String(meta.sessionId || '').trim();
  const serverSessionId = String(meta.serverSessionId || sessionId).trim();
  const context = String(meta.context || 'Gemini 호출').trim();"""
if proxy.count(proxy_session_anchor) != 1:
    raise SystemExit(f'877 proxy session anchor mismatch: {proxy.count(proxy_session_anchor)}')
proxy = proxy.replace(proxy_session_anchor, proxy_session_replacement, 1)

proxy_body_anchor = """      request: requestParams,
      sessionId,
      context,"""
proxy_body_replacement = """      request: requestParams,
      sessionId: serverSessionId,
      context,"""
if proxy.count(proxy_body_anchor) != 1:
    raise SystemExit(f'877 proxy body anchor mismatch: {proxy.count(proxy_body_anchor)}')
proxy = proxy.replace(proxy_body_anchor, proxy_body_replacement, 1)

proxy_marker_anchor = "async function generateContentViaFirebase(params: any): Promise<any> {"
proxy_marker_replacement = "const SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;\n\n" + proxy_marker_anchor
if proxy.count(proxy_marker_anchor) != 1:
    raise SystemExit(f'877 proxy marker anchor mismatch: {proxy.count(proxy_marker_anchor)}')
proxy = proxy.replace(proxy_marker_anchor, proxy_marker_replacement, 1)
proxy_path.write_text(proxy, encoding='utf-8')

print('Applied SORIDRAW 877: guaranteed final Japanese audit slot with dedicated backend guard session')
