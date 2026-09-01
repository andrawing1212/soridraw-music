from pathlib import Path

PRESENCE = Path('src/services/presenceService.ts')
LITE = Path('src/components/studio/LiteStudioSplitWorkspace.tsx')


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


presence = PRESENCE.read_text(encoding='utf-8')

presence = replace_once(
    presence,
    """const safeNumber = (value: unknown) => {\n  const parsed = Number(value);\n  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;\n};\n\nexport const startUserPresence = (uid: string, options: PresenceOptions = {}): PresenceController => {""",
    """const safeNumber = (value: unknown) => {\n  const parsed = Number(value);\n  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;\n};\n\n// SORIDRAW_1001_PRESENCE_PERMISSION_STORM_GUARD\n// Realtime Database rules are configuration, not a transient network condition.\n// A permission-denied response must not create a 5-second retry loop that keeps\n// allocating promises/log entries and sending writes for as long as the app is open.\nconst isPermissionDeniedError = (error: unknown) => {\n  const code = String((error as any)?.code || '').toUpperCase();\n  const message = String((error as any)?.message || error || '').toUpperCase();\n  return code.includes('PERMISSION_DENIED')\n    || message.includes('PERMISSION_DENIED')\n    || message.includes('PERMISSION DENIED');\n};\n\nexport const startUserPresence = (uid: string, options: PresenceOptions = {}): PresenceController => {""",
    'presence permission helper',
)

presence = replace_once(
    presence,
    """  let connectedUnsubscribe: Unsubscribe | null = null;\n  let checkTimer: number | null = null;\n  let connectionSetupRetryTimer: number | null = null;""",
    """  let connectedUnsubscribe: Unsubscribe | null = null;\n  let checkTimer: number | null = null;\n  let connectionSetupRetryTimer: number | null = null;\n  let presencePermissionDenied = false;\n  let devicePresenceDenied = false;\n  let devicePermissionWarningLogged = false;\n  let presencePermissionWarningLogged = false;""",
    'presence permission state',
)

presence = replace_once(
    presence,
    """  const writeSession = async (force = false) => {\n    if (stopped || !connected) return;""",
    """  const writeSession = async (force = false) => {\n    if (stopped || !connected || presencePermissionDenied) return;""",
    'presence write guard',
)

presence = replace_once(
    presence,
    """    await update(deviceRef, {\n      deviceId,\n      label: deviceInfo.label,\n      platform: deviceInfo.platform,\n      browser: deviceInfo.browser,\n      deviceType: deviceInfo.deviceType,\n      lastActivityAt,\n      updatedAt: serverTimestamp(),\n    });\n    currentState = nextState;""",
    """    if (!devicePresenceDenied) {\n      try {\n        await update(deviceRef, {\n          deviceId,\n          label: deviceInfo.label,\n          platform: deviceInfo.platform,\n          browser: deviceInfo.browser,\n          deviceType: deviceInfo.deviceType,\n          lastActivityAt,\n          updatedAt: serverTimestamp(),\n        });\n      } catch (error) {\n        if (isPermissionDeniedError(error)) {\n          devicePresenceDenied = true;\n          if (!devicePermissionWarningLogged) {\n            devicePermissionWarningLogged = true;\n            console.warn('[Presence] device history permission denied; device writes are disabled for this session.');\n          }\n        } else {\n          console.warn('[Presence] device history sync failed:', error);\n        }\n      }\n    }\n    currentState = nextState;""",
    'presence optional device write',
)

presence = replace_once(
    presence,
    """  const scheduleConnectionSetupRetry = () => {\n    if (stopped || !connected || connectionSetupRetryTimer !== null) return;""",
    """  const scheduleConnectionSetupRetry = () => {\n    if (stopped || !connected || presencePermissionDenied || connectionSetupRetryTimer !== null) return;""",
    'presence retry gate',
)

presence = replace_once(
    presence,
    """  const setupConnection = async () => {\n    if (stopped || !connected) return;""",
    """  const setupConnection = async () => {\n    if (stopped || !connected || presencePermissionDenied) return;""",
    'presence setup gate',
)

presence = replace_once(
    presence,
    """      try {\n        await onDisconnect(deviceLastSeenRef).set(serverTimestamp());\n      } catch (deviceLastSeenError) {\n        console.warn('[Presence] device lastSeen onDisconnect setup failed:', deviceLastSeenError);\n      }""",
    """      if (!devicePresenceDenied) {\n        try {\n          await onDisconnect(deviceLastSeenRef).set(serverTimestamp());\n        } catch (deviceLastSeenError) {\n          if (isPermissionDeniedError(deviceLastSeenError)) {\n            devicePresenceDenied = true;\n            if (!devicePermissionWarningLogged) {\n              devicePermissionWarningLogged = true;\n              console.warn('[Presence] device history permission denied; device writes are disabled for this session.');\n            }\n          } else {\n            console.warn('[Presence] device lastSeen onDisconnect setup failed:', deviceLastSeenError);\n          }\n        }\n      }""",
    'presence device onDisconnect guard',
)

