from pathlib import Path

MARKER = 'SORIDRAW_892_CACHE_SYNC_VERSION_FOUNDATION'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


# -----------------------------------------------------------------------------
# Firebase Functions: additive sync-version metadata only.
# Existing key fields stay untouched; full API keys are never returned.
# -----------------------------------------------------------------------------
functions_path = Path('functions/src/index.ts')
functions_source = functions_path.read_text(encoding='utf-8')

if MARKER not in functions_source:
    functions_source = replace_once(
        functions_source,
        "    const googleGeminiKeyAlias = String(req.body?.alias || '').trim().slice(0, 30);\n    if (!normalizedApiKey) {",
        "    const googleGeminiKeyAlias = String(req.body?.alias || '').trim().slice(0, 30);\n    const googleGeminiKeySyncVersion = Date.now();\n    if (!normalizedApiKey) {",
        'google save sync version',
    )
    functions_source = replace_once(
        functions_source,
        '      googleGeminiKeyLast6: normalizedApiKey.slice(-6),\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        '      googleGeminiKeyLast6: normalizedApiKey.slice(-6),\n      googleGeminiKeySyncVersion,\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        'google save version field',
    )
    functions_source = replace_once(
        functions_source,
        '    }, { merge: true });\n\n    res.json({ ok: true, hasGoogleGeminiApiKey: true });\n  }\n);\n\nexport const deleteGoogleGeminiApiKey',
        '    }, { merge: true });\n\n    await db.collection("users").doc(uid).set({\n      syncVersions: { googleGeminiApiKey: googleGeminiKeySyncVersion },\n    }, { merge: true });\n\n    res.json({\n      ok: true,\n      hasGoogleGeminiApiKey: true,\n      keyLast6: normalizedApiKey.slice(-6),\n      syncVersion: googleGeminiKeySyncVersion,\n    });\n  }\n);\n\nexport const deleteGoogleGeminiApiKey',
        'google save response and user version',
    )
    functions_source = replace_once(
        functions_source,
        '    const db = admin.firestore();\n\n    await db.collection("user_api_keys").doc(uid).set({\n      googleGeminiApiKey: admin.firestore.FieldValue.delete(),',
        '    const db = admin.firestore();\n    const googleGeminiKeySyncVersion = Date.now();\n\n    await db.collection("user_api_keys").doc(uid).set({\n      googleGeminiApiKey: admin.firestore.FieldValue.delete(),',
        'google delete sync version',
    )
    functions_source = replace_once(
        functions_source,
        '      googleGeminiKeyLast6: admin.firestore.FieldValue.delete(),\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        '      googleGeminiKeyLast6: admin.firestore.FieldValue.delete(),\n      googleGeminiKeySyncVersion,\n      googleGeminiUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),',
        'google delete version field',
    )
    functions_source = replace_once(
        functions_source,
        '    }, { merge: true });\n\n    res.json({ ok: true, hasGoogleGeminiApiKey: false });\n  }\n);\n\nexport const getGoogleGeminiApiKeyStatus',
        '    }, { merge: true });\n\n    await db.collection("users").doc(uid).set({\n      syncVersions: { googleGeminiApiKey: googleGeminiKeySyncVersion },\n    }, { merge: true });\n\n    res.json({ ok: true, hasGoogleGeminiApiKey: false, syncVersion: googleGeminiKeySyncVersion });\n  }\n);\n\nexport const getGoogleGeminiApiKeyStatus',
        'google delete response and user version',
    )
    functions_source = replace_once(
        functions_source,
        "      keyLast6: String(docData.googleGeminiKeyLast6 || docData.googleGeminiApiKey || '').slice(-6) || null,\n      updatedAt: timestampToIso(docData.googleGeminiUpdatedAt),",
        "      keyLast6: String(docData.googleGeminiKeyLast6 || docData.googleGeminiApiKey || '').slice(-6) || null,\n      syncVersion: Number(docData.googleGeminiKeySyncVersion || 0) || null,\n      updatedAt: timestampToIso(docData.googleGeminiUpdatedAt),",
        'google status version response',
    )
    functions_source = functions_source.replace(
        '// SORIDRAW_889_GEMINI_KEY_IDENTITY\n',
        f'// {MARKER}\n// SORIDRAW_889_GEMINI_KEY_IDENTITY\n',
        1,
    )
    functions_path.write_text(functions_source, encoding='utf-8')
    print('Applied SORIDRAW 892 Functions: additive Google key sync version metadata.')
else:
    print('892 Functions sync version foundation already applied.')


