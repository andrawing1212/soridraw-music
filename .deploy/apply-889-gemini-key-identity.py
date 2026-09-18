from pathlib import Path

MARKER = 'SORIDRAW_889_GEMINI_KEY_IDENTITY'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)

# --- Firebase Functions: additive metadata only, no key exposure ---
functions_path = Path('functions/src/index.ts')
functions_source = functions_path.read_text(encoding='utf-8')
if MARKER not in functions_source:
    functions_source = replace_once(
        functions_source,
        '    const normalizedApiKey = normalizeGeminiApiKey(req.body?.apiKey);\n    if (!normalizedApiKey) {',
        "    const normalizedApiKey = normalizeGeminiApiKey(req.body?.apiKey);\n    const googleGeminiKeyAlias = String(req.body?.alias || '').trim().slice(0, 30);\n    if (!normalizedApiKey) {",
        'functions save alias',
    )
    functions_source = replace_once(
        functions_source,
        '      googleGeminiProvider: "Google AI Studio",\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        '      googleGeminiProvider: "Google AI Studio",\n      googleGeminiKeyAlias: googleGeminiKeyAlias || admin.firestore.FieldValue.delete(),\n      googleGeminiKeyLast6: normalizedApiKey.slice(-6),\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        'functions save metadata',
    )
    functions_source = replace_once(
        functions_source,
        '      googleGeminiProvider: admin.firestore.FieldValue.delete(),\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        '      googleGeminiProvider: admin.firestore.FieldValue.delete(),\n      googleGeminiKeyAlias: admin.firestore.FieldValue.delete(),\n      googleGeminiKeyLast6: admin.firestore.FieldValue.delete(),\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        'functions delete metadata',
    )
    functions_source = replace_once(
        functions_source,
        '      provider: docData.googleGeminiProvider || null,\n      updatedAt: timestampToIso(docData.googleGeminiUpdatedAt),',
        "      provider: docData.googleGeminiProvider || null,\n      keyAlias: String(docData.googleGeminiKeyAlias || '').trim() || null,\n      keyLast6: String(docData.googleGeminiKeyLast6 || docData.googleGeminiApiKey || '').slice(-6) || null,\n      updatedAt: timestampToIso(docData.googleGeminiUpdatedAt),",
        'functions status metadata',
    )
    functions_source = functions_source.replace(
        'admin.initializeApp({',
        '// ' + MARKER + '\nadmin.initializeApp({',
        1,
    )
    functions_path.write_text(functions_source, encoding='utf-8')
    print('Applied 889 Firebase key identity metadata.')
else:
    print('889 Firebase key identity metadata already applied.')

