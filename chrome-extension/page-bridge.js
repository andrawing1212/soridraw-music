(() => {
  if (window.__SORIDRAW_PLAYER_PAGE_BRIDGE_V114__) return;
  window.__SORIDRAW_PLAYER_PAGE_BRIDGE_V114__ = true;

  const SOURCE = "SORIDRAW_PLAYER_PAGE_BRIDGE_V114";
  const ACK_SOURCE = "SORIDRAW_PLAYER_CONTENT_BRIDGE_V114";

  const APP_HOSTS = new Set([
    "soridraw.web.app",
    "soridraw-music.vercel.app",
    "soridraw-music-git-preview-andrawing1212.vercel.app"
  ]);

  function toAbsoluteUrl(url) {
    try {
      return new URL(String(url || ""), location.href).href;
    } catch {
      return "";
    }
  }

  function isManagedPlaybackUrl(url) {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) return false;
      if (APP_HOSTS.has(parsed.hostname)) return false;
      if (/^https:\/\/(www\.)?suno\.com\/create\b/i.test(parsed.href)) return false;
      if (/accounts\.google\.com|firebaseapp\.com|googleusercontent\.com/i.test(parsed.hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function getButtonLike(target) {
    return target?.closest?.("button, a[href], [role='button'], [aria-label], [title]");
  }

  function isLikelyPlayTarget(target) {
    const el = getButtonLike(target);
    if (!el) return false;

    const label = normalizeText([
      el.innerText,
      el.textContent,
      el.getAttribute?.("aria-label"),
      el.getAttribute?.("title"),
      el.getAttribute?.("data-testid")
    ].filter(Boolean).join(" "));

    if (/더보기|메뉴|수정|편집|복사|copy|edit|menu|more|suno/i.test(label)) return false;
    if (/재생|play|listen|audio|음원|▶|▶︎|▶️/i.test(label)) return true;

    const rect = el.getBoundingClientRect();
    const compactIcon = rect.width >= 24 && rect.width <= 76 && rect.height >= 24 && rect.height <= 76;
    if (!compactIcon) return false;

    const bodyText = normalizeText(document.body?.innerText || "");
    const inMusicNote = /Music\s*Note|뮤직\s*노트|Music\s*Space|노트\s*스페이스|저장한\s*곡/i.test(bodyText);
    if (!inMusicNote) return false;

    const row = el.closest("li, article, [role='listitem'], [class*='card'], [class*='item'], [class*='song'], [class*='track'], div");
    const rowText = normalizeText(row?.innerText || "");
    if (!rowText || rowText.length > 1200) return false;

    return /#|분\s*전|시간\s*전|일\s*전|\[[^\]]+\]|Pop|Ballad|Rock|Jazz|Hip|R&B|City|재생|play|audio|url|http/i.test(rowText);
  }

  const pending = new Map();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data || {};
    if (data.source !== ACK_SOURCE || data.type !== "openPlayerUrlAck" || !data.token) return;

    const task = pending.get(data.token);
    if (!task) return;

    pending.delete(data.token);

    if (!data.ok) {
      task.fallback();
    }
  });

  function postPlayIntent() {
    window.postMessage({
      source: SOURCE,
      type: "musicNotePlayIntent"
    }, "*");
  }

  function postOpenWithFallback(url, fallback) {
    postPlayIntent();

    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let usedFallback = false;

    const safeFallback = () => {
      if (usedFallback) return;
      usedFallback = true;
      try {
        fallback?.();
      } catch {}
    };

    pending.set(token, { fallback: safeFallback });

    window.postMessage({
      source: SOURCE,
      type: "openPlayerUrl",
      url,
      token
    }, "*");

    setTimeout(() => {
      if (!pending.has(token)) return;
      pending.delete(token);
      safeFallback();
    }, 1500);
  }

  document.addEventListener("pointerdown", (event) => {
    if (isLikelyPlayTarget(event.target)) {
      postPlayIntent();
    }
  }, true);

  const originalOpen = window.open;
  const nativeOpen = function(url, target, features) {
    return originalOpen.call(window, url, target, features);
  };

  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;

    const href = toAbsoluteUrl(anchor.getAttribute("href") || anchor.href);
    if (!href || !isManagedPlaybackUrl(href)) return;

    // v114 핵심:
    // 재생 URL은 새탭이 열리기 전에 먼저 막고 background에 보낸다.
    // content/background가 응답하지 않을 때만 fallback으로 원래 새탭 열기를 실행한다.
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const target = anchor.getAttribute("target") || "_blank";
    postOpenWithFallback(href, () => nativeOpen(href, target));
  }, true);

  const originalFormSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function patchedSoridrawFormSubmit() {
    const action = toAbsoluteUrl(this.getAttribute("action") || this.action);
    if (action && isManagedPlaybackUrl(action)) {
      postOpenWithFallback(action, () => originalFormSubmit.apply(this, arguments));
      return;
    }

    return originalFormSubmit.apply(this, arguments);
  };

  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patchedSoridrawAnchorClick() {
    const href = toAbsoluteUrl(this.getAttribute("href") || this.href);

    if (href && isManagedPlaybackUrl(href)) {
      const target = this.getAttribute("target") || "_blank";
      postOpenWithFallback(href, () => nativeOpen(href, target));
      return;
    }

    return originalAnchorClick.apply(this, arguments);
  };

  window.open = function patchedSoridrawPlayerOpen(url, target, features) {
    const href = toAbsoluteUrl(url);

    if (href && isManagedPlaybackUrl(href)) {
      postOpenWithFallback(href, () => nativeOpen(url, target, features));
      return null;
    }

    return nativeOpen(url, target, features);
  };
})();