# -----------------------------------------------------------------------------
# Shared user profile type: reserve version signals for the staged cache rollout.
# Only Google key is active in this phase; the rest are placeholders for next steps.
# -----------------------------------------------------------------------------
types_path = Path('src/types.ts')
types_source = types_path.read_text(encoding='utf-8')
if MARKER not in types_source:
    types_source = replace_once(
        types_source,
        "  generationPreferences?: {\n    autoModelFallback?: boolean;\n  };\n}",
        "  generationPreferences?: {\n    autoModelFallback?: boolean;\n  };\n  syncVersions?: {\n    googleGeminiApiKey?: number;\n    sectionCustom?: number;\n    recentSongs?: number;\n    musicNote?: number;\n    library?: number;\n  };\n}\n\n// " + MARKER,
        'user syncVersions type',
    )
    types_path.write_text(types_source, encoding='utf-8')
    print('Applied SORIDRAW 892 types: shared syncVersions contract.')
else:
    print('892 shared syncVersions type already applied.')


# -----------------------------------------------------------------------------
# Client: cache both positive and negative status, compare only a tiny version signal,
# and fetch full status only when cache is absent or the version actually changed.
# -----------------------------------------------------------------------------
client_path = Path('src/components/SunoApiSettingsPanel.tsx')
client_source = client_path.read_text(encoding='utf-8')
if MARKER not in client_source:
    client_source = replace_once(
        client_source,
        "type SunoApiSettingsPanelProps = {\n className?: string;\n showHeader?: boolean;\n};",
        "type SunoApiSettingsPanelProps = {\n className?: string;\n showHeader?: boolean;\n googleGeminiApiKeyVersion?: number | null;\n};",
        'panel version prop type',
    )
    client_source = replace_once(
        client_source,
        "type GoogleKeyMeta = { last6: string; updatedAt: string | null };",
        "type GoogleKeyMeta = { registered: boolean; last6: string; updatedAt: string | null; version: number };",
        'google cache meta type',
    )
    client_source = replace_once(
        client_source,
        " const last6 = String(parsed?.last6 || '').slice(-6);\n if (!last6) return null;\n return { last6, updatedAt: parsed?.updatedAt || null };",
        " const last6 = String(parsed?.last6 || '').slice(-6);\n const version = Number(parsed?.version || 0);\n const registered = parsed?.registered === false ? false : Boolean(last6);\n if (!last6 && registered) return null;\n if (!last6 && !version && parsed?.registered !== false) return null;\n return { registered, last6, updatedAt: parsed?.updatedAt || null, version: Number.isFinite(version) ? version : 0 };",
        'google cache meta reader',
    )
    client_source = replace_once(
        client_source,
        "export default function SunoApiSettingsPanel({ className = '', showHeader = true }: SunoApiSettingsPanelProps) {",
        "export default function SunoApiSettingsPanel({ className = '', showHeader = true, googleGeminiApiKeyVersion = null }: SunoApiSettingsPanelProps) {",
        'panel version prop destructure',
    )
    client_source = replace_once(
        client_source,
        " const cachedRegistered = getStoredGoogleApiKeyStatus(user.uid);\n const cachedMeta = getStoredGoogleKeyMeta(user.uid);\n if (!isRetry && cachedRegistered && cachedMeta?.last6) {\n setGoogleRegistered(true);\n setGoogleKeyMeta(cachedMeta);\n return;\n }\n\n if (!isRetry) {\n setGoogleRegistered(cachedRegistered);\n setGoogleKeyMeta(cachedMeta);\n }",
        " const cachedRegistered = getStoredGoogleApiKeyStatus(user.uid);\n const cachedMeta = getStoredGoogleKeyMeta(user.uid);\n const remoteVersion = Number(googleGeminiApiKeyVersion || 0);\n const cacheVersionMatches = remoteVersion <= 0 || Number(cachedMeta?.version || 0) === remoteVersion;\n if (!isRetry && cachedMeta && cacheVersionMatches) {\n if (cachedMeta.registered && cachedMeta.last6) {\n setGoogleRegistered(true);\n setGoogleKeyMeta(cachedMeta);\n return;\n }\n if (!cachedMeta.registered) {\n setGoogleRegistered(false);\n setGoogleKeyMeta(cachedMeta);\n return;\n }\n }\n\n if (!isRetry) {\n setGoogleRegistered(cachedRegistered);\n setGoogleKeyMeta(cachedMeta);\n }",
        'version-aware cache guard',
    )
    client_source = replace_once(
        client_source,
        " ? { last6: String(result.keyLast6 || '').slice(-6), updatedAt: result.updatedAt || storedGoogleKeyMeta?.updatedAt || null }\n : storedGoogleKeyMeta;",
        " ? { registered: true, last6: String(result.keyLast6 || '').slice(-6), updatedAt: result.updatedAt || storedGoogleKeyMeta?.updatedAt || null, version: Number(result.syncVersion || googleGeminiApiKeyVersion || storedGoogleKeyMeta?.version || 0) }\n : storedGoogleKeyMeta;",
        'status success version meta',
    )
    client_source = replace_once(
        client_source,
        " } else if (res.ok) {\n setGoogleRegistered(false);\n setGoogleKeyMeta(null);\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid));",
        " } else if (res.ok) {\n setGoogleRegistered(false);\n const emptyGoogleKeyMeta: GoogleKeyMeta = { registered: false, last6: '', updatedAt: result?.updatedAt || null, version: Number(result?.syncVersion || googleGeminiApiKeyVersion || 0) };\n setGoogleKeyMeta(emptyGoogleKeyMeta);\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(emptyGoogleKeyMeta));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid));",
        'status empty tombstone cache',
    )
    client_source = replace_once(
        client_source,
        " }, [user]);\n\n const saveGoogleApiKey = async () => {",
        " }, [user, googleGeminiApiKeyVersion]);\n\n const saveGoogleApiKey = async () => {",
        'google status callback version dependency',
    )
    client_source = replace_once(
        client_source,
        " const nextGoogleKeyMeta = { last6: googleApiKey.trim().slice(-6), updatedAt: new Date().toISOString() };",
        " const nextGoogleKeyMeta: GoogleKeyMeta = { registered: true, last6: String(result?.keyLast6 || googleApiKey.trim()).slice(-6), updatedAt: new Date().toISOString(), version: Number(result?.syncVersion || googleGeminiApiKeyVersion || Date.now()) };",
        'save authoritative version cache',
    )
    client_source = replace_once(
        client_source,
        " setGoogleRegistered(false);\n setGoogleApiKey('');\n setGoogleKeyMeta(null);\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid));\n setActiveModal(null);",
        " setGoogleRegistered(false);\n setGoogleApiKey('');\n const deletedGoogleKeyMeta: GoogleKeyMeta = { registered: false, last6: '', updatedAt: new Date().toISOString(), version: Number(result?.syncVersion || googleGeminiApiKeyVersion || Date.now()) };\n setGoogleKeyMeta(deletedGoogleKeyMeta);\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(deletedGoogleKeyMeta));\n setActiveModal(null);",
        'delete authoritative tombstone cache',
    )
    client_source = client_source.replace(
        '// SORIDRAW_891_GOOGLE_KEY_CACHE_FIRST\n',
        f'// {MARKER}\n// SORIDRAW_891_GOOGLE_KEY_CACHE_FIRST\n',
        1,
    )
    client_path.write_text(client_source, encoding='utf-8')
    print('Applied SORIDRAW 892 client: version-aware positive/negative Google API cache.')
