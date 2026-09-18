from pathlib import Path

path = Path('src/services/geminiProxyClient.ts')
source = path.read_text(encoding='utf-8')
marker = 'SORIDRAW_887_LATENCY_FASTPATH'

if marker in source:
    print('887 latency fastpath already applied')
    raise SystemExit(0)

before = """const INITIAL_SONG_MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;"""

after = """const SORIDRAW_887_LATENCY_FASTPATH = true;
const INITIAL_SONG_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;"""

count = source.count(before)
if count != 1:
    raise SystemExit(f'887 latency fastpath anchor mismatch: {count}')

path.write_text(source.replace(before, after, 1), encoding='utf-8')
print('Applied SORIDRAW 887 latency fastpath: initial 3.7 probe bypassed.')
