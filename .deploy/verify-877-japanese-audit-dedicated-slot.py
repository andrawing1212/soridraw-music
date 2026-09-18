from pathlib import Path

service = Path('src/services/geminiService.ts').read_text(encoding='utf-8')
proxy = Path('src/services/geminiProxyClient.ts').read_text(encoding='utf-8')

service_required = [
    'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT',
    'usedDedicatedFinalJapaneseAuditOperations',
    "최종 일본어 네이티브 의미 검수 전용 호출은 곡당 1회만 허용됩니다.",
    "? `${sessionId.slice(0, 148)}:ja-final`",
    'serverSessionId,',
]
proxy_required = [
    'SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT',
    'const serverSessionId = String(meta.serverSessionId || sessionId).trim();',
    'sessionId: serverSessionId,',
]
missing_service = [item for item in service_required if item not in service]
missing_proxy = [item for item in proxy_required if item not in proxy]
if missing_service or missing_proxy:
    raise SystemExit(f'877 verification failed; service={missing_service}; proxy={missing_proxy}')

if service.count('const SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;') != 1:
    raise SystemExit('877 service marker count mismatch')
if proxy.count('const SORIDRAW_877_DEDICATED_JAPANESE_AUDIT_SLOT = true;') != 1:
    raise SystemExit('877 proxy marker count mismatch')

print('SORIDRAW 877 verification OK: final Japanese audit has one dedicated local slot and backend guard session')
