from pathlib import Path

path = Path('src/components/CacheDiagnosticsOverlay.tsx')
text = path.read_text(encoding='utf-8')

if 'Cloudflare 앱 · Worker' in text:
    print('preflight-977: expanded Cloudflare metrics already present')
    raise SystemExit(0)

expected = '            <div className="whitespace-nowrap text-[9px] font-bold text-white/66">{formatActualUsage(actual)}</div>\n            {serverUsage ? ('
if expected in text:
    print('preflight-977: anchor already canonical')
    raise SystemExit(0)

usage_token = '{formatActualUsage(actual)}</div>'
server_token = '{serverUsage ? ('
usage_at = text.find(usage_token)
if usage_at < 0:
    raise RuntimeError('preflight-977: formatActualUsage anchor missing')
line_start = text.rfind('\n', 0, usage_at) + 1
line_end = text.find('\n', usage_at)
if line_end < 0:
    raise RuntimeError('preflight-977: formatActualUsage line malformed')

server_at = text.find(server_token, line_end)
if server_at < 0:
    raise RuntimeError('preflight-977: serverUsage anchor missing')

between = text[line_end + 1:server_at]
if between.strip():
    raise RuntimeError('preflight-977: non-whitespace content exists between actual usage and server usage; refusing to rewrite')

canonical_usage_line = '            <div className="whitespace-nowrap text-[9px] font-bold text-white/66">{formatActualUsage(actual)}</div>'
canonical_server_line = '            {serverUsage ? ('
server_line_end = text.find('\n', server_at)
if server_line_end < 0:
    server_line_end = server_at + len(server_token)
else:
    server_line_end = server_line_end

text = text[:line_start] + canonical_usage_line + '\n' + canonical_server_line + text[server_at + len(server_token):]
path.write_text(text, encoding='utf-8')
print('preflight-977: normalized CACHE LIVE expanded metrics anchor')