else:
    print('892 client cache sync foundation already applied.')


# -----------------------------------------------------------------------------
# MyPage already listens to the user profile. Reuse that existing profile payload
# as the tiny version signal instead of adding a separate API status poll.
# -----------------------------------------------------------------------------
my_page_path = Path('src/pages/MyPage.tsx')
my_page_source = my_page_path.read_text(encoding='utf-8')
if MARKER not in my_page_source:
    my_page_source = replace_once(
        my_page_source,
        '<SunoApiSettingsPanel className="h-full bg-gradient-to-br from-[#24191f]/95 via-[#191824]/95 to-[#161922]/95" />',
        '<SunoApiSettingsPanel\n className="h-full bg-gradient-to-br from-[#24191f]/95 via-[#191824]/95 to-[#161922]/95"\n googleGeminiApiKeyVersion={profile?.syncVersions?.googleGeminiApiKey ?? null}\n />',
        'MyPage profile version pass-through',
    )
    my_page_source = my_page_source.replace(
        "import React, { useCallback, useEffect, useMemo, useState } from 'react';",
        f"// {MARKER}\nimport React, {{ useCallback, useEffect, useMemo, useState }} from 'react';",
        1,
    )
    my_page_path.write_text(my_page_source, encoding='utf-8')
    print('Applied SORIDRAW 892 MyPage: reuse existing profile listener as cache version signal.')
else:
    print('892 MyPage version pass-through already applied.')