presence = replace_once(
    presence,
    """    } catch (error: any) {\n      currentState = null;\n      console.warn('[Presence] connection setup failed:', error);\n      emitPresenceDiagnostic({\n        uid,\n        status: 'error',\n        message: error?.message || '접속 상태 기록에 실패했습니다. 자동으로 다시 연결합니다.',\n        updatedAt: Date.now(),\n      });\n      scheduleConnectionSetupRetry();\n    }""",
    """    } catch (error: any) {\n      currentState = null;\n      if (isPermissionDeniedError(error)) {\n        presencePermissionDenied = true;\n        clearConnectionSetupRetry();\n        if (!presencePermissionWarningLogged) {\n          presencePermissionWarningLogged = true;\n          console.warn('[Presence] permission denied; automatic presence retries are paused until reload.');\n        }\n        emitPresenceDiagnostic({\n          uid,\n          status: 'error',\n          message: '접속 상태 저장 권한이 거부되어 반복 재시도를 중지했습니다.',\n          updatedAt: Date.now(),\n        });\n        return;\n      }\n      console.warn('[Presence] connection setup failed:', error);\n      emitPresenceDiagnostic({\n        uid,\n        status: 'error',\n        message: error?.message || '접속 상태 기록에 실패했습니다. 자동으로 다시 연결합니다.',\n        updatedAt: Date.now(),\n      });\n      scheduleConnectionSetupRetry();\n    }""",
    'presence permanent permission failure',
)

presence = replace_once(
    presence,
    """      await remove(sessionRef);\n      await update(deviceRef, { lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() });\n      await set(lastSeenRef, serverTimestamp());""",
    """      await remove(sessionRef);\n      if (!devicePresenceDenied) {\n        try {\n          await update(deviceRef, { lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() });\n        } catch (deviceCleanupError) {\n          if (!isPermissionDeniedError(deviceCleanupError)) {\n            console.warn('[Presence] device cleanup failed:', deviceCleanupError);\n          }\n        }\n      }\n      await set(lastSeenRef, serverTimestamp());""",
    'presence cleanup device guard',
)

PRESENCE.write_text(presence, encoding='utf-8')

lite = LITE.read_text(encoding='utf-8')
lite = replace_once(
    lite,
    """      if (purePaneHybridLive) {\n        // Preserve the proven Galaxy Tab containment marker even though Hybrid\n        // no longer runs the full content-responsive publisher. This is only a\n        // pair of already-known-width threshold comparisons; PC fine-pointer\n        // dragging does not enter this branch.\n        const touchLikePointer = activePointerTypeRef.current === 'touch'\n          || activePointerTypeRef.current === 'pen'\n          || (!activePointerTypeRef.current && !finePointerFastPathRef.current);\n        if (touchLikePointer) {\n          const syncHybridTabletFastPath = (pane: HTMLElement, paneWidth: number) => {\n            const shouldBeActive = paneWidth > CONTENT_MOBILE_MAX && paneWidth <= CONTENT_TABLET_MAX;\n            const isActive = pane.dataset.soridrawPaneTabletFastpath === 'true';\n            if (shouldBeActive === isActive) return;\n            if (shouldBeActive) pane.dataset.soridrawPaneTabletFastpath = 'true';\n            else delete pane.dataset.soridrawPaneTabletFastpath;\n          };\n          syncHybridTabletFastPath(builder, builderWidth);\n          syncHybridTabletFastPath(result, resultWidth);\n        }\n      }""",
    """      if (purePaneHybridLive) {\n        // SORIDRAW_1001_SPLIT_DESKTOP_TABLET_CONTAINMENT\n        // The same 661~1080px pane band is expensive whether the pointer is touch,\n        // pen, or a desktop mouse. Legacy already used this containment for fine\n        // pointers; Pure Pane Hybrid only enabled it for touch-like input, leaving\n        // desktop Chrome to reflow the full Music Note/Library tree every frame.\n        // Reuse the existing drag-only CSS containment for every pointer type.\n        // This changes only a threshold dataset flag; there is no extra DOM read,\n        // observer, React state update, or resting-layout/design change.\n        const syncHybridTabletFastPath = (pane: HTMLElement, paneWidth: number) => {\n          const shouldBeActive = paneWidth > CONTENT_MOBILE_MAX && paneWidth <= CONTENT_TABLET_MAX;\n          const isActive = pane.dataset.soridrawPaneTabletFastpath === 'true';\n          if (shouldBeActive === isActive) return;\n          if (shouldBeActive) pane.dataset.soridrawPaneTabletFastpath = 'true';\n          else delete pane.dataset.soridrawPaneTabletFastpath;\n        };\n        syncHybridTabletFastPath(builder, builderWidth);\n        syncHybridTabletFastPath(result, resultWidth);\n      }""",
    'lite desktop tablet containment',
)
LITE.write_text(lite, encoding='utf-8')

# Deterministic safety assertions.
final_presence = PRESENCE.read_text(encoding='utf-8')
final_lite = LITE.read_text(encoding='utf-8')
required = {
    'presence helper': 'SORIDRAW_1001_PRESENCE_PERMISSION_STORM_GUARD',
    'presence retry stop': 'automatic presence retries are paused until reload',
    'device degrade': 'device writes are disabled for this session',
    'split containment': 'SORIDRAW_1001_SPLIT_DESKTOP_TABLET_CONTAINMENT',
}
for label, marker in required.items():
    haystack = final_lite if label == 'split containment' else final_presence
    if marker not in haystack:
        raise SystemExit(f'{label}: marker missing after patch')

print('Applied SORIDRAW 1001 memory stability audit patch: presence retry storm guard + desktop Pure Pane tablet containment.')
