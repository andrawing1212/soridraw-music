from pathlib import Path

MARKER = 'SORIDRAW_894_GEMINI_KEY_IDENTITY_SINGLE_CACHE'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


client_path = Path('src/components/SunoApiSettingsPanel.tsx')
client_source = client_path.read_text(encoding='utf-8')

if MARKER not in client_source:
    # The video test proved the registered flag survives app restart while the
    # separate last-6 metadata can disappear. Keep the last 6 characters inside
    # that same durable registered key as `true|ABC123` (never the full API key).
    client_source = replace_once(
        client_source,
        "function getStoredGoogleApiKeyStatus(uid?: string | null) {\n try {\n return localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) === 'true';\n } catch {\n return false;\n }\n}\n",
        "function getStoredGoogleApiKeyStatus(uid?: string | null) {\n try {\n const stored = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) || '');\n return stored === 'true' || stored.startsWith('true|');\n } catch {\n return false;\n }\n}\n\nfunction getStoredGoogleRegisteredLast6(uid?: string | null): string {\n try {\n const stored = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, uid)) || '');\n if (!stored.startsWith('true|')) return '';\n return String(stored.slice(5)).slice(-6);\n } catch {\n return '';\n }\n}\n",
        'registered identity reader',
    )

    fallback_line = "const fallbackLast6 = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, uid)) || '').slice(-6);"
    fallback_replacement = "const fallbackLast6 = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, uid)) || getStoredGoogleRegisteredLast6(uid) || '').slice(-6);"
    fallback_count = client_source.count(fallback_line)
    if fallback_count != 2:
        raise SystemExit(f'last6 fallback anchors mismatch: {fallback_count}')
    client_source = client_source.replace(fallback_line, fallback_replacement)

    # On save, write suffix identity into the already-proven durable registered
    # key as well as the JSON metadata/fallback keys. Full key remains server-only.
    client_source = replace_once(
        client_source,
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);\n setGoogleKeyMeta(nextGoogleKeyMeta);",
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), `true|${nextGoogleKeyMeta.last6}`);\n setGoogleKeyMeta(nextGoogleKeyMeta);",
        'save durable registered identity',
    )

    # A server refresh that includes keyLast6 also upgrades the durable registered
    # key so all later launches are cache-only for this identity display.
    client_source = replace_once(
        client_source,
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);\n }\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), 'true');",
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);\n }\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_REGISTERED_STORAGE_BASE, user.uid), nextGoogleKeyMeta?.last6 ? `true|${nextGoogleKeyMeta.last6}` : 'true');",
        'status durable registered identity',
    )

    client_source = client_source.replace(
        '// SORIDRAW_893_GOOGLE_KEY_CACHE_RESTORE_HARDENING\n',
        f'// {MARKER}\n// SORIDRAW_893_GOOGLE_KEY_CACHE_RESTORE_HARDENING\n',
        1,
    )

    client_path.write_text(client_source, encoding='utf-8')
    print('Applied SORIDRAW 894: Gemini last6 identity is stored with the durable registered cache key.')
else:
    print('894 Gemini registered identity cache already applied.')
