const DEFAULT_APP_URL = "https://soridraw-music.vercel.app/?sidepanel=1";
const SUNO_URL = "https://suno.com/create";

const SORIDRAW_APP_HOSTS = new Set([
  "soridraw.web.app",
  "soridraw-music.vercel.app",
  "soridraw-music-git-preview-andrawing1212.vercel.app"
]);

const PLAYER_TAB_ID_KEY = "soridrawMusicNotePlayerTabId";

const SUNO_CREATE_TAB_ID_KEY = "soridrawSunoCreateTabId";
let pendingSunoCreateTabPromise = null;

function isSunoCreateUrl(url) {
  const parsed = toURL(url);
  return !!parsed &&
    /^https?:$/.test(parsed.protocol) &&
    /^(www\.)?suno\.com$/i.test(parsed.hostname || "") &&
    /^\/create\b/i.test(parsed.pathname || "");
}



let recentMusicNotePlayIntentAt = 0;
function markMusicNotePlayIntent() {
  recentMusicNotePlayIntentAt = Date.now();
}
function hasRecentMusicNotePlayIntent() {
  return Date.now() - recentMusicNotePlayIntentAt < 5000;
}


chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.runtime.onStartup.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

async function getAppUrl() {
  const data = await chrome.storage.local.get(["soridrawAppUrl"]);
  return data.soridrawAppUrl || DEFAULT_APP_URL;
}

async function getSunoTab() {
  // v103:
  // 입력 대상은 반드시 Suno Create 탭만 사용한다.
  // song 재생탭을 입력 대상으로 잡으면 재생 페이지 빈칸에 입력되는 문제가 생긴다.
  // 또한 전체입력/빠른 클릭 중 동시에 호출돼도 Create 탭은 1개만 만든다.
  if (pendingSunoCreateTabPromise) {
    return await pendingSunoCreateTabPromise;
  }

  pendingSunoCreateTabPromise = (async () => {
    const data = await chrome.storage.local.get([SUNO_CREATE_TAB_ID_KEY]);
    const storedTabId = data[SUNO_CREATE_TAB_ID_KEY];

    if (storedTabId || storedTabId === 0) {
      const storedTab = await chrome.tabs.get(storedTabId).catch(() => null);
      if (storedTab?.id && isSunoCreateUrl(storedTab.url || "")) {
        return storedTab;
      }
      await chrome.storage.local.remove([SUNO_CREATE_TAB_ID_KEY]);
    }

    const createTabs = await chrome.tabs.query({
      url: [
        "https://suno.com/create*",
        "https://www.suno.com/create*"
      ]
    });

    if (createTabs?.length) {
      await chrome.storage.local.set({ [SUNO_CREATE_TAB_ID_KEY]: createTabs[0].id });
      return createTabs[0];
    }

    const created = await chrome.tabs.create({ url: SUNO_URL, active: true });
    await chrome.storage.local.set({ [SUNO_CREATE_TAB_ID_KEY]: created.id });
    return created;
  })();

  try {
    return await pendingSunoCreateTabPromise;
  } finally {
    pendingSunoCreateTabPromise = null;
  }
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function triggerManagedSunoAutoplay(tabId, reason = "playback-tab") {
  if (!tabId) return;

  const delays = [250, 800, 1500, 2600, 4200, 6200];

  for (const delayMs of delays) {
    setTimeout(async () => {
      try {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        if (!tab?.id || !/^https:\/\/(www\.)?suno\.com\/song\//i.test(tab.url || "")) return;

        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "soridrawManagedSunoAutoplay",
            reason
          });
        } catch {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["suno-content.js"]
          });
          await wait(120);
          await chrome.tabs.sendMessage(tab.id, {
            type: "soridrawManagedSunoAutoplay",
            reason: `${reason}-after-inject`
          });
        }
      } catch {}
    }, delayMs);
  }
}

async function sendToSuno(song) {
  const tab = await getSunoTab();
  if (!tab?.id) return { ok: false, reason: "suno_create_tab_not_found" };

  // v103: 혹시 저장된 탭이 create가 아니면 create로 되돌린다.
  if (!isSunoCreateUrl(tab.url || "")) {
    await chrome.tabs.update(tab.id, { url: SUNO_URL, active: true });
    await wait(1200);
  } else {
    await chrome.tabs.update(tab.id, { active: true });
    await wait(850);
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "fillSuno", song });
    return response || { ok: false, reason: "suno_no_response" };
  } catch (error) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["suno-content.js"] });
      await wait(450);
      const retry = await chrome.tabs.sendMessage(tab.id, { type: "fillSuno", song });
      return retry || { ok: false, reason: "suno_retry_no_response" };
    } catch (retryError) {
      return { ok: false, reason: retryError?.message || error?.message || String(error) };
    }
  }
}

