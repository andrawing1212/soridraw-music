from pathlib import Path

service_path = Path('src/services/geminiService.ts')
audit_path = Path('src/services/geminiAuditLog.ts')
service = service_path.read_text(encoding='utf-8')
audit = audit_path.read_text(encoding='utf-8')
marker = 'SORIDRAW_883_LANGUAGE_MIX_AUDIT_GROUPING'
if marker in service:
    print('883 language-mix audit grouping already applied')
    raise SystemExit(0)

if 'SORIDRAW_882_LANGUAGE_MIX_SINGLE_CARD_CANDIDATE_POOL' not in service:
    raise SystemExit('883 requires 882 runtime first')

audit_anchor = "export function summarizeGeminiAuditSession(session: GeminiAuditSession): GeminiAuditUsage & {\n"
audit_helper = '''export function mergeGeminiAuditSessionIntoParent(
  childSessionId: string | undefined,
  parentSessionId: string | undefined,
): void {
  const childId = String(childSessionId || '').trim();
  const parentId = String(parentSessionId || '').trim();
  if (!childId || !parentId || childId === parentId) return;
  const sessions = readSessions();
  const child = sessions.find((session) => session.id === childId);
  const parent = sessions.find((session) => session.id === parentId);
  if (!child || !parent) return;
  const appendedCalls = child.calls.map((call, index) => ({
    ...call,
    sessionId: parentId,
    sequence: parent.calls.length + index + 1,
  }));
  const updatedParent: GeminiAuditSession = {
    ...parent,
    calls: [...parent.calls, ...appendedCalls],
    modelSkips: mergeModelSkips(parent.modelSkips, child.modelSkips || []),
  };
  writeSessions(
    sessions
      .filter((session) => session.id !== childId)
      .map((session) => session.id === parentId ? updatedParent : session),
  );
}

'''
if audit.count(audit_anchor) != 1:
    raise SystemExit(f'883 audit helper anchor mismatch: {audit.count(audit_anchor)}')
audit = audit.replace(audit_anchor, audit_helper + audit_anchor, 1)

import_anchor = '''  finishGeminiAuditSession,
  recordGeminiAuditCall,
  startGeminiAuditSession,
} from "./geminiAuditLog";'''
import_replacement = '''  finishGeminiAuditSession,
  mergeGeminiAuditSessionIntoParent,
  recordGeminiAuditCall,
  startGeminiAuditSession,
} from "./geminiAuditLog";'''
if service.count(import_anchor) != 1:
    raise SystemExit(f'883 audit import anchor mismatch: {service.count(import_anchor)}')
service = service.replace(import_anchor, import_replacement, 1)

marker_anchor = 'const SORIDRAW_882_LANGUAGE_MIX_SINGLE_CARD_CANDIDATE_POOL = true;'
if service.count(marker_anchor) != 1:
    raise SystemExit(f'883 marker anchor mismatch: {service.count(marker_anchor)}')
service = service.replace(marker_anchor, marker_anchor + '\nconst SORIDRAW_883_LANGUAGE_MIX_AUDIT_GROUPING = true;', 1)

finally_anchor = '''  } finally {
    endGeminiGenerationRequestBudget(auditSessionId);
  }
}

function mergeV1LanguageMixCandidateResponses('''
finally_replacement = '''  } finally {
    endGeminiGenerationRequestBudget(auditSessionId);
    mergeGeminiAuditSessionIntoParent(auditSessionId, args.params.__geminiAuditSessionId);
  }
}

function mergeV1LanguageMixCandidateResponses('''
if service.count(finally_anchor) != 1:
    raise SystemExit(f'883 language-mix audit finalizer anchor mismatch: {service.count(finally_anchor)}')
service = service.replace(finally_anchor, finally_replacement, 1)

service_path.write_text(service, encoding='utf-8')
audit_path.write_text(audit, encoding='utf-8')
print('Applied SORIDRAW 883: group completed language-mix audit children under the parent song-generation audit session')
