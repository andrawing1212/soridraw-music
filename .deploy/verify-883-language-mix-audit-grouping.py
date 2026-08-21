from pathlib import Path

service = Path('src/services/geminiService.ts').read_text(encoding='utf-8')
audit = Path('src/services/geminiAuditLog.ts').read_text(encoding='utf-8')
required_service = [
    'const SORIDRAW_883_LANGUAGE_MIX_AUDIT_GROUPING = true;',
    'mergeGeminiAuditSessionIntoParent,',
    'mergeGeminiAuditSessionIntoParent(auditSessionId, args.params.__geminiAuditSessionId);',
    "const auditSessionId = startGeminiAuditSession('언어 혼합 필수 재작성');",
    'beginGeminiGenerationRequestBudget(auditSessionId);',
    'endGeminiGenerationRequestBudget(auditSessionId);',
]
required_audit = [
    'export function mergeGeminiAuditSessionIntoParent(',
    'sessionId: parentId,',
    'sequence: parent.calls.length + index + 1,',
    '.filter((session) => session.id !== childId)',
]
for needle in required_service:
    if needle not in service:
        raise SystemExit(f'883 verifier missing service guard: {needle}')
for needle in required_audit:
    if needle not in audit:
        raise SystemExit(f'883 verifier missing audit helper guard: {needle}')
print('Verified SORIDRAW 883: audit UI grouping only; language-mix call and budget lifecycle preserved')
