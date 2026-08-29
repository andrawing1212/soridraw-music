from pathlib import Path

source_path = Path('.deploy/apply-977-cache-live-cloudflare-mobile-dock.py')
source = source_path.read_text(encoding='utf-8')
label = "        'overlay expanded CF metrics',\n    )"

if source.count(label) != 1:
    raise RuntimeError(f'run-977: expanded metrics patch block mismatch: {source.count(label)}')

label_at = source.find(label)
start = source.rfind("    overlay = replace_once(\n", 0, label_at)
if start < 0:
    raise RuntimeError('run-977: expanded metrics replace_once start missing')
end = label_at + len(label)

replacement = r'''    # 925 legitimately inserts the SDK READ source panel between the actual-usage
    # row and the Cloud server row. Insert Cloudflare metrics after the actual-usage
    # row without assuming those two rows are adjacent, preserving the 925 UI intact.
    if 'Cloudflare 앱 · Worker' not in overlay:
        usage_token = '{formatActualUsage(actual)}</div>'
        usage_at = overlay.find(usage_token)
        if usage_at < 0:
            raise RuntimeError('apply-977: overlay expanded CF metrics actual-usage anchor missing')
        if overlay.find(usage_token, usage_at + len(usage_token)) >= 0:
            raise RuntimeError('apply-977: overlay expanded CF metrics actual-usage anchor ambiguous')
        line_end = overlay.find('\n', usage_at)
        if line_end < 0:
            raise RuntimeError('apply-977: overlay expanded CF metrics actual-usage line malformed')
        cf_metrics = """            <div className=\"whitespace-nowrap text-[9px] font-bold text-[#c6b5ff]\">
              Cloudflare 앱 · Worker {formatNumber(cloudflare.workerRequests)} · D1 읽기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsRead) : '—'} · 쓰기 {cloudflareMetered ? formatNumber(cloudflare.d1RowsWritten) : '—'}
            </div>
            <div className=\"whitespace-nowrap text-[8px] font-bold text-[#c6b5ff]/75\">
              R2 · Class A {cloudflareMetered ? formatNumber(cloudflare.r2ClassA) : '—'} · Class B {cloudflareMetered ? formatNumber(cloudflare.r2ClassB) : '—'}
            </div>
            {cloudflare.unmeteredResponses > 0 ? (
              <div className=\"whitespace-nowrap text-[7px] font-bold text-[#c6b5ff]/48\">
                Worker 계측 전 응답 {formatNumber(cloudflare.unmeteredResponses)} · 진단 Worker 배포 후 초기화 권장
              </div>
            ) : null}
"""
        overlay = overlay[:line_end + 1] + cf_metrics + overlay[line_end + 1:]'''

patched = source[:start] + replacement + source[end:]
if patched == source:
    raise RuntimeError('run-977: resilient patch produced no change')

namespace = {
    '__name__': '__main__',
    '__file__': str(source_path),
}
exec(compile(patched, str(source_path), 'exec'), namespace, namespace)

# Guard the compatibility promise: 925 source trace and 977 Cloudflare metrics
# must coexist in the final built source.
overlay = Path('src/components/CacheDiagnosticsOverlay.tsx').read_text(encoding='utf-8')
for token in ['SDK READ 발생처', 'Cloudflare 앱 · Worker', 'R2 · Class A']:
    if token not in overlay:
        raise RuntimeError(f'run-977: preserved CACHE LIVE feature missing after patch: {token}')

print('run-977: preserved 925 SDK source trace + applied 977 Cloudflare/mobile diagnostics')