function toURL(value) {
  try {
    return new URL(String(value || ""));
  } catch {
    return null;
  }
}

function isSoridrawAppUrl(url) {
  const parsed = toURL(url);
  return !!parsed && SORIDRAW_APP_HOSTS.has(parsed.hostname);
}

function isDirectAudioUrl(url) {
  const parsed = toURL(url);
  if (!parsed) return false;

  const pathname = parsed.pathname || "";
  if (/\.(mp3|m4a|wav|aac|ogg|oga|opus|flac|webm)(\b|$)/i.test(pathname)) return true;

  const full = parsed.href;
  if (/audio|song|media|cdn|mp3|m4a/i.test(full) && /\.(mp3|m4a|wav|aac|ogg|opus|flac|webm)(\?|#|$)/i.test(full)) {
    return true;
  }

  return false;
}

function isManagedPlaybackUrl(url) {
  const parsed = toURL(url);
  if (!parsed) return false;
  if (!/^https?:$/.test(parsed.protocol)) return false;

  const href = parsed.href;
  const host = parsed.hostname || "";

  // 앱 자체 / 생성 페이지 / 인증 페이지는 재생탭으로 잡지 않는다.
  if (SORIDRAW_APP_HOSTS.has(host)) return false;
  if (/^https:\/\/(www\.)?suno\.com\/create\b/i.test(href)) return false;
  if (/accounts\.google\.com|firebaseapp\.com|googleusercontent\.com/i.test(host)) return false;

  // v100: 재생버튼 클릭 신호를 못 잡아도 새탭 URL 자체가 재생 후보면 탭 교체 대상으로 본다.
  // 직접 음원 URL은 항상 허용.
  if (isDirectAudioUrl(url)) return true;

  // Suno 곡 페이지 / 일반 음악 재생 페이지 후보도 허용.
  if (/suno\.com\/(song|share|playlist|embed|track|clip)|music|audio|song|track|play|listen|media|cdn/i.test(href)) {
    return true;
  }

  // 마지막 fallback:
  // 앱에서 등록한 URL은 다양한 외부 도메인일 수 있으므로 http(s) 외부 URL을 재생 후보로 허용한다.
  // 새탭이 열릴 때만 handlePossiblePlaybackTab에서 처리되므로 기존 앱 기능은 건드리지 않는다.
  return true;
}

function makePlaybackUrl(url) {
  if (isDirectAudioUrl(url)) {
    return chrome.runtime.getURL(`player.html?src=${encodeURIComponent(url)}`);
  }
  return url;
}

async function getStoredPlayerTab() {
  const data = await chrome.storage.local.get([PLAYER_TAB_ID_KEY]);
  const tabId = data[PLAYER_TAB_ID_KEY];
  if (!tabId && tabId !== 0) return null;

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.id) return null;
    return tab;
  } catch {
    await chrome.storage.local.remove([PLAYER_TAB_ID_KEY]);
    return null;
  }
}

async function rememberPlayerTab(tab) {
  if (!tab?.id) return;
  await chrome.storage.local.set({
    [PLAYER_TAB_ID_KEY]: tab.id
  });
}

async function focusTab(tab) {
  if (!tab?.id) return;
  try {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId !== undefined) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  } catch {}
}

async function openOrUpdatePlayer(rawUrl, options = {}) {
  const url = String(rawUrl || "").trim();
  if (!isManagedPlaybackUrl(url)) return { ok: false, reason: "unsupported_playback_url" };

  const playbackUrl = makePlaybackUrl(url);
  const existing = await getStoredPlayerTab();

  if (existing?.id) {
    // v114 핵심:
    // 기존 재생탭이 있으면 현재 보고 있는 탭을 빼앗지 않고,
    // 백그라운드에서 기존 재생탭 URL만 교체한다.
    const updated = await chrome.tabs.update(existing.id, { url: playbackUrl });
    await rememberPlayerTab(updated || existing);
    triggerManagedSunoAutoplay((updated || existing)?.id, "background-updated-existing-player");
    return { ok: true, mode: "updated_existing_player_background", directAudio: isDirectAudioUrl(url) };
  }

  // 첫 재생은 재생탭 1개를 만든다.
  // 재생탭이 없는 상태에서는 Chrome상 새 탭이 한 번은 필요하다.
  const tab = await chrome.tabs.create({
    url: playbackUrl,
    active: true
  });

  await rememberPlayerTab(tab);
  triggerManagedSunoAutoplay(tab.id, "created-first-player-tab");
  return { ok: true, mode: "created_player_tab", directAudio: isDirectAudioUrl(url) };
}

const pendingPlaybackTabs = new Map();