# --- Client: compact single-line current-key identity + optional alias input ---
client_path = Path('src/components/SunoApiSettingsPanel.tsx')
client_source = client_path.read_text(encoding='utf-8')
if MARKER not in client_source:
    client_source = replace_once(
        client_source,
        "const GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_google_gemini_api_key_registered';",
        "const GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE = 'soridraw_google_gemini_api_key_registered';\nconst GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE = 'soridraw_google_gemini_api_key_meta';",
        'client meta storage constant',
    )
    client_source = replace_once(
        client_source,
        "type ApiModalType = 'google' | 'music' | null;",
        "type ApiModalType = 'google' | 'music' | null;\n\ntype GoogleKeyMeta = { alias: string; last6: string; updatedAt: string | null };",
        'client meta type',
    )
    client_source = replace_once(
        client_source,
        "function getStoredGoogleApiKeyStatus(uid?: string | null) {\n try {\n return localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) === 'true';\n } catch {\n return false;\n }\n}\n",
        "function getStoredGoogleApiKeyStatus(uid?: string | null) {\n try {\n return localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) === 'true';\n } catch {\n return false;\n }\n}\n\nfunction getStoredGoogleKeyMeta(uid?: string | null): GoogleKeyMeta | null {\n try {\n const raw = localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, uid));\n if (!raw) return null;\n const parsed = JSON.parse(raw);\n const last6 = String(parsed?.last6 || '').slice(-6);\n if (!last6) return null;\n return { alias: String(parsed?.alias || ''), last6, updatedAt: parsed?.updatedAt || null };\n } catch {\n return null;\n }\n}\n",
        'client meta storage helper',
    )
    client_source = replace_once(
        client_source,
        ' isRegistered,\n isLoading,\n onClose,',
        ' isRegistered,\n isLoading,\n googleKeyAlias,\n setGoogleKeyAlias,\n googleKeyMeta,\n onClose,',
        'modal destructure',
    )
    client_source = replace_once(
        client_source,
        ' isRegistered: boolean;\n isLoading: boolean;\n onClose: () => void;',
        ' isRegistered: boolean;\n isLoading: boolean;\n googleKeyAlias?: string;\n setGoogleKeyAlias?: (value: string) => void;\n googleKeyMeta?: GoogleKeyMeta | null;\n onClose: () => void;',
        'modal prop types',
    )
    client_source = replace_once(
        client_source,
        ' <div className="space-y-2">\n <label className="ml-1 block text-sm font-black text-white/60">API Key 입력</label>',
        ''' {type === 'google' && isRegistered && googleKeyMeta?.last6 && (\n <div className="px-1 text-xs font-semibold text-white/45">\n 현재 키 · {googleKeyMeta.alias || '별칭 없음'} · ••••••{googleKeyMeta.last6}{googleKeyMeta.updatedAt ? ` · ${new Date(googleKeyMeta.updatedAt).toLocaleDateString('ko-KR')}` : ''}\n </div>\n )}\n\n {type === 'google' && (\n <div className="space-y-2">\n <label className="ml-1 block text-sm font-black text-white/60">키 별칭 <span className="font-medium text-white/30">(선택)</span></label>\n <input\n type="text"\n value={googleKeyAlias || ''}\n onChange={(event) => setGoogleKeyAlias?.(event.target.value.slice(0, 30))}\n placeholder="예: 메인 프로젝트"\n className="w-full rounded-2xl bg-white/[0.045] px-4 py-3 text-white transition-all outline-none placeholder:text-white/30 focus:ring-1 focus:ring-[#ff5f9f]/25"\n />\n </div>\n )}\n\n <div className="space-y-2">\n <label className="ml-1 block text-sm font-black text-white/60">API Key 입력</label>''',
        'modal compact identity UI',
    )
    client_source = replace_once(
        client_source,
        " const [googleApiKey, setGoogleApiKey] = useState('');\n const [googleRegistered, setGoogleRegistered]",
        " const [googleApiKey, setGoogleApiKey] = useState('');\n const initialGoogleKeyMeta = getStoredGoogleKeyMeta(auth.currentUser?.uid);\n const [googleKeyAlias, setGoogleKeyAlias] = useState(initialGoogleKeyMeta?.alias || '');\n const [googleKeyMeta, setGoogleKeyMeta] = useState<GoogleKeyMeta | null>(initialGoogleKeyMeta);\n const [googleRegistered, setGoogleRegistered]",
        'client state',
    )
    client_source = replace_once(
        client_source,
        " setGoogleRegistered(getStoredGoogleApiKeyStatus(currentUser?.uid));\n setRemainingCredits(readStoredCredits(currentUser?.uid));",
        " setGoogleRegistered(getStoredGoogleApiKeyStatus(currentUser?.uid));\n const storedGoogleKeyMeta = getStoredGoogleKeyMeta(currentUser?.uid);\n setGoogleKeyAlias(storedGoogleKeyMeta?.alias || '');\n setGoogleKeyMeta(storedGoogleKeyMeta);\n setRemainingCredits(readStoredCredits(currentUser?.uid));",
        'auth state meta restore',
    )
    client_source = replace_once(
        client_source,
        " if (res.ok && result?.ok && result.hasGoogleGeminiApiKey) {\n setGoogleRegistered(true);\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');",
        " if (res.ok && result?.ok && result.hasGoogleGeminiApiKey) {\n setGoogleRegistered(true);\n const storedGoogleKeyMeta = getStoredGoogleKeyMeta(user.uid);\n const nextGoogleKeyMeta = String(result.keyLast6 || '').trim()\n ? { alias: String(result.keyAlias || storedGoogleKeyMeta?.alias || ''), last6: String(result.keyLast6 || '').slice(-6), updatedAt: result.updatedAt || storedGoogleKeyMeta?.updatedAt || null }\n : storedGoogleKeyMeta;\n setGoogleKeyAlias(nextGoogleKeyMeta?.alias || '');\n setGoogleKeyMeta(nextGoogleKeyMeta);\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');",
        'status success',
    )
    client_source = replace_once(
        client_source,
        " } else if (res.ok) {\n setGoogleRegistered(false);\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));",
        " } else if (res.ok) {\n setGoogleRegistered(false);\n setGoogleKeyAlias('');\n setGoogleKeyMeta(null);\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));",
        'status empty',
    )
    client_source = replace_once(
        client_source,
        ' body: JSON.stringify({ apiKey: googleApiKey.trim() })',
        ' body: JSON.stringify({ apiKey: googleApiKey.trim(), alias: googleKeyAlias.trim() })',
        'save request alias',
    )
    client_source = replace_once(
        client_source,
        " setGoogleRegistered(true);\n setGoogleApiKey('');\n setActiveModal(null);",
        " setGoogleRegistered(true);\n const nextGoogleKeyMeta = { alias: googleKeyAlias.trim(), last6: googleApiKey.trim().slice(-6), updatedAt: new Date().toISOString() };\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n setGoogleKeyMeta(nextGoogleKeyMeta);\n setGoogleApiKey('');\n setActiveModal(null);",
        'save local meta',
    )
    client_source = replace_once(
        client_source,
        " setGoogleRegistered(false);\n setGoogleApiKey('');\n setActiveModal(null);\n setMessage('Google Gemini API Key가 삭제되었습니다.');",
        " setGoogleRegistered(false);\n setGoogleApiKey('');\n setGoogleKeyAlias('');\n setGoogleKeyMeta(null);\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid));\n setActiveModal(null);\n setMessage('Google Gemini API Key가 삭제되었습니다.');",
        'delete local meta',
    )
    client_source = replace_once(
        client_source,
        ' isRegistered={googleRegistered}\n isLoading={isLoading}\n onClose={() => setActiveModal(null)}',
        ' isRegistered={googleRegistered}\n isLoading={isLoading}\n googleKeyAlias={googleKeyAlias}\n setGoogleKeyAlias={setGoogleKeyAlias}\n googleKeyMeta={googleKeyMeta}\n onClose={() => setActiveModal(null)}',
        'modal google props',
    )
    client_source = client_source.replace(
        "import React, { useCallback, useEffect, useState } from 'react';",
        f"// {MARKER}\nimport React, {{ useCallback, useEffect, useState }} from 'react';",
        1,
    )
    client_path.write_text(client_source, encoding='utf-8')
    print('Applied 889 compact Gemini key identity UI.')
else:
    print('889 compact Gemini key identity UI already applied.')
