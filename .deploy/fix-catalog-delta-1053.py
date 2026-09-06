from pathlib import Path

p = Path('src/lib/userDataEngine.ts')
s = p.read_text(encoding='utf-8')
bad = "  let allowDeltaSync = Boolean(localSnapshot && minimumRevision <= 0);\n"
if s.count(bad) != 1:
    raise SystemExit(f'expected exactly one misplaced allowDeltaSync, found {s.count(bad)}')
s = s.replace(bad, '', 1)
anchor = "  markCatalogRuntimeDiagnostic(kind, { stage: 'START', attempt: 0, httpStatus: 0, remoteItemCount: 0, revision: 0, errorCode: '' });\n  const retryDelays = [0, 350, 1000];\n  let lastError: unknown = null;\n  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {"
replacement = "  markCatalogRuntimeDiagnostic(kind, { stage: 'START', attempt: 0, httpStatus: 0, remoteItemCount: 0, revision: 0, errorCode: '' });\n  const retryDelays = [0, 350, 1000];\n  let lastError: unknown = null;\n  let allowDeltaSync = Boolean(localSnapshot && minimumRevision <= 0);\n  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {"
if anchor not in s:
    raise SystemExit('readRemoteCatalogSnapshot allowDeltaSync anchor missing')
s = s.replace(anchor, replacement, 1)
p.write_text(s, encoding='utf-8')