async function handlePossiblePlaybackTab(tabId, url) {
  const newTab = await chrome.tabs.get(tabId).catch(() => null);
  if (!newTab?.id || !isManagedPlaybackUrl(url)) return;

  const playbackUrl = makePlaybackUrl(url);
  const existing = await getStoredPlayerTab();

  if (existing?.id && existing.id !== newTab.id) {
    // v114:
    // fallback 상황에서 새탭이 이미 생겼더라도,
    // 기존 재생탭으로 화면 포커스를 빼앗지 않고 URL만 교체한다.
    const updated = await chrome.tabs.update(existing.id, { url: playbackUrl });
    await rememberPlayerTab(updated || existing);

    try {
      await chrome.tabs.remove(newTab.id);
    } catch {}

    triggerManagedSunoAutoplay((updated || existing)?.id, "fallback-background-updated-existing-player");
    return;
  }

  if (!existing?.id) {
    if (newTab.url !== playbackUrl) {
      const updated = await chrome.tabs.update(newTab.id, { url: playbackUrl });
      await rememberPlayerTab(updated || newTab);
      triggerManagedSunoAutoplay((updated || newTab)?.id, "registered-updated-new-player-tab");
      return;
    }

    await rememberPlayerTab(newTab);
    triggerManagedSunoAutoplay(newTab.id, "registered-new-player-tab");
    return;
  }

  await rememberPlayerTab(newTab);
  triggerManagedSunoAutoplay(newTab.id, "same-player-tab-updated");
}

chrome.tabs.onCreated.addListener((tab) => {
  if (!tab?.id) return;

  if (tab.url && tab.url !== "about:blank" && tab.url !== "chrome://newtab/") {
    handlePossiblePlaybackTab(tab.id, tab.url);
    return;
  }

  // v100: 클릭 신호가 없어도 새탭이 about:blank로 시작하면 잠시 추적한다.
  pendingPlaybackTabs.set(tab.id, Date.now());
  setTimeout(() => pendingPlaybackTabs.delete(tab.id), 6500);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || changeInfo.url === "about:blank" || changeInfo.url === "chrome://newtab/") return;

  // v100: pending/intent/opener 조건 없이 URL이 재생 후보면 바로 통합한다.
  if (isManagedPlaybackUrl(changeInfo.url)) {
    pendingPlaybackTabs.delete(tabId);
    handlePossiblePlaybackTab(tabId, changeInfo.url);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const data = await chrome.storage.local.get([PLAYER_TAB_ID_KEY, SUNO_CREATE_TAB_ID_KEY]);
  const removeKeys = [];

  if (data[PLAYER_TAB_ID_KEY] === tabId) {
    removeKeys.push(PLAYER_TAB_ID_KEY);
  }
  if (data[SUNO_CREATE_TAB_ID_KEY] === tabId) {
    removeKeys.push(SUNO_CREATE_TAB_ID_KEY);
  }

  if (removeKeys.length) {
    await chrome.storage.local.remove(removeKeys);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "getAppUrl") {
        sendResponse({ ok: true, url: await getAppUrl() });
        return;
      }
      if (message?.type === "setAppUrl") {
        await chrome.storage.local.set({ soridrawAppUrl: message.url || DEFAULT_APP_URL });
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "sendToSuno") {
        sendResponse(await sendToSuno(message.song));
        return;
      }
      if (message?.type === "markMusicNotePlayIntent") {
        markMusicNotePlayIntent();
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === "openOrUpdatePlayer") {
        markMusicNotePlayIntent();
        sendResponse(await openOrUpdatePlayer(message.url, message.options || {}));
        return;
      }
      if (message?.type === "isManagedPlaybackTab") {
        const data = await chrome.storage.local.get([PLAYER_TAB_ID_KEY]);
        const senderTabId = sender?.tab?.id;
        sendResponse({
          ok: true,
          isManaged: !!senderTabId && data[PLAYER_TAB_ID_KEY] === senderTabId
        });
        return;
      }
      if (message?.type === "getSongStatusMap") {
        const data = await chrome.storage.local.get(["soridrawSongStatus"]);
        sendResponse({ ok: true, map: data.soridrawSongStatus || {} });
        return;
      }
      if (message?.type === "setSongStatus") {
        const data = await chrome.storage.local.get(["soridrawSongStatus"]);
        const map = data.soridrawSongStatus || {};
        map[message.key] = {
          status: message.status,
          title: message.title || "",
          updatedAt: Date.now()
        };
        await chrome.storage.local.set({ soridrawSongStatus: map });
        sendResponse({ ok: true });
        return;
      }
      sendResponse({ ok: false, reason: "unknown_message" });
    } catch (error) {
      sendResponse({ ok: false, reason: error?.message || String(error) });
    }
  })();
  return true;
});
