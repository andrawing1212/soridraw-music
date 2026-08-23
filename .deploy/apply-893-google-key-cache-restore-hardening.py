from pathlib import Path

MARKER = 'SORIDRAW_893_GOOGLE_KEY_CACHE_RESTORE_HARDENING'


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise SystemExit(f'{label} anchor mismatch: {count}')
    return source.replace(before, after, 1)


client_path = Path('src/components/SunoApiSettingsPanel.tsx')
client_source = client_path.read_text(encoding='utf-8')

if MARKER not in client_source:
    # Keep a tiny dedicated last-6 fallback in addition to the JSON metadata cache.
    # The full API key is never stored locally.
    client_source = replace_once(
        client_source,
        "const GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE = 'soridraw_google_gemini_api_key_meta';",
        "const GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE = 'soridraw_google_gemini_api_key_meta';\nconst GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE = 'soridraw_google_gemini_api_key_last6';",
        'last6 storage constant',
    )

    client_source = replace_once(
        client_source,
        "function getStoredGoogleKeyMeta(uid?: string | null): GoogleKeyMeta | null {\n try {\n const raw = localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, uid));\n if (!raw) return null;\n const parsed = JSON.parse(raw);\n const last6 = String(parsed?.last6 || '').slice(-6);\n const version = Number(parsed?.version || 0);\n const registered = parsed?.registered === false ? false : Boolean(last6);\n if (!last6 && registered) return null;\n if (!last6 && !version && parsed?.registered !== false) return null;\n return { registered, last6, updatedAt: parsed?.updatedAt || null, version: Number.isFinite(version) ? version : 0 };\n } catch {\n return null;\n }\n}",
        "function getStoredGoogleKeyMeta(uid?: string | null): GoogleKeyMeta | null {\n try {\n const raw = localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, uid));\n const fallbackLast6 = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, uid)) || '').slice(-6);\n if (!raw) {\n return fallbackLast6\n ? { registered: true, last6: fallbackLast6, updatedAt: null, version: 0 }\n : null;\n }\n const parsed = JSON.parse(raw);\n const last6 = String(parsed?.last6 || fallbackLast6 || '').slice(-6);\n const version = Number(parsed?.version || 0);\n const registered = parsed?.registered === false ? false : Boolean(last6);\n if (!last6 && registered) return null;\n if (!last6 && !version && parsed?.registered !== false) return null;\n return { registered, last6, updatedAt: parsed?.updatedAt || null, version: Number.isFinite(version) ? version : 0 };\n } catch {\n try {\n const fallbackLast6 = String(localStorage.getItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, uid)) || '').slice(-6);\n return fallbackLast6 ? { registered: true, last6: fallbackLast6, updatedAt: null, version: 0 } : null;\n } catch {\n return null;\n }\n }\n}",
        'durable cache meta reader',
    )

    # Show the cached identity even while registered state is still hydrating.
    client_source = replace_once(
        client_source,
        " const maskedGoogleKey = type === 'google' && isRegistered && googleKeyMeta?.last6 ? `••••••••••••••••••••••${googleKeyMeta.last6}` : '';\n const displayedPlaceholder = maskedGoogleKey || inputPlaceholder;\n const googleInputLabel = type === 'google' && isRegistered ? 'API 저장완료' : 'API Key 입력';",
        " const hasCachedGoogleKeyIdentity = type === 'google' && Boolean(googleKeyMeta?.last6);\n const maskedGoogleKey = hasCachedGoogleKeyIdentity ? `••••••••••••••••••••••${googleKeyMeta?.last6}` : '';\n const displayedPlaceholder = maskedGoogleKey || inputPlaceholder;\n const googleInputLabel = type === 'google' && (isRegistered || hasCachedGoogleKeyIdentity) ? 'API 저장완료' : 'API Key 입력';",
        'mask independent from transient registered state',
    )

    # Restore the cache from storage on every auth hydration.
    client_source = replace_once(
        client_source,
        " setGoogleRegistered(getStoredGoogleApiKeyStatus(currentUser?.uid));\n const storedGoogleKeyMeta = getStoredGoogleKeyMeta(currentUser?.uid);\n setGoogleKeyMeta(storedGoogleKeyMeta);",
        " const storedGoogleKeyMeta = getStoredGoogleKeyMeta(currentUser?.uid);\n setGoogleRegistered(getStoredGoogleApiKeyStatus(currentUser?.uid) || Boolean(storedGoogleKeyMeta?.registered && storedGoogleKeyMeta.last6));\n setGoogleKeyMeta(storedGoogleKeyMeta);",
        'auth cache restore ordering',
    )

    # Persist last6 in a dedicated fallback after server status refresh.
    client_source = replace_once(
        client_source,
        " if (nextGoogleKeyMeta?.last6) {\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n }",
        " if (nextGoogleKeyMeta?.last6) {\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);\n }",
        'status refresh last6 fallback',
    )

    # Persist last6 immediately on successful save. This path is authoritative and
    # does not depend on a second status call.
    client_source = replace_once(
        client_source,
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n setGoogleKeyMeta(nextGoogleKeyMeta);",
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(nextGoogleKeyMeta));\n localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid), nextGoogleKeyMeta.last6);\n setGoogleKeyMeta(nextGoogleKeyMeta);",
        'save last6 fallback',
    )

    # Clear fallback only on confirmed delete / confirmed missing status.
    client_source = replace_once(
        client_source,
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(emptyGoogleKeyMeta));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));",
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(emptyGoogleKeyMeta));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_STORAGE_BASE, user.uid));",
        'missing status clears fallback',
    )
    client_source = replace_once(
        client_source,
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(deletedGoogleKeyMeta));\n setActiveModal(null);",
        " localStorage.setItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_META_STORAGE_BASE, user.uid), JSON.stringify(deletedGoogleKeyMeta));\n localStorage.removeItem(scopedStorageKey(GOOGLE_GEMINI_API_KEY_LAST6_STORAGE_BASE, user.uid));\n setActiveModal(null);",
        'delete clears fallback',
    )

    # Rehydrate one more time immediately before opening the Google key modal so
    # stale React timing can never hide an already cached last6 identity.
    status_badge_anchor = " const StatusBadge = ({ registered, pending = false }: { registered: boolean; pending?: boolean }) => ("
    status_badge_insert = " const openGoogleApiModal = () => {\n const storedGoogleKeyMeta = getStoredGoogleKeyMeta(user?.uid);\n if (storedGoogleKeyMeta?.last6) {\n setGoogleKeyMeta(storedGoogleKeyMeta);\n setGoogleRegistered(true);\n }\n setActiveModal('google');\n };\n\n" + status_badge_anchor
    client_source = replace_once(
        client_source,
        status_badge_anchor,
        status_badge_insert,
        'google modal cache rehydrate handler',
    )
    client_source = replace_once(
        client_source,
        "<button type=\"button\" onClick={() => setActiveModal('google')} className=\"inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-xs font-black text-white/70 transition hover:bg-white/[0.07] hover:text-white\">",
        "<button type=\"button\" onClick={openGoogleApiModal} className=\"inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2.5 text-xs font-black text-white/70 transition hover:bg-white/[0.07] hover:text-white\">",
        'google modal button handler',
    )

    client_source = client_source.replace(
        '// SORIDRAW_892_CACHE_SYNC_VERSION_FOUNDATION\n',
        f'// {MARKER}\n// SORIDRAW_892_CACHE_SYNC_VERSION_FOUNDATION\n',
        1,
    )

    client_path.write_text(client_source, encoding='utf-8')
    print('Applied SORIDRAW 893: hardened persistent last6 cache restore across app restart.')
else:
    print('893 Google key cache restore hardening already applied.')
