from pathlib import Path

MARKER = 'SORIDRAW_890_GEMINI_KEY_SIMPLE_UI'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


client_path = Path('src/components/SunoApiSettingsPanel.tsx')
client_source = client_path.read_text(encoding='utf-8')

if MARKER not in client_source:
    client_source = replace_once(
        client_source,
        "type GoogleKeyMeta = { alias: string; last6: string; updatedAt: string | null };",
        "type GoogleKeyMeta = { last6: string; updatedAt: string | null };",
        'meta type',
    )
    client_source = replace_once(
        client_source,
        " return { alias: String(parsed?.alias || ''), last6, updatedAt: parsed?.updatedAt || null };",
        " return { last6, updatedAt: parsed?.updatedAt || null };",
        'stored meta helper',
    )
    client_source = replace_once(
        client_source,
        ' googleKeyAlias,\n setGoogleKeyAlias,\n googleKeyMeta,',
        ' googleKeyMeta,',
        'modal destructure alias',
    )
    client_source = replace_once(
        client_source,
        ' googleKeyAlias?: string;\n setGoogleKeyAlias?: (value: string) => void;\n googleKeyMeta?: GoogleKeyMeta | null;',
        ' googleKeyMeta?: GoogleKeyMeta | null;',
        'modal prop types alias',
    )

    identity_block = ''' {type === 'google' && isRegistered && googleKeyMeta?.last6 && (\n <div className="px-1 text-xs font-semibold text-white/45">\n 현재 키 · {googleKeyMeta.alias || '별칭 없음'} · ••••••{googleKeyMeta.last6}{googleKeyMeta.updatedAt ? ` · ${new Date(googleKeyMeta.updatedAt).toLocaleDateString('ko-KR')}` : ''}\n </div>\n )}\n\n {type === 'google' && (\n <div className="space-y-2">\n <label className="ml-1 block text-sm font-black text-white/60">키 별칭 <span className="font-medium text-white/30">(선택)</span></label>\n <input\n type="text"\n value={googleKeyAlias || ''}\n onChange={(event) => setGoogleKeyAlias?.(event.target.value.slice(0, 30))}\n placeholder="예: 메인 프로젝트"\n className="w-full rounded-2xl bg-white/[0.045] px-4 py-3 text-white transition-all outline-none placeholder:text-white/30 focus:ring-1 focus:ring-[#ff5f9f]/25"\n />\n </div>\n )}\n\n'''
    client_source = replace_once(
        client_source,
        identity_block,
        '',
        'remove alias/current-key block',
    )

    client_source = replace_once(
        client_source,
        " const inputPlaceholder = isRegistered ? '새 API Key를 입력하면 기존 키를 변경합니다.' : 'API Key를 입력하세요.';",
        " const inputPlaceholder = isRegistered ? '새 API Key를 입력하면 기존 키를 변경합니다.' : 'API Key를 입력하세요.';\n const maskedGoogleKey = type === 'google' && isRegistered && googleKeyMeta?.last6 ? `••••••••••••••••••••••${googleKeyMeta.last6}` : '';\n const displayedPlaceholder = maskedGoogleKey || inputPlaceholder;\n const googleInputLabel = type === 'google' && isRegistered ? 'API 저장완료' : 'API Key 입력';",
        'saved-state display helpers',
    )
    client_source = replace_once(
        client_source,
        ' <label className="ml-1 block text-sm font-black text-white/60">API Key 입력</label>',
        " <label className=\"ml-1 block text-sm font-black text-white/60\">{type === 'google' ? googleInputLabel : 'API Key 입력'}</label>",
        'input label',
    )
    client_source = replace_once(
        client_source,
        ' type="password"\n value={inputValue}\n onChange={(event) => setInputValue(event.target.value)}\n placeholder={inputPlaceholder}\n autoFocus',
        ''' type={type === 'google' ? 'text' : 'password'}\n value={inputValue}\n onChange={(event) => setInputValue(event.target.value)}\n placeholder={displayedPlaceholder}\n name={type === 'google' ? 'soridraw-gemini-api-token' : 'soridraw-music-api-token'}\n autoComplete={type === 'google' ? 'off' : 'new-password'}\n autoCapitalize="none"\n spellCheck={false}\n style={type === 'google' && inputValue ? ({ WebkitTextSecurity: 'disc' } as React.CSSProperties & { WebkitTextSecurity?: string }) : undefined}\n autoFocus''',
        'api input behavior',
    )

    client_source = replace_once(
        client_source,
        " const initialGoogleKeyMeta = getStoredGoogleKeyMeta(auth.currentUser?.uid);\n const [googleKeyAlias, setGoogleKeyAlias] = useState(initialGoogleKeyMeta?.alias || '');\n const [googleKeyMeta, setGoogleKeyMeta] = useState<GoogleKeyMeta | null>(initialGoogleKeyMeta);",
        " const initialGoogleKeyMeta = getStoredGoogleKeyMeta(auth.currentUser?.uid);\n const [googleKeyMeta, setGoogleKeyMeta] = useState<GoogleKeyMeta | null>(initialGoogleKeyMeta);",
        'remove alias state',
    )
    client_source = client_source.replace(" setGoogleKeyAlias(storedGoogleKeyMeta?.alias || '');\n", '', 1)
    client_source = replace_once(
        client_source,
        " const nextGoogleKeyMeta = String(result.keyLast6 || '').trim()\n ? { alias: String(result.keyAlias || storedGoogleKeyMeta?.alias || ''), last6: String(result.keyLast6 || '').slice(-6), updatedAt: result.updatedAt || storedGoogleKeyMeta?.updatedAt || null }\n : storedGoogleKeyMeta;\n setGoogleKeyAlias(nextGoogleKeyMeta?.alias || '');\n setGoogleKeyMeta(nextGoogleKeyMeta);",
        " const nextGoogleKeyMeta = String(result.keyLast6 || '').trim()\n ? { last6: String(result.keyLast6 || '').slice(-6), updatedAt: result.updatedAt || storedGoogleKeyMeta?.updatedAt || null }\n : storedGoogleKeyMeta;\n setGoogleKeyMeta(nextGoogleKeyMeta);",
        'status meta alias removal',
    )
    client_source = client_source.replace(" setGoogleKeyAlias('');\n", '', 1)
    client_source = replace_once(
        client_source,
        ' body: JSON.stringify({ apiKey: googleApiKey.trim(), alias: googleKeyAlias.trim() })',
        ' body: JSON.stringify({ apiKey: googleApiKey.trim() })',
        'save request alias removal',
    )
    client_source = replace_once(
        client_source,
        " const nextGoogleKeyMeta = { alias: googleKeyAlias.trim(), last6: googleApiKey.trim().slice(-6), updatedAt: new Date().toISOString() };",
        " const nextGoogleKeyMeta = { last6: googleApiKey.trim().slice(-6), updatedAt: new Date().toISOString() };",
        'save meta alias removal',
    )
    client_source = client_source.replace(" setGoogleKeyAlias('');\n", '', 1)
    client_source = replace_once(
        client_source,
        ' googleKeyAlias={googleKeyAlias}\n setGoogleKeyAlias={setGoogleKeyAlias}\n googleKeyMeta={googleKeyMeta}',
        ' googleKeyMeta={googleKeyMeta}',
        'modal props alias removal',
    )
    client_source = client_source.replace(
        '// SORIDRAW_889_GEMINI_KEY_IDENTITY\n',
        f'// {MARKER}\n// SORIDRAW_889_GEMINI_KEY_IDENTITY\n',
        1,
    )

    client_path.write_text(client_source, encoding='utf-8')
    print('Applied SORIDRAW 890: simple saved Gemini API key UI with masked last 6 chars.')
else:
    print('890 Gemini key simple UI already applied.')

# 891 makes the Gemini key metadata cache-first so reopening the app does not
# call the status endpoint again when this device already has usable metadata.
apply_891 = Path('.deploy/apply-891-google-key-cache-first.py')
if apply_891.exists():
    exec(compile(apply_891.read_text(encoding='utf-8'), str(apply_891), 'exec'), {'__name__': '__main__'})
