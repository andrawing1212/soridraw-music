(() => {
  if (window.__SORIDRAW_SEND_WIDGET_V114__) return;
  window.__SORIDRAW_SEND_WIDGET_V114__ = true;

  const STYLE_ID = "soridraw-extension-send-widget-style-v114";
  const WIDGET_ID = "soridraw-extension-send-widget-v114";
  const TOAST_ID = "soridraw-extension-send-toast-v114";
  const SECTION_BUTTON_CLASS = "soridraw-extension-section-send-v114";

  const KO_LYRICS_FALLBACK_BUTTON_ID = "soridraw-edit-ko-lyrics-fallback-v114";

  const EDIT_KO_LYRICS_BUTTON_ID = "soridraw-edit-lyrics-ko-send";
  const EDIT_FOREIGN_LYRICS_BUTTON_ID = "soridraw-edit-lyrics-foreign-send";
  const EDIT_PROMPT_BUTTON_ID = "soridraw-edit-prompt-send";
  const EDIT_LYRICS_MODE_CLASS = "soridraw-edit-lyrics-mode";


  function installMusicNotePlayerBridgeV100() {
    // v114:
    // page-bridge는 버전이 올라가는데 content listener가 V100만 받던 문제를 수정.
    // 이제 SORIDRAW_PLAYER_PAGE_BRIDGE_V숫자 형태를 모두 받는다.
    if (window.__SORIDRAW_PLAYER_BRIDGE_LISTENER_V114__) return;
    window.__SORIDRAW_PLAYER_BRIDGE_LISTENER_V114__ = true;

    function ackToPageBridge(token, ok, reason = "") {
      if (!token) return;
      window.postMessage({
        source: "SORIDRAW_PLAYER_CONTENT_BRIDGE_V114",
        type: "openPlayerUrlAck",
        token,
        ok: !!ok,
        reason
      }, "*");
    }

    window.addEventListener("message", (event) => {
      if (event.source !== window) return;
      const data = event.data || {};
      if (!/^SORIDRAW_PLAYER_PAGE_BRIDGE_V\d+$/.test(String(data.source || ""))) return;

      if (data.type === "musicNotePlayIntent") {
        chrome.runtime.sendMessage({ type: "markMusicNotePlayIntent" }).catch(() => {});
        return;
      }

      if (data.type !== "openPlayerUrl" || !data.url) return;

      chrome.runtime.sendMessage({
        type: "openOrUpdatePlayer",
        url: data.url,
        options: { autoplay: true }
      }).then((result) => {
        ackToPageBridge(data.token, !!result?.ok, result?.reason || "");
      }).catch((error) => {
        ackToPageBridge(data.token, false, error?.message || String(error));
      });
    });

    const script = document.createElement("script");
    script.id = "soridraw-player-page-bridge-v114";
    script.src = chrome.runtime.getURL("page-bridge.js"); // fallback: MAIN world content_script is primary
    script.onload = () => script.remove();
    (document.documentElement || document.head || document.body).appendChild(script);
  }

  installMusicNotePlayerBridgeV100();

  function installMusicNotePlayIntentWatcherV100() {
    if (window.__SORIDRAW_PLAYER_CLICK_INTENT_WATCHER_V100__) return;
    window.__SORIDRAW_PLAYER_CLICK_INTENT_WATCHER_V100__ = true;

    const markIntent = () => {
      chrome.runtime.sendMessage({ type: "markMusicNotePlayIntent" }).catch(() => {});
    };

    const getText = (el) => normalizeText(String([
      el?.innerText,
      el?.textContent,
      el?.getAttribute?.("aria-label"),
      el?.getAttribute?.("title"),
      el?.getAttribute?.("data-testid")
    ].filter(Boolean).join(" ")));

    const isLikelyMusicNotePlayClick = (target) => {
      const el = target?.closest?.("button, a[href], [role='button'], [aria-label], [title], div");
      if (!el) return false;

      const label = getText(el);
      if (/더보기|메뉴|수정|편집|복사|copy|edit|menu|more|suno/i.test(label)) return false;
      if (/재생|play|listen|audio|음원|▶|▶︎|▶️/i.test(label)) return true;

      const rect = el.getBoundingClientRect();
      if (rect.width < 20 || rect.width > 88 || rect.height < 20 || rect.height > 88) return false;

      const bodyText = normalizeText(String(document.body?.innerText || ""));
      if (!/Music\s*Note|뮤직\s*노트|Music\s*Space|노트\s*스페이스|저장한\s*곡/i.test(bodyText)) return false;

      const row = el.closest("li, article, [role='listitem'], [class*='card'], [class*='item'], div");
      const rowText = normalizeText(String(row?.innerText || ""));
      if (!rowText || rowText.length > 1000) return false;

      return /#|분\s*전|시간\s*전|일\s*전|\[[^\]]+\]|Pop|Ballad|Rock|Jazz|Hip|R&B|City/i.test(rowText);
    };

    document.addEventListener("pointerdown", (event) => {
      if (isLikelyMusicNotePlayClick(event.target)) markIntent();
    }, true);

    document.addEventListener("click", (event) => {
      if (isLikelyMusicNotePlayClick(event.target)) markIntent();
    }, true);
  }

  installMusicNotePlayIntentWatcherV100();




  function isElementVisibleV75(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 4 &&
      rect.height > 4 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0;
  }


  function findVisiblePopupRootV79(kind) {
    const isMusicNote = kind === "musicnote";
    const candidates = [];

    for (const el of Array.from(document.querySelectorAll('[role="dialog"], section, article, main, div'))) {
      if (!isElementVisibleV75(el)) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < 420 || rect.height < 420) continue;

      const text = normalizeText(String(el.innerText || el.textContent || ""));
      if (!text || text.length < 40) continue;

      const hasMusicNoteHeader = /MUSIC\s*NOTE\s*DETAIL|디테일\s*&\s*Edit|Detail\s*&\s*Edit/i.test(text);
      const hasLibraryHeader = /LIBRARY\s*DETAIL|라이브러리\s*디테일|보관함\s*디테일/i.test(text);

      if (isMusicNote) {
        if (!hasMusicNoteHeader || hasLibraryHeader) continue;
      } else {
        if (!hasLibraryHeader) continue;
      }

      let score = 0;
      if (isMusicNote && /디테일\s*&\s*Edit/i.test(text)) score += 100;
      if (isMusicNote && /MUSIC\s*NOTE\s*DETAIL/i.test(text)) score += 70;
      if (!isMusicNote && /LIBRARY\s*DETAIL/i.test(text)) score += 100;
      if (rect.top >= -20 && rect.left >= -20) score += 20;
      score -= Math.abs((rect.width * rect.height) - (window.innerWidth * window.innerHeight * 0.72)) / 100000;

      candidates.push({ el, rect, score });
    }

    candidates.sort((a, b) => b.score - a.score || (a.rect.width * a.rect.height) - (b.rect.width * b.rect.height));
    return candidates[0]?.el || null;
  }

  function getMusicNoteEditRootV79() {
    return findVisiblePopupRootV79("musicnote");
  }

  function getLibraryDetailRootV79() {
    return findVisiblePopupRootV79("library");
  }

  function hasVisibleShortTextV75(pattern) {
    const nodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,p,span,div"));
    return nodes.some((el) => {
      if (!isElementVisibleV75(el)) return false;
      const text = normalizeText(String(el.innerText || el.textContent || ""));
      if (!text || text.length > 180) return false;
      return pattern.test(text);
    });
  }

  function isLibraryDetailVisibleV75() {
    return !!getLibraryDetailRootV79();
  }



  function isMusicNoteDetailEditVisibleV75() {
    if (getLibraryDetailRootV79()) return false;
    return !!getMusicNoteEditRootV79();
  }



  function removeAllSectionButtonsV75() {
    [
      "soridraw-section-title-ko-send-v10",
      "soridraw-section-title-foreign-send-v10",
      "soridraw-section-prompt-send-v10",
      "soridraw-section-ko-send-v10",
      "soridraw-section-foreign-send-v10",
      EDIT_KO_LYRICS_BUTTON_ID,
      EDIT_FOREIGN_LYRICS_BUTTON_ID,
      EDIT_PROMPT_BUTTON_ID,
      WIDGET_ID,
      TOAST_ID
    ].forEach((id) => document.getElementById(id)?.remove());

    // Library Detail에서는 상단 '대기' 상태바/탭/위젯까지 모두 제거
    document.querySelectorAll(
      '[id^="soridraw-extension-send-widget-v"], ' +
      '[id^="soridraw-extension-send-toast-v"], ' +
      '[class*="soridraw-send-resultbar"], ' +
      '[class*="soridraw-extension-section-send-v"], ' +
      '[class*="soridraw-title-send-stack-v"], ' +
      'button[id^="soridraw-section-"], ' +
      'button[id^="soridraw-edit-ko-lyrics-"], ' +
      'button[id^="soridraw-edit-lyrics-"], ' +
      'button[id^="soridraw-edit-prompt-"]'
    ).forEach((el) => el.remove());

    document.documentElement.classList.remove(EDIT_LYRICS_MODE_CLASS);
  }



  function isMusicNoteEditLyricsModeV64() {
    return isMusicNoteDetailEditVisibleV75();
  }



  function cleanupEditLyricsLegacyButtonsV64() {
    if (isLibraryDetailVisibleV75()) {
      removeAllSectionButtonsV75();
      return;
    }

    document.querySelectorAll('button[id^="soridraw-edit-ko-lyrics-"], button[id^="soridraw-edit-lyrics-"], button[id^="soridraw-edit-prompt-"]').forEach((button) => {
      if (
        button.id !== EDIT_KO_LYRICS_BUTTON_ID &&
        button.id !== EDIT_FOREIGN_LYRICS_BUTTON_ID &&
        button.id !== EDIT_PROMPT_BUTTON_ID
      ) {
        button.remove();
      }
    });
  }



  function setEditLyricsModeV64(enabled) {
    document.documentElement.classList.toggle(EDIT_LYRICS_MODE_CLASS, !!enabled);
    if (!enabled) {
      document.getElementById(EDIT_KO_LYRICS_BUTTON_ID)?.remove();
      document.getElementById(EDIT_FOREIGN_LYRICS_BUTTON_ID)?.remove();
      document.getElementById(EDIT_PROMPT_BUTTON_ID)?.remove();
    }
  }

  function findEditLyricsCardV64(kind) {
    const root = getMusicNoteEditRootV79();
    if (!root) return null;

    const isKo = kind === "ko";
    const required = isKo
      ? /한글\s*가사|한국어\s*가사|LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O/i
      : /외국어\s*가사|영어\s*가사|LYRICS\s*FOREIGN|L\s*Y\s*R\s*I\s*C\s*S\s*F\s*O\s*R\s*E\s*I\s*G\s*N|ENGLISH\s*LYRICS|LYRICS\s*EN/i;

    const reject = isKo
      ? /외국어\s*가사|영어\s*가사|LYRICS\s*FOREIGN|L\s*Y\s*R\s*I\s*C\s*S\s*F\s*O\s*R\s*E\s*I\s*G\s*N|ENGLISH\s*LYRICS|LYRICS\s*EN/i
      : /한글\s*가사|한국어\s*가사|LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O/i;

    const bad = /PROMPT|P\s*R\s*O\s*M\s*P\s*T|곡\s*프롬프트|Music API|수노\s*URL|SUNO\s*LINK|TITLE|제목/i;
    const candidates = [];

    for (const el of Array.from(root.querySelectorAll("section, article, div"))) {
      const raw = String(el.innerText || el.textContent || "");
      const text = normalizeText(raw);
      const rect = el.getBoundingClientRect();

      if (rect.width < 260 || rect.height < 150 || rect.height > 780) continue;
      if (!required.test(text)) continue;
      if (reject.test(text)) continue;
      if (bad.test(text)) continue;

      let score = 0;
      if (isKo && /한글\s*가사|한국어\s*가사/i.test(text)) score += 40;
      if (!isKo && /외국어\s*가사|영어\s*가사/i.test(text)) score += 40;
      if (isKo && /LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O/i.test(text)) score += 30;
      if (!isKo && /LYRICS\s*FOREIGN|L\s*Y\s*R\s*I\s*C\s*S\s*F\s*O\s*R\s*E\s*I\s*G\s*N/i.test(text)) score += 30;
      if (rect.top > -100 && rect.top < window.innerHeight * 1.25) score += 10;
      score -= Math.max(0, rect.height - 520) / 80;
      score -= Math.max(0, text.length - 9000) / 1200;

      candidates.push({ el, rect, score });
    }

    candidates.sort((a, b) => b.score - a.score || a.rect.height - b.rect.height);
    return candidates[0]?.el || null;
  }




  function findNativeLyricsEditButtonAnchorV68(card) {
    if (!card) return null;

    const cardRect = card.getBoundingClientRect();
    const ownIds = new Set([
      EDIT_KO_LYRICS_BUTTON_ID,
      EDIT_FOREIGN_LYRICS_BUTTON_ID,
      EDIT_PROMPT_BUTTON_ID,
      "soridraw-section-ko-send-v10",
      "soridraw-section-foreign-send-v10",
      "soridraw-section-prompt-send-v10"
    ]);

    const candidates = Array.from(card.querySelectorAll('button, [role="button"], a'))
      .filter((el) => {
        if (!el || ownIds.has(el.id)) return false;

        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width < 14 || rect.height < 14) return false;
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0) return false;

        const label = normalizeText(String(el.innerText || el.textContent || el.getAttribute("aria-label") || el.title || ""));
        const nearTop = rect.top >= cardRect.top - 8 && rect.top <= cardRect.top + 105;
        const nearRight = rect.right >= cardRect.right - Math.min(280, cardRect.width * 0.58);
        const isEdit = /가사\s*수정|수정|편집|edit/i.test(label);
        const isCopy = /복사|copy/i.test(label);
        const isConfirmOrCancel = /확인|완료|저장|취소|닫기|cancel|close|done|save|check|confirm/i.test(label);
        const isIconButton = rect.width <= 104 && rect.height <= 56;

        return nearTop && nearRight && (isEdit || isCopy || isConfirmOrCancel || isIconButton);
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = normalizeText(String(el.innerText || el.textContent || el.getAttribute("aria-label") || el.title || ""));
        let score = 0;
        if (/가사\s*수정/i.test(label)) score += 80;
        if (/수정|편집|edit/i.test(label)) score += 60;
        if (/확인|완료|저장|취소|닫기|cancel|close|done|save|check|confirm/i.test(label)) score += 70;
        if (/복사|copy/i.test(label)) score += 20;
        score += Math.max(0, 140 - Math.abs(rect.top - cardRect.top - 22));
        score += Math.max(0, 260 - (cardRect.right - rect.right));
        return { el, rect, score };
      })
      .filter((row) => row.score > 40);

    if (!candidates.length) return null;

    // v93 핵심:
    // 가사 수정모드에서는 오른쪽에 X/V/복사 버튼 묶음이 생긴다.
    // 기존처럼 점수가 높은 한 버튼만 잡으면 가사입력 버튼이 X/V 위를 덮을 수 있다.
    // 그래서 오른쪽 액션 버튼 묶음 전체 중 가장 왼쪽 버튼을 기준으로 삼는다.
    candidates.sort((a, b) => a.rect.left - b.rect.left || b.score - a.score);
    return candidates[0]?.el || null;
  }

  function alignEditLyricsButtonToNativeEditV68(button, card) {
    const anchor = findNativeLyricsEditButtonAnchorV68(card);
    if (!button || !card || !anchor) return false;

    const cardRect = card.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const gapPx = 11; // 약 3mm

    const top = Math.max(0, Math.round(anchorRect.top - cardRect.top));
    const height = Math.max(24, Math.round(anchorRect.height));
    const right = Math.max(8, Math.round(cardRect.right - anchorRect.left + gapPx));

    button.style.setProperty("position", "absolute", "important");
    button.style.setProperty("right", `${right}px`, "important");
    button.style.setProperty("top", `${top}px`, "important");
    button.style.setProperty("height", `${height}px`, "important");
    button.style.setProperty("min-height", `${height}px`, "important");
    button.style.setProperty("z-index", "80", "important");
    return true;
  }

  function applyEditLyricsButtonStyleV64(button) {
    Object.assign(button.style, {
      position: "absolute",
      zIndex: "80",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: "30px",
      minHeight: "30px",
      padding: "0 12px",
      lineHeight: "1",
      whiteSpace: "nowrap",
      visibility: "visible",
      opacity: "1",
      pointerEvents: "auto",
      transform: "none"
    });

    // v68: 실제 위치는 가사수정 버튼 기준으로 install 후 정렬한다.
    button.style.setProperty("position", "absolute", "important");
    button.style.setProperty("z-index", "80", "important");
  }

  function createEditLyricsButtonV64(id, label, onClick) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
    }

    button.className = `${SECTION_BUTTON_CLASS} soridraw-edit-lyrics-stable-button`;
    button.textContent = label;
    button.onclick = async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await onClick();
    };

    applyEditLyricsButtonStyleV64(button);
    return button;
  }

  function installEditLyricsButtonV64(kind, label, key) {
    const card = findEditLyricsCardV64(kind);
    const id = kind === "ko" ? EDIT_KO_LYRICS_BUTTON_ID : EDIT_FOREIGN_LYRICS_BUTTON_ID;

    if (!card) {
      document.getElementById(id)?.remove();
      return;
    }

    if (getComputedStyle(card).position === "static") {
      card.style.position = "relative";
    }

    const button = createEditLyricsButtonV64(id, label, async () => {
      const current = extractCurrentSong(key);
      await sendSong({ ...current, title: "", prompt: "", lyrics: current.lyrics }, label.replace(/\s*입력\s*$/, ""));
    });

    if (button.parentElement !== card) {
      card.appendChild(button);
    }

    // v93: X/V/복사 버튼 묶음의 가장 왼쪽 기준으로 3mm 간격 유지
    alignEditLyricsButtonToNativeEditV68(button, card);
  }


  function findEditPromptCardV75() {
    const root = getMusicNoteEditRootV79();
    if (!root) return null;

    const candidates = [];

    for (const el of Array.from(root.querySelectorAll("section, article, div"))) {
      if (!isElementVisibleV75(el)) continue;

      const raw = String(el.innerText || el.textContent || "");
      const text = normalizeText(raw);
      const rect = el.getBoundingClientRect();

      if (rect.width < 260 || rect.height < 110 || rect.height > 760) continue;

      const hasPromptLabel = /(^|\s)PROMPT(\s|$)|P\s*R\s*O\s*M\s*P\s*T/i.test(text);
      const hasPromptTitle = /곡\s*프롬프트|음악\s*프롬프트/i.test(text);
      if (!hasPromptTitle) continue;

      if (/프롬프트\s*\/\s*스타일|PROMPT\s*\/\s*STYLE/i.test(text)) continue;
      if (/한글\s*가사|한국어\s*가사|외국어\s*가사|영어\s*가사|LYRICS\s*KO|LYRICS\s*FOREIGN|TITLE|제목|URL|커버\s*URL|Music\s*API|상세\s*정보|INFO\s*SET/i.test(text)) continue;

      const anchor = findNativeLyricsEditButtonAnchorV68(el);
      const hasAnyTopRightButton = !!anchor;

      let score = 0;
      if (hasPromptTitle) score += 150;
      if (hasPromptLabel) score += 80;
      if (hasAnyTopRightButton) score += 120;
      if (rect.top > -100 && rect.top < window.innerHeight * 1.4) score += 20;
      score -= Math.max(0, rect.height - 420) / 70;
      score -= Math.max(0, text.length - 7500) / 1000;

      candidates.push({ el, rect, score, hasAnyTopRightButton });
    }

    candidates.sort((a, b) => b.score - a.score || a.rect.height - b.rect.height);
    return candidates[0]?.el || null;
  }








  function extractPromptFromEditCardV80(card) {
    if (!card) return "";

    let raw = textOf(card);

    // 확장 버튼/기본 조작 라벨 제거
    raw = raw
      .replace(/프롬프트\s*입력/g, " ")
      .replace(/정보\s*복사/g, " ")
      .replace(/복사/g, " ")
      .replace(/수정/g, " ")
      .replace(/편집/g, " ")
      .replace(/edit/gi, " ");

    let lines = normalizeText(raw)
      .split(/\n+/)
      .map((line) => normalizeText(line))
      .filter(Boolean);

    // 상단 라벨/제목 제거: P R O M P T / PROMPT / 곡 프롬프트 / 음악 프롬프트
    lines = lines.filter((line) => {
      if (/^P\s*R\s*O\s*M\s*P\s*T$/i.test(line)) return false;
      if (/^PROMPT$/i.test(line)) return false;
      if (/^곡\s*프롬프트$/i.test(line)) return false;
      if (/^음악\s*프롬프트$/i.test(line)) return false;
      return true;
    });

    let prompt = normalizeText(lines.join("\n"));

    // 한 줄로 붙어 있는 경우도 보정
    prompt = prompt
      .replace(/^P\s*R\s*O\s*M\s*P\s*T\s*/i, "")
      .replace(/^PROMPT\s*/i, "")
      .replace(/^곡\s*프롬프트\s*/i, "")
      .replace(/^음악\s*프롬프트\s*/i, "");

    // 다음 섹션이 섞이면 잘라낸다.
    prompt = prompt.split(/\n\s*(MUSIC\s*API|Music\s*API\s*생성|INFO\s*SET|상세\s*정보|LYRICS|가사|수노\s*URL|SUNO\s*LINK)\b/i)[0];

    return normalizeText(prompt);
  }

  function installEditPromptButtonV75(song) {
    if (!isMusicNoteDetailEditVisibleV75()) {
      document.getElementById(EDIT_PROMPT_BUTTON_ID)?.remove();
      return;
    }

    const card = findEditPromptCardV75() || findEditPromptCardAnyScrollV89();

    // v80: 버튼 생성은 song.prompt 추출 결과에 의존하지 않는다.
    // 곡 프롬프트 카드가 있으면 버튼은 표시하고, 클릭 시 카드 내부에서 직접 추출한다.
    if (!card) {
      document.getElementById(EDIT_PROMPT_BUTTON_ID)?.remove();
      return;
    }

    if (getComputedStyle(card).position === "static") {
      card.style.position = "relative";
    }

    const button = createEditLyricsButtonV64(EDIT_PROMPT_BUTTON_ID, "프롬프트 입력", async () => {
      const current = extractCurrentSong("ko");
      const promptFromCard = extractPromptFromEditCardV80(card);
      await sendSong({ ...current, title: "", lyrics: "", prompt: promptFromCard || current.prompt }, "프롬프트");
    });

    if (button.parentElement !== card) {
      card.appendChild(button);
    }

    const aligned = alignEditLyricsButtonToNativeEditV68(button, card);

    if (!aligned) {
      button.style.setProperty("position", "absolute", "important");
      button.style.setProperty("right", "96px", "important");
      button.style.setProperty("top", "28px", "important");
      button.style.setProperty("height", "30px", "important");
      button.style.setProperty("min-height", "30px", "important");
      button.style.setProperty("z-index", "90", "important");
      button.style.setProperty("visibility", "visible", "important");
      button.style.setProperty("opacity", "1", "important");
      button.style.setProperty("display", "inline-flex", "important");
    }
  }





  function installEditLyricsButtonsV64(song, lyricsMap, foreign) {
    if (!isMusicNoteEditLyricsModeV64()) {
      setEditLyricsModeV64(false);
      cleanupEditLyricsLegacyButtonsV64();
      return false;
    }

    setEditLyricsModeV64(true);
    cleanupEditLyricsLegacyButtonsV64();
    installEditPromptButtonV75(song);

    const koCard = findEditLyricsCardV64("ko");
    if (koCard) {
      installEditLyricsButtonV64("ko", "한국어 가사입력", "ko");
    } else {
      document.getElementById(EDIT_KO_LYRICS_BUTTON_ID)?.remove();
    }

    const foreignCard = findEditLyricsCardV64("foreign");
    if (foreignCard) {
      const foreignKey = foreign?.key || "en";
      const foreignLabel = foreign?.label || "외국어";
      installEditLyricsButtonV64("foreign", `${foreignLabel} 가사입력`, foreignKey);
    } else {
      document.getElementById(EDIT_FOREIGN_LYRICS_BUTTON_ID)?.remove();
    }

    return true;
  }



  function isMusicNoteEditLikePage() {
    const pageText = String(document.body?.innerText || document.body?.textContent || "");
    return /MUSIC\s*NOTE\s*DETAIL|디테일\s*&\s*Edit|디테일|수노\s*URL|SUNO\s*LINK|LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O|한글\s*가사/i.test(pageText);
  }

  function isVisibleElement(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 8 &&
      rect.height > 8 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || 1) > 0;
  }

  function isVisibleInside(parent, child) {
    if (!parent || !child || !parent.contains(child)) return false;
    if (!isVisibleElement(child)) return false;

    const parentRect = parent.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();

    return childRect.top >= parentRect.top - 8 &&
      childRect.left >= parentRect.left - 8 &&
      childRect.bottom <= parentRect.bottom + 8 &&
      childRect.right <= parentRect.right + 8;
  }

  function findMusicNoteKoLyricsCard() {
    const koPattern = /한글\s*가사|한국어\s*가사|LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O/i;
    const foreignPattern = /LYRICS\s*FOREIGN|L\s*Y\s*R\s*I\s*C\s*S\s*F\s*O\s*R\s*E\s*I\s*G\s*N|외국어\s*가사|영어\s*가사/i;
    const badPattern = /PROMPT|곡\s*프롬프트|Music API|수노\s*URL|TITLE|제목/i;

    const strictCards = [];
    const looseCards = [];

    for (const el of Array.from(document.querySelectorAll("section, article, div"))) {
      const raw = String(el.innerText || el.textContent || "");
      const normalized = normalizeText(raw);
      const rect = el.getBoundingClientRect();

      if (rect.width < 180 || rect.height < 70 || rect.height > 900) continue;
      if (!koPattern.test(normalized)) continue;

      let score = 0;
      if (/한글\s*가사|한국어\s*가사/i.test(normalized)) score += 40;
      if (/LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O/i.test(normalized)) score += 30;
      if (rect.top > -120 && rect.top < window.innerHeight * 1.5) score += 10;
      score -= Math.max(0, rect.height - 360) / 50;

      const item = { el, rect, score };

      if (!foreignPattern.test(normalized) && !badPattern.test(normalized)) {
        strictCards.push(item);
      } else {
        looseCards.push(item);
      }
    }

    const sortFn = (a, b) => b.score - a.score || a.rect.height - b.rect.height;
    strictCards.sort(sortFn);
    looseCards.sort(sortFn);

    return strictCards[0]?.el || looseCards[0]?.el || null;
  }

  function applyKoFallbackInlineStyle(button) {
    Object.assign(button.style, {
      position: "absolute",
      top: window.innerWidth < 700 ? "25px" : "23px",
      right: window.innerWidth < 700 ? "104px" : (window.innerWidth >= 1100 ? "135px" : "119px"),
      zIndex: "9999",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "30px",
      height: "30px",
      padding: "0 12px",
      lineHeight: "1",
      visibility: "visible",
      opacity: "1",
      whiteSpace: "nowrap",
      pointerEvents: "auto"
    });
  }

  function ensureKoLyricsFallbackButton() {
    // v62: Edit 전용 안정 버튼을 사용하므로 fallback 버튼은 제거만 한다.
    document.querySelectorAll('button[id^="soridraw-edit-ko-lyrics-fallback-v"]').forEach((button) => button.remove());
  }





  function cleanupLegacyExtensionButtons() {
    const currentSectionClass = SECTION_BUTTON_CLASS;
    const currentTitleStackClass = "soridraw-title-send-stack-v114";
    const currentFallbackId = KO_LYRICS_FALLBACK_BUTTON_ID;

    document.querySelectorAll('button[class*="soridraw-extension-section-send-v"]').forEach((button) => {
      if (!button.classList.contains(currentSectionClass)) {
        button.remove();
      }
    });

    document.querySelectorAll('div[class*="soridraw-title-send-stack-v"]').forEach((stack) => {
      if (!stack.classList.contains(currentTitleStackClass)) {
        stack.remove();
      }
    });

    document.querySelectorAll('button[id^="soridraw-edit-ko-lyrics-fallback-v"]').forEach((button) => {
      if (button.id !== currentFallbackId) {
        button.remove();
      }
    });

    document.querySelectorAll('[id^="soridraw-extension-send-widget-v"]').forEach((widget) => {
      if (widget.id !== WIDGET_ID) {
        widget.remove();
      }
    });
  }

  function cleanupMusicNoteEditDuplicateLyricButtons() {
    // v62: 정상 공통 버튼은 Studio용으로 유지하고, Edit fallback/과거 Edit 버튼만 정리한다.
    cleanupEditLyricsLegacyButtonsV64();
  }




  function isMusicNoteEditPageContext() {
    const pageText = String(document.body?.innerText || document.body?.textContent || "");
    return /MUSIC\s*NOTE\s*DETAIL|디테일\s*&\s*Edit|디테일|수노\s*URL\s*연결|Suno\s*Link|수노\s*링크|LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O|INFO\s*SET/i.test(pageText);
  }

  function hasMusicNoteEditKoreanLyricsSection() {
    if (!isMusicNoteEditPageContext()) return false;
    try {
      return !!findSectionHostByText(/한글\s*가사|한국어\s*가사|LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O/i);
    } catch {
      return false;
    }
  }



  function isStudioPromptLyricsButtonV95(button) {
    return !!button && [
      "soridraw-section-prompt-send-v10",
      "soridraw-section-ko-send-v10",
      "soridraw-section-foreign-send-v10"
    ].includes(button.id);
  }

  function findStudioCopyAnchorV95(host) {
    if (!host) return null;

    const hostRect = host.getBoundingClientRect();
    const ownIds = new Set([
      "soridraw-section-prompt-send-v10",
      "soridraw-section-ko-send-v10",
      "soridraw-section-foreign-send-v10",
      "soridraw-section-title-ko-send-v10",
      "soridraw-section-title-foreign-send-v10",
      EDIT_KO_LYRICS_BUTTON_ID,
      EDIT_FOREIGN_LYRICS_BUTTON_ID,
      EDIT_PROMPT_BUTTON_ID
    ]);

    const candidates = Array.from(host.querySelectorAll('button, [role="button"], a'))
      .filter((el) => {
        if (!el || ownIds.has(el.id)) return false;
        if (el.classList?.contains(SECTION_BUTTON_CLASS)) return false;

        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (rect.width < 14 || rect.height < 14) return false;
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0) return false;

        const label = normalizeText(String(el.innerText || el.textContent || el.getAttribute("aria-label") || el.title || ""));
        const nearTop = rect.top >= hostRect.top - 12 && rect.top <= hostRect.top + Math.min(130, hostRect.height * 0.45);
        const nearRight = rect.right >= hostRect.right - Math.min(260, hostRect.width * 0.62);
        const isCopy = /복사|copy|clipboard/i.test(label);
        const isCompactIcon = rect.width <= 94 && rect.height <= 56;

        return nearTop && nearRight && (isCopy || isCompactIcon);
      })
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = normalizeText(String(el.innerText || el.textContent || el.getAttribute("aria-label") || el.title || ""));
        let score = 0;
        if (/복사|copy|clipboard/i.test(label)) score += 180;
        score += Math.max(0, 120 - Math.abs(rect.top - hostRect.top - 22));
        score += Math.max(0, 240 - (hostRect.right - rect.right));
        if (rect.width <= 94 && rect.height <= 56) score += 20;
        return { el, rect, score };
      })
      .filter((row) => row.score > 80);

    candidates.sort((a, b) => b.score - a.score || b.rect.right - a.rect.right);
    return candidates[0]?.el || null;
  }

  function alignStudioPromptLyricsButtonV95(button, host) {
    if (!button || !host) return false;

    // v95: 스튜디오 프롬프트/가사 입력 버튼만 통합 정렬한다.
    // 뮤직노트 Edit 전용 버튼 위치 계산은 v93 로직을 유지한다.
    if (isMusicNoteDetailEditVisibleV75()) return false;
    if (!isStudioPromptLyricsButtonV95(button)) return false;

    const copyButton = findStudioCopyAnchorV95(host);
    if (!copyButton) return false;

    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    const hostRect = host.getBoundingClientRect();
    const copyRect = copyButton.getBoundingClientRect();
    const gapPx = 8; // 약 2mm

    button.style.setProperty("position", "absolute", "important");
    button.style.setProperty("right", "auto", "important");
    button.style.setProperty("bottom", "auto", "important");
    button.style.setProperty("transform", "none", "important");
    button.style.setProperty("z-index", "18", "important");
    button.style.setProperty("display", "inline-flex", "important");
    button.style.setProperty("align-items", "center", "important");
    button.style.setProperty("justify-content", "center", "important");
    button.style.setProperty("line-height", "1", "important");
    button.style.setProperty("white-space", "nowrap", "important");

    const copyHeight = Math.max(28, Math.min(38, Math.round(copyRect.height || 32)));
    button.style.setProperty("height", `${copyHeight}px`, "important");
    button.style.setProperty("min-height", `${copyHeight}px`, "important");

    const buttonRect = button.getBoundingClientRect();
    const buttonWidth = Math.max(64, Math.round(buttonRect.width || button.offsetWidth || 96));
    const buttonHeight = Math.max(28, Math.round(buttonRect.height || copyHeight));

    const left = Math.max(8, Math.round(copyRect.left - hostRect.left - buttonWidth - gapPx));
    const top = Math.max(4, Math.round(copyRect.top - hostRect.top + ((copyRect.height - buttonHeight) / 2)));

    button.style.setProperty("left", `${left}px`, "important");
    button.style.setProperty("top", `${top}px`, "important");

    return true;
  }

  function lockSectionButtonPositions() {
    const ids = [
      "soridraw-section-prompt-send-v10",
      "soridraw-section-ko-send-v10",
      "soridraw-section-foreign-send-v10"
    ];

    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const rightOffset = width >= 1100 ? "135px" : (width >= 700 ? "119px" : "58px");

    for (const id of ids) {
      const button = document.getElementById(id);
      if (!button) continue;
      const host = button.parentElement;
      if (host && getComputedStyle(host).position === "static") {
        host.style.position = "relative";
      }

      // v95: Studio 프롬프트/가사 버튼은 모바일~PC 모두 복사버튼 왼쪽 2mm로 통합 정렬
      if (host && alignStudioPromptLyricsButtonV95(button, host)) {
        continue;
      }

      // fallback: 복사버튼을 못 찾는 예외 상황에서만 기존 위치 사용
      button.style.setProperty("position", "absolute", "important");
      button.style.setProperty("right", rightOffset, "important");
      button.style.setProperty("left", "auto", "important");
      button.style.setProperty("top", "23px", "important");
      button.style.setProperty("transform", "none", "important");
      button.style.setProperty("white-space", "nowrap", "important");
      button.style.setProperty("z-index", "18", "important");
      button.style.setProperty("display", "inline-flex", "important");
      button.style.setProperty("align-items", "center", "important");
      button.style.setProperty("justify-content", "center", "important");
      button.style.setProperty("line-height", "1", "important");
    }
  }


  const SIDEPANEL_SAFE_STYLE_ID = "soridraw-extension-safe-style-v22";

  function ensureSafeSidePanelStyle() {
    if (document.getElementById(SIDEPANEL_SAFE_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = SIDEPANEL_SAFE_STYLE_ID;
    style.textContent = `
      /* v28: 전체입력 바는 생성곡 카드 위에서만 작은 버튼 줄로 표시한다. */

      html, body {
        scrollbar-width: thin !important;
        scrollbar-color: rgba(224, 161, 77, 0.58) rgba(10, 10, 10, 0.72) !important;
      }

      * {
        scrollbar-width: thin;
        scrollbar-color: rgba(224, 161, 77, 0.58) rgba(10, 10, 10, 0.72);
      }

      *::-webkit-scrollbar {
        width: 8px !important;
        height: 8px !important;
      }

      *::-webkit-scrollbar-track {
        background: rgba(8, 8, 8, 0.74) !important;
        border-radius: 999px !important;
      }

      *::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, rgba(236, 177, 84, 0.82), rgba(126, 78, 31, 0.7)) !important;
        border: 2px solid rgba(8, 8, 8, 0.78) !important;
        border-radius: 999px !important;
        min-height: 44px !important;
      }

      *::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, rgba(255, 195, 102, 0.95), rgba(154, 94, 36, 0.86)) !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function forceStudioEntryOnceSafely() {
    if (document.__soridrawSafeStudioClicked) return;

    const bodyText = document.body?.innerText || "";
    const isStudio = /장르\s*\(\d+\/|스타일\s*\(\d+\/|사운드\s*\(\d+\/|장르를\s*선택하세요|스타일\s*키워드를\s*선택하세요/i.test(bodyText);
    if (isStudio) return;

    const isHome = /감각적인\s*음악\s*아이디어|CREATIVE\s*MUSIC\s*WORKSPACE|스튜디오\s*시작하기|Sori Studio/i.test(bodyText);
    if (!isHome) return;

    const startButton = Array.from(document.querySelectorAll("button, a, [role='button']")).find((el) => {
      const label = String(el.innerText || el.textContent || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
      return /스튜디오\s*시작하기/.test(label);
    });

    if (!startButton) return;

    document.__soridrawSafeStudioClicked = true;
    setTimeout(() => {
      try { startButton.click(); } catch {}
    }, 180);
  }


  // 새 버전 적용 시 이전 content script가 만든 버튼/스타일을 강제로 제거한다.
  document.querySelectorAll(
    '[id^="soridraw-extension-send-widget-"], [id^="soridraw-extension-send-widget-style-"], [id^="soridraw-extension-send-toast-"], [id^="soridraw-section-title-ko-send-"], [id^="soridraw-section-title-foreign-send-"], [id^="soridraw-section-prompt-send-"], [id^="soridraw-section-ko-send-"], [id^="soridraw-section-foreign-send-"], .soridraw-title-send-stack-v114'
  ).forEach((el) => {
    try { el.remove(); } catch {}
  });


  const EXTENSION_LABELS = [
    "보냄", "대기", "완료",
    "전체 입력", "한국어 전체입력", "영어 전체입력", "일본어 전체입력", "중국어 전체입력",
    "한국어 입력", "영어 입력", "일본어 입력", "중국어 입력", "외국어 입력",
    "프롬프트 입력", "한국어 가사입력", "외국어 가사입력", "영어 가사입력", "일본어 가사입력", "중국어 가사입력",
    "KO 제목입력", "EN 제목입력", "일본어 제목입력", "중국어 제목입력",
    "복사", "완료"
  ];

  const LYRIC_LABELS = [
    { key: "ko", label: "한국어", titleLabels: ["KO", "KOREAN"], patterns: ["한글 가사", "한국어 가사", "LYRICS KO", "KOREAN LYRICS"] },
    { key: "en", label: "영어", titleLabels: ["EN", "ENGLISH"], patterns: ["영어 가사", "ENGLISH LYRICS", "LYRICS EN", "LYRICS ENGLISH"] },
    { key: "ja", label: "일본어", titleLabels: ["JA", "JP", "JAPANESE"], patterns: ["일본어 가사", "JAPANESE LYRICS", "LYRICS JA", "LYRICS JP"] },
    { key: "zh", label: "중국어", titleLabels: ["ZH", "CN", "CHINESE"], patterns: ["중국어 가사", "CHINESE LYRICS", "LYRICS ZH", "LYRICS CN"] },
    { key: "es", label: "스페인어", titleLabels: ["ES", "SPANISH"], patterns: ["스페인어 가사", "SPANISH LYRICS", "LYRICS ES"] },
    { key: "fr", label: "프랑스어", titleLabels: ["FR", "FRENCH"], patterns: ["프랑스어 가사", "FRENCH LYRICS", "LYRICS FR"] },
    { key: "foreign", label: "외국어", titleLabels: ["FOREIGN"], patterns: ["외국어 가사", "LYRICS FOREIGN", "FOREIGN LYRICS"] },
  ];

  const PROMPT_LABELS = ["곡 프롬프트", "음악 프롬프트", "PROMPT", "MUSIC PROMPT"];

  const GLOBAL_STOP_LABELS = [
    ...PROMPT_LABELS,
    ...LYRIC_LABELS.flatMap((row) => row.patterns),
    "적용된 키워드",
    "INFO SET",
    "수노 URL 연결",
    "SUNO LINK",
    "가사 언어 추가",
    "다른 언어 가사가 필요해",
    "Music API 생성",
    "Suno 음원 생성 메뉴",
    "펼쳐보기",
    "© 2026",
    "All rights reserved"
  ];

  function normalizeText(value) {
    return String(value || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function removeExtensionLabels(text) {
    let out = String(text || "");
    for (const label of EXTENSION_LABELS) {
      const escaped = escapeRegex(label);
      out = out.replace(new RegExp(`(^|\\n)\\s*${escaped}\\s*(?=\\n|$)`, "gi"), "\n");
      out = out.replace(new RegExp(`\\s*${escaped}\\s*`, "g"), " ");
    }

    // v81: 버튼 라벨이 가사 본문에 섞이는 문제 방지
    // 예: 외국어 가사입력, EN 가사입력, 영어 가사입력
    out = out.replace(/(^|\n)\s*(한국어|외국어|영어|EN|일본어|중국어|스페인어|프랑스어)\s*가사\s*입력\s*(?=\n|$)/gi, "\n");
    out = out.replace(/(^|\n)\s*(한국어|외국어|영어|EN|일본어|중국어|스페인어|프랑스어)\s*가사입력\s*(?=\n|$)/gi, "\n");

    return normalizeText(out);
  }

  function textOf(el) {
    return removeExtensionLabels(normalizeText(el ? (el.innerText || el.textContent || "") : ""));
  }

  function stripControlText(text) {
    let out = removeExtensionLabels(normalizeText(text));
    const removeBlocks = [
      /가사 언어 추가[\s\S]*?(?=Music API 생성|Suno 음원 생성 메뉴|© 2026|$)/gi,
      /다른 언어 가사가 필요해[\s\S]*?(?=Music API 생성|Suno 음원 생성 메뉴|© 2026|$)/gi,
      /Music API 생성[\s\S]*?(?=© 2026|$)/gi,
      /Suno 음원 생성 메뉴[\s\S]*?(?=© 2026|$)/gi,
      /펼쳐보기\s*/gi,
      /© 2026[\s\S]*$/gi
    ];
    for (const regex of removeBlocks) out = out.replace(regex, "");
    return removeExtensionLabels(out);
  }

  function findTextAfterLabel(fullText, startLabels, stopLabels) {
    const lower = fullText.toLowerCase();
    let best = null;

    for (const label of startLabels) {
      const idx = lower.indexOf(label.toLowerCase());
      if (idx >= 0 && (!best || idx < best.idx)) best = { idx, label };
    }

    if (!best) return "";

    const start = best.idx + best.label.length;
    let end = fullText.length;

    for (const label of stopLabels) {
      if (label.toLowerCase() === best.label.toLowerCase()) continue;
      const idx = lower.indexOf(label.toLowerCase(), start);
      if (idx > start && idx < end) end = idx;
    }

    return stripControlText(fullText.slice(start, end));
  }

  function getTitleCardText() {
    const candidates = [];
    for (const el of Array.from(document.querySelectorAll("section, article, div"))) {
      const text = textOf(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 80 || rect.height > 520) continue;
      if (!/제목\s*\(TITLE\)|TITLE|제목복사|전체복사/i.test(text)) continue;
      let score = 0;
      if (/제목\s*\(TITLE\)|TITLE/i.test(text)) score += 20;
      if (/['‘’"][^'‘’"]+['‘’"]/.test(text)) score += 20;
      if (rect.top > -40 && rect.top < window.innerHeight * 0.65) score += 10;
      candidates.push({ text, rect, score });
    }
    candidates.sort((a, b) => b.score - a.score || a.rect.height - b.rect.height);
    return candidates[0]?.text || "";
  }

  function extractQuotedTitles(text) {
    const clean = stripControlText(text);
    const matches = [];
    const regex = /(\[[^\]]+\]\s*)?['‘’"]([^'‘’"]{2,120})['‘’"]/g;
    let match;
    while ((match = regex.exec(clean))) {
      const full = normalizeText(`${match[1] || ""}'${match[2]}'`);
      if (!full || /제목|TITLE|복사|보관함|입력/.test(full)) continue;
      matches.push(full);
    }
    return Array.from(new Set(matches));
  }

  function getTitleMap() {
    const cardText = getTitleCardText();
    const cardTitles = extractQuotedTitles(cardText);
    const bodyTitles = extractQuotedTitles(textOf(document.body));
    const titles = cardTitles.length ? cardTitles : bodyTitles;

    const map = {};

    // v92: 제목이 1개뿐일 때 무조건 ko로 넣던 오류 수정.
    // 한글이 없는 영어 제목만 있는 곡은 EN 제목입력으로 표시한다.
    const isKoreanTitle = (title) => /[가-힣]/.test(normalizeText(title));
    const isForeignTitle = (title) => {
      const clean = normalizeText(title);
      return clean && !isKoreanTitle(clean);
    };

    if (titles.length === 1) {
      if (isKoreanTitle(titles[0])) map.ko = titles[0];
      else if (isForeignTitle(titles[0])) map.en = titles[0];
      else map.ko = titles[0];
    } else {
      if (titles[0]) map.ko = titles[0];
      if (titles[1]) map.en = titles[1];
    }

    // v83: 첫 제목에 붙은 [Modern City Pop] 같은 장르 태그를 외국어 제목에도 유지한다.
    const sourceText = cardText || textOf(document.body);
    const genreMatch = String(sourceText || "").match(/\[[^\]\n]{2,80}\]/);
    const genrePrefix = genreMatch ? normalizeText(genreMatch[0]) : "";

    const attachGenrePrefix = (title) => {
      const clean = normalizeText(title);
      if (!clean || !genrePrefix) return clean;
      if (clean.startsWith(genrePrefix)) return clean;
      return normalizeText(`${genrePrefix}\n${clean}`);
    };

    if (map.ko) map.ko = attachGenrePrefix(map.ko);
    if (map.en) map.en = attachGenrePrefix(map.en);

    return map;
  }

  function getTitleForKey(key) {
    const map = getTitleMap();
    if (map[key]) return map[key];
    if (key === "foreign") return map.en || map.ja || map.zh || map.ko || "Untitled";
    return map.ko || map.en || Object.values(map)[0] || "Untitled";
  }

  function getPrompt(fullText) {
    const prompt = findTextAfterLabel(fullText, PROMPT_LABELS, GLOBAL_STOP_LABELS);
    return normalizeText(prompt.replace(/^(곡 프롬프트|음악 프롬프트|PROMPT|MUSIC PROMPT)/i, "").trim());
  }

  function getLyricsMap(fullText) {
    const map = {};
    for (const item of LYRIC_LABELS) {
      const stops = GLOBAL_STOP_LABELS.filter((label) => !item.patterns.includes(label));
      const value = findTextAfterLabel(fullText, item.patterns, stops);
      if (!value) continue;
      const cleaned = normalizeText(value.replace(new RegExp(`^(${item.patterns.map(escapeRegex).join("|")})`, "i"), "").trim());
      if (cleaned) map[item.key] = { ...item, text: cleaned };
    }
    return map;
  }

  function firstAvailableLyrics(map) {
    return map.ko || map.en || map.ja || map.zh || map.es || map.fr || map.foreign || Object.values(map)[0] || null;
  }

  function extractCurrentSong(lyricsKey = "ko") {
    const fullText = textOf(document.body);
    const lyricsMap = getLyricsMap(fullText);
    const selected = lyricsMap[lyricsKey] || firstAvailableLyrics(lyricsMap);
    const prompt = getPrompt(fullText);
    const title = getTitleForKey(selected?.key || lyricsKey);

    const keyBase = normalizeText(`${title}\n${prompt.slice(0, 300)}\n${(selected?.text || "").slice(0, 300)}`);
    const key = btoa(unescape(encodeURIComponent(keyBase))).replace(/=+$/g, "").slice(0, 40);

    return {
      title: title || "Untitled",
      prompt,
      lyrics: selected?.text || "",
      lyricsKey: selected?.key || lyricsKey,
      lyricsLabel: selected?.label || "가사",
      lyricsMap,
      titleMap: getTitleMap(),
      key,
      sourceUrl: location.href,
      extractedAt: Date.now()
    };
  }



  function findEditPromptCardAnyScrollV89() {
    const root = getMusicNoteEditRootV79();
    if (!root) return null;

    const candidates = [];

    for (const el of Array.from(root.querySelectorAll("section, article, div"))) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0) continue;

      const raw = String(el.innerText || el.textContent || "");
      const text = normalizeText(raw);
      const rect = el.getBoundingClientRect();

      // v89: 전체입력 버튼은 상단에 있고 프롬프트 카드는 화면 아래에 있을 수 있다.
      // 그래서 viewport 노출 여부를 보지 않고, 팝업 내부 전체에서 카드 텍스트를 찾는다.
      if (rect.width < 260 || rect.height < 90 || rect.height > 900) continue;

      const hasPromptTitle = /곡\s*프롬프트|음악\s*프롬프트/i.test(text);
      if (!hasPromptTitle) continue;

      if (/프롬프트\s*\/\s*스타일|PROMPT\s*\/\s*STYLE/i.test(text)) continue;
      if (/한글\s*가사|한국어\s*가사|외국어\s*가사|영어\s*가사|LYRICS\s*KO|LYRICS\s*FOREIGN|TITLE|제목|URL|커버\s*URL|Music\s*API|상세\s*정보|INFO\s*SET/i.test(text)) continue;

      const hasPromptLabel = /(^|\s)PROMPT(\s|$)|P\s*R\s*O\s*M\s*P\s*T/i.test(text);
      const hasGenreBody = /\[Genre\]|\[Instruments\]|\[Atmosphere\]|\[Vocals\]|\[Arrangement\]/i.test(text);

      let score = 0;
      if (hasPromptTitle) score += 150;
      if (hasPromptLabel) score += 80;
      if (hasGenreBody) score += 130;
      score -= Math.max(0, rect.height - 460) / 70;
      score -= Math.max(0, text.length - 8500) / 1000;

      candidates.push({ el, rect, score });
    }

    candidates.sort((a, b) => b.score - a.score || a.rect.height - b.rect.height);
    return candidates[0]?.el || null;
  }

  function withMusicNotePromptV83(song) {
    if (!song || !isMusicNoteDetailEditVisibleV75()) return song;

    // v89: 개별 프롬프트 버튼은 보이는 카드에서 잘 작동하지만,
    // 전체입력 버튼은 상단에 있어 프롬프트 카드가 화면 아래에 있으면 기존 visible 탐색이 실패했다.
    // 전체입력에서는 팝업 내부 전체를 대상으로 한 offscreen 탐색까지 사용한다.
    const card = findEditPromptCardV75() || findEditPromptCardAnyScrollV89();
    const promptFromCard = extractPromptFromEditCardV80(card);

    if (!promptFromCard) return song;

    return { ...song, prompt: promptFromCard };
  }

  function buildClipboardText(song) {
    return [
      song?.title ? `[Title]\n${song.title}` : "",
      song?.prompt ? `[Music Prompt]\n${song.prompt}` : "",
      song?.lyrics ? `[Lyrics]\n${song.lyrics}` : ""
    ].filter(Boolean).join("\n\n").trim();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand("copy");
      textarea.remove();
      return ok;
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${WIDGET_ID} {
        width: calc(100% - 28px);
        margin: 10px 14px 12px;
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px;
        align-items: center;
        padding: 9px;
        border-radius: 22px;
        border: 1px solid rgba(216,164,162,.22);
        background: linear-gradient(135deg, rgba(172,80,69,.22), rgba(18,18,18,.86));
        box-shadow: 0 18px 48px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.06);
        backdrop-filter: blur(16px);
        z-index: 2147483000;
      }
      #${WIDGET_ID}.soridraw-send-floating {
        position: fixed;
        left: 14px;
        right: 14px;
        bottom: 18px;
        width: auto;
        margin: 0;
      }

      #${WIDGET_ID}.soridraw-musicnote-fullinputbar-v114 {
        width: 100% !important;
        margin: 0 0 14px 0 !important;
        box-sizing: border-box !important;
      }
      #${WIDGET_ID} .soridraw-status {
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        padding: 0 10px;
        background: rgba(0,0,0,.24);
        color: rgba(255,255,255,.72);
        font-size: 10px;
        font-weight: 900;
        white-space: nowrap;
      }
      #${WIDGET_ID} .soridraw-status.sent { background: rgba(214,148,61,.22); color: #F3C47C; }
      #${WIDGET_ID} .soridraw-status.done { background: rgba(101,135,97,.24); color: #A9CE9D; }
      #${WIDGET_ID} .soridraw-send-buttons {
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        flex-wrap: wrap;
      }
      #${WIDGET_ID} button,
      .${SECTION_BUTTON_CLASS} {
        min-height: 30px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 14px;
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.86);
        padding: 0 9px;
        font-size: 11px;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 8px 20px rgba(0,0,0,.18);
      }
      #${WIDGET_ID} button[data-action^="send"],
      .${SECTION_BUTTON_CLASS} {
        background: linear-gradient(135deg, rgba(172,80,69,.82), rgba(230,133,95,.58));
        border-color: rgba(255,210,190,.34);
        color: #fff;
      }
      #${WIDGET_ID} button:hover,
      .${SECTION_BUTTON_CLASS}:hover {
        transform: translateY(-1px);
        filter: brightness(1.08);
      }
      #${WIDGET_ID} button[hidden] { display: none; }
      .${SECTION_BUTTON_CLASS} {
        position: absolute !important;
        right: 58px !important;
        top: 23px !important;
        z-index: 18 !important;
        height: 32px !important;
        min-height: 32px !important;
        padding: 0 11px !important;
        transform: none !important;
        white-space: nowrap !important;
        flex: none !important;
      }

      #soridraw-section-prompt-send-v10,
      #soridraw-section-ko-send-v10,
      #soridraw-section-foreign-send-v10 {
        position: absolute !important;
        right: 58px !important;
        top: 23px !important;
        transform: none !important;
      }
      .soridraw-title-send-stack-v114 {
        position: absolute !important;
        right: -12px !important;
        top: 108px !important;
        z-index: 18 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        gap: 7px !important;
        pointer-events: auto !important;
      }
      .soridraw-title-send-stack-v114 .${SECTION_BUTTON_CLASS} {
        position: static !important;
        right: auto !important;
        top: auto !important;
        min-width: 84px !important;
        height: 27px !important;
        min-height: 27px !important;
        padding: 0 8px !important;
        font-size: 10px !important;
      }

      /* v31 full input bar: 더 잘 보이는 카드형 영역 + 상태는 왼쪽, 입력 버튼은 오른쪽 */
      #${WIDGET_ID}.soridraw-send-resultbar {
        position: relative !important;
        left: auto !important;
        right: auto !important;
        top: auto !important;
        bottom: auto !important;
        width: calc(100% - 28px) !important;
        max-width: calc(100% - 28px) !important;
        margin: 0 14px 12px 14px !important;
        padding: 10px 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;
        background: linear-gradient(135deg, rgba(80,34,34,.58), rgba(58,33,44,.52) 45%, rgba(28,24,28,.92) 100%) !important;
        border: 1px solid rgba(218, 132, 81, 0.34) !important;
        border-radius: 18px !important;
        box-shadow: 0 12px 26px rgba(0,0,0,.26), inset 0 1px 0 rgba(255,255,255,.05) !important;
        backdrop-filter: blur(10px) !important;
        pointer-events: auto !important;
        z-index: 30 !important;
      }

      #${WIDGET_ID}.soridraw-send-resultbar .soridraw-status {
        flex: 0 0 auto !important;
        margin-right: auto !important;
        height: 38px !important;
        min-width: 68px !important;
        border-radius: 999px !important;
        padding: 0 15px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        background: rgba(34, 20, 20, 0.92) !important;
        border: 1px solid rgba(255,255,255,.10) !important;
        color: rgba(255,255,255,.84) !important;
        font-size: 12px !important;
        line-height: 1 !important;
        font-weight: 900 !important;
        letter-spacing: .02em !important;
      }

      #${WIDGET_ID}.soridraw-send-resultbar .soridraw-status.sent {
        color: #ffd39f !important;
        border-color: rgba(255, 174, 102, 0.34) !important;
      }

      #${WIDGET_ID}.soridraw-send-resultbar .soridraw-status.done {
        color: #bff2c0 !important;
        border-color: rgba(132, 214, 142, 0.34) !important;
      }

      #${WIDGET_ID}.soridraw-send-resultbar .soridraw-send-buttons {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-end !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
      }

      #${WIDGET_ID}.soridraw-send-resultbar button {
        min-height: 38px !important;
        height: 38px !important;
        border-radius: 999px !important;
        padding: 0 16px !important;
        font-size: 12px !important;
        font-weight: 800 !important;
        letter-spacing: -.01em !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.07) !important;
      }

      @media (max-width: 700px) {
        #${WIDGET_ID}.soridraw-send-resultbar {
          width: calc(100% - 20px) !important;
          max-width: calc(100% - 20px) !important;
          margin: 0 10px 12px 10px !important;
          padding: 9px 10px !important;
          gap: 8px !important;
        }
        #${WIDGET_ID}.soridraw-send-resultbar .soridraw-status {
          min-width: 62px !important;
          height: 34px !important;
          padding: 0 12px !important;
          font-size: 11px !important;
        }
        #${WIDGET_ID}.soridraw-send-resultbar .soridraw-send-buttons {
          gap: 6px !important;
        }
        #${WIDGET_ID}.soridraw-send-resultbar button {
          min-height: 34px !important;
          height: 34px !important;
          padding: 0 12px !important;
          font-size: 11px !important;
        }
      }

      /* v28 프롬프트/가사 입력 버튼 위치: 모바일 유지, 태블릿/PC만 왼쪽으로 이동 */
      #soridraw-section-prompt-send-v10,
      #soridraw-section-ko-send-v10,
      #soridraw-section-foreign-send-v10 {
        right: 58px !important;
        top: 23px !important;
      }

      @media (min-width: 700px) {
        #soridraw-section-prompt-send-v10,
        #soridraw-section-ko-send-v10,
        #soridraw-section-foreign-send-v10 {
          right: 119px !important;
        }
      }

      @media (min-width: 1100px) {
        #soridraw-section-prompt-send-v10,
        #soridraw-section-ko-send-v10,
        #soridraw-section-foreign-send-v10 {
          right: 135px !important;
        }
      }



      /* v95: Studio 프롬프트/가사 입력 버튼 통합 정렬 기본값 */
      #soridraw-section-prompt-send-v10,
      #soridraw-section-ko-send-v10,
      #soridraw-section-foreign-send-v10 {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        margin: 0 !important;
        vertical-align: middle !important;
      }

      /* v35: 스튜디오/뮤직노트 Edit 제목입력 버튼 스타일 분리 */
      .soridraw-title-send-stack-v114 {
        right: -12px !important;
      }

      .soridraw-title-send-stack-v114 .${SECTION_BUTTON_CLASS} {
        min-width: 84px !important;
        height: 27px !important;
        min-height: 27px !important;
        padding: 0 8px !important;
        font-size: 10px !important;
      }

      .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 {
        right: 45px !important;
      }

      .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 .${SECTION_BUTTON_CLASS} {
        min-width: 76px !important;
        height: 24px !important;
        min-height: 24px !important;
        padding: 0 7px !important;
        font-size: 9px !important;
        gap: 4px !important;
      }

      @media (max-width: 520px) {
        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 {
          right: 45px !important;
        }

        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-ko-send-v10,
        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-foreign-send-v10 {
          min-width: 48px !important;
          width: 48px !important;
          height: 24px !important;
          min-height: 24px !important;
          padding: 0 6px !important;
          font-size: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 3px !important;
        }

        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-ko-send-v10::before,
        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-foreign-send-v10::before {
          content: "↗";
          font-size: 10px !important;
          line-height: 1 !important;
          opacity: .95 !important;
          transform: translateY(-.5px);
        }

        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-ko-send-v10::after {
          content: "KO";
          font-size: 10px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
        }

        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-foreign-send-v10::after {
          content: "EN";
          font-size: 10px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
        }
      }


      /* v37: 뮤직노트 Edit 제목입력 버튼 20px 오른쪽 이동 */
      .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 {
        right: 25px !important;
      }

      .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 .${SECTION_BUTTON_CLASS} {
        min-width: 76px !important;
        height: 24px !important;
        min-height: 24px !important;
        padding: 0 7px !important;
        font-size: 9px !important;
        gap: 4px !important;
      }

      @media (max-width: 520px) {
        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-ko-send-v10,
        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-foreign-send-v10 {
          min-width: 48px !important;
          width: 48px !important;
          height: 24px !important;
          min-height: 24px !important;
          padding: 0 6px !important;
          font-size: 0 !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 3px !important;
        }

        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-ko-send-v10::before,
        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-foreign-send-v10::before {
          content: "↗";
          font-size: 10px !important;
          line-height: 1 !important;
          opacity: .95 !important;
        }

        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-ko-send-v10::after {
          content: "KO";
          font-size: 10px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
        }

        .soridraw-title-send-stack-v114.soridraw-title-send-stack-edit-v114 #soridraw-section-title-foreign-send-v10::after {
          content: "EN";
          font-size: 10px !important;
          line-height: 1 !important;
          font-weight: 900 !important;
        }
      }


      /* v52: 뮤직노트 Edit 한국어 가사 입력 fallback 버튼 */
      .soridraw-ko-lyrics-fallback-v114 {
        position: absolute !important;
        top: 23px !important;
        right: 119px !important;
        z-index: 90 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 30px !important;
        height: 30px !important;
        padding: 0 12px !important;
        line-height: 1 !important;
        visibility: visible !important;
        opacity: 1 !important;
        white-space: nowrap !important;
        pointer-events: auto !important;
      }

      @media (max-width: 699px) {
        .soridraw-ko-lyrics-fallback-v114 {
          right: 104px !important;
          top: 25px !important;
        }
      }

      @media (min-width: 1100px) {
        .soridraw-ko-lyrics-fallback-v114 {
          right: 135px !important;
          top: 23px !important;
        }
      }


      /* v53: 이전 버전 확장 버튼 레이어 숨김 */
      button[class*="soridraw-extension-section-send-v"]:not(.${SECTION_BUTTON_CLASS}),
      div[class*="soridraw-title-send-stack-v"]:not(.soridraw-title-send-stack-v114),
      button[id^="soridraw-edit-ko-lyrics-fallback-v"]:not(#soridraw-edit-ko-lyrics-fallback-v114) {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }


      /* v80: Music Note Edit 프롬프트 카드 직접 추출 */
      html.soridraw-edit-lyrics-mode #soridraw-section-ko-send-v10,
      html.soridraw-edit-lyrics-mode #soridraw-section-foreign-send-v10,
      html.soridraw-edit-lyrics-mode #soridraw-section-prompt-send-v10,
      html.soridraw-edit-lyrics-mode button[id^="soridraw-edit-ko-lyrics-fallback-v"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .soridraw-edit-lyrics-stable-button {
        position: absolute !important;
        z-index: 80 !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        line-height: 1 !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
      }


      /* v68: 이전 버전 Edit 가사 버튼은 항상 제거/숨김 */
      html.soridraw-edit-lyrics-mode #soridraw-edit-lyrics-ko-send-v62,
      html.soridraw-edit-lyrics-mode #soridraw-edit-lyrics-foreign-send-v62,
      html.soridraw-edit-lyrics-mode #soridraw-edit-lyrics-ko-send-v63,
      html.soridraw-edit-lyrics-mode #soridraw-edit-lyrics-foreign-send-v63 {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      #${TOAST_ID} {
        position: fixed;
        left: 50%;
        bottom: 22px;
        transform: translateX(-50%);
        max-width: min(360px, calc(100vw - 28px));
        z-index: 2147483001;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 18px;
        background: rgba(20,20,20,.94);
        color: rgba(255,255,255,.86);
        padding: 10px 13px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.45;
        box-shadow: 0 16px 45px rgba(0,0,0,.35);
        backdrop-filter: blur(14px);
      }
    `;
    document.documentElement.appendChild(style);
  }

  function toast(message) {
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement("div");
      el.id = TOAST_ID;
      document.body.appendChild(el);
    }
    el.textContent = message;
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => el.remove(), 2800);
  }

  async function getStatus(song) {
    if (!song?.key) return "ready";
    const result = await chrome.runtime.sendMessage({ type: "getSongStatusMap" });
    return result?.map?.[song.key]?.status || "ready";
  }

  async function setStatus(song, status) {
    if (!song?.key) return;
    await chrome.runtime.sendMessage({ type: "setSongStatus", key: song.key, status, title: song.title || "" });
    await refreshStatusAndButtons();
  }

async function sendSong(song, label) {
    // v88: 개별 버튼은 넘겨받은 payload 그대로만 전송한다.
    // 가사입력 버튼에 프롬프트가 섞이지 않도록 withMusicNotePrompt 자동보강을 제거했다.
    // 전체입력은 sendFullInputSequentialV87에서만 프롬프트 → 제목 → 가사 순차 처리한다.
    const text = buildClipboardText(song);
    if (!text || (!song.title && !song.prompt && !song.lyrics)) {
      toast("입력할 제목/가사/프롬프트가 없습니다.");
      return;
    }
    await copyText(text);
    toast(`${label} 수노 입력을 시도합니다.`);
    const result = await chrome.runtime.sendMessage({ type: "sendToSuno", song });
    await setStatus(song, "sent");
    if (result?.ok) toast(`${label} 입력 완료. 수노 화면에서 확인 후 Generate는 직접 눌러주세요.`);
    else toast(`자동 입력 실패. 직접 붙여넣어 주세요. (${result?.reason || "unknown"})`);
  }


  function delayV87(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function sendToSunoDirectV87(song, label) {
    const text = buildClipboardText(song);
    if (!text || (!song.title && !song.prompt && !song.lyrics)) {
      return { ok: false, reason: "empty_payload", label };
    }

    await copyText(text);
    const result = await chrome.runtime.sendMessage({ type: "sendToSuno", song });
    return result || { ok: false, reason: "suno_no_response", label };
  }

  async function sendFullInputSequentialV87(rawSong, label) {
    const song = withMusicNotePromptV83(rawSong);

    // v114:
    // 전체입력은 프롬프트/제목/가사를 각각 따로 3번 보내지 않는다.
    // 한 번의 payload로 Suno Create 탭에만 전송해서 탭 3개 생성 문제를 막는다.
    const finalSong = {
      ...song,
      title: normalizeText(song.title || ""),
      prompt: normalizeText(song.prompt || ""),
      lyrics: normalizeText(song.lyrics || "")
    };

    const text = buildClipboardText(finalSong);
    if (!text || (!finalSong.title && !finalSong.prompt && !finalSong.lyrics)) {
      toast("입력할 제목/가사/프롬프트가 없습니다.");
      return;
    }

    await copyText(text);
    toast(`${label} 전체입력 시작`);

    const result = await chrome.runtime.sendMessage({
      type: "sendToSuno",
      song: finalSong
    });

    if (!result?.ok) {
      toast(`${label} 입력 실패: ${result?.reason || "unknown"}`);
      return;
    }

    await setStatus(finalSong, "sent");
    toast(`${label} 입력 완료. 수노 화면에서 확인 후 Generate는 직접 눌러주세요.`);
  }

  function buildWidget() {
    const widget = document.createElement("div");
    widget.id = WIDGET_ID;
    widget.innerHTML = `
      <span class="soridraw-status">대기</span>
      <div class="soridraw-send-buttons">
        <button type="button" data-action="sendFullKo" hidden>한국어 전체입력</button>
        <button type="button" data-action="sendFullForeign" hidden>영어 전체입력</button>
      </div>
    `;

    widget.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();

      const action = button.dataset.action;
      const koSong = withMusicNotePromptV83(extractCurrentSong("ko"));
      const map = koSong.lyricsMap || {};
      const foreign = map.en || map.ja || map.zh || map.es || map.fr || map.foreign;

      const rawSong =
        action === "sendFullForeign" ? extractCurrentSong(foreign?.key || "foreign") :
        extractCurrentSong("ko");

      const song = withMusicNotePromptV83(rawSong);

      if (action === "sendFullKo" || action === "sendFullForeign") {
        await sendFullInputSequentialV87(song, `${song.lyricsLabel} 전체`);
      }
    });

    return widget;
  }

  function findBestHost() {
    const candidates = [];
    for (const el of Array.from(document.querySelectorAll("section, article, [role='dialog'] > div, main > div, main section"))) {
      const text = textOf(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 100) continue;

      let score = 0;
      if (/제목\s*\(TITLE\)|TITLE|Music Note Detail|디테일|Edit/i.test(text)) score += 30;
      if (/음악 프롬프트|곡 프롬프트|한글 가사|영어 가사|LYRICS|PROMPT/i.test(text)) score += 15;
      if (/1\s*\/\s*10|제목 복사|전체복사|보관함/i.test(text)) score += 10;
      if (rect.top > -20 && rect.top < window.innerHeight * 0.72) score += 8;
      if (score > 0) candidates.push({ el, score, rect });
    }
    candidates.sort((a, b) => b.score - a.score || a.rect.top - b.rect.top);
    return candidates[0]?.el || null;
  }

  function findSectionHostByText(pattern) {
    const candidates = [];
    for (const el of Array.from(document.querySelectorAll("section, article, div"))) {
      const text = textOf(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 70 || rect.height > 900) continue;
      if (!pattern.test(text)) continue;
      let score = 0;
      if (rect.top > -40 && rect.top < window.innerHeight * 1.2) score += 10;
      if (text.length < 12000) score += 5;
      candidates.push({ el, rect, score });
    }
    candidates.sort((a, b) => a.rect.height - b.rect.height || b.score - a.score);
    return candidates[0]?.el || null;
  }

  function createExtensionButton(id, label, onClick) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = SECTION_BUTTON_CLASS;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await onClick();
      });
    }
    button.className = SECTION_BUTTON_CLASS;
    button.textContent = label;
    return button;
  }

  function installSectionButton(id, label, hostPattern, onClick) {
    const host = findSectionHostByText(hostPattern);
    if (!host) {
      removeSectionButton(id);
      return;
    }
    const button = createExtensionButton(id, label, onClick);
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    if (button.parentElement !== host) host.appendChild(button);

    // v95: Studio 프롬프트/가사 입력 버튼은 복사버튼 왼쪽 2mm 기준으로 즉시 정렬
    if (isStudioPromptLyricsButtonV95(button)) {
      alignStudioPromptLyricsButtonV95(button, host);
      requestAnimationFrame(() => {
        try { alignStudioPromptLyricsButtonV95(button, host); } catch {}
      });
    }
  }

  function installTitleButton(id, label, onClick) {
    const host = findSectionHostByText(/제목\s*\(TITLE\)|TITLE/i);
    if (!host) {
      removeSectionButton(id);
      return;
    }
    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    // v36: 뮤직노트 Edit 화면만 별도 스타일 적용.
    // host 가까운 div만 보면 제목 카드 내부 텍스트만 잡혀서 실패하므로 body 전체로 판정한다.
    const pageText = textOf(document.body);
    const isMusicNoteEditContext =
      /MUSIC\s*NOTE\s*DETAIL|디테일\s*&\s*Edit|디테일|수노\s*URL\s*연결|Suno\s*Link|수노\s*링크/i.test(pageText);

    let stack = host.querySelector(".soridraw-title-send-stack-v114");
    if (!stack) {
      stack = document.createElement("div");
      host.appendChild(stack);
    }

    stack.className = isMusicNoteEditContext
      ? "soridraw-title-send-stack-v114 soridraw-title-send-stack-edit-v114"
      : "soridraw-title-send-stack-v114";

    const button = createExtensionButton(id, label, onClick);
    if (button.parentElement !== stack) stack.appendChild(button);
  }

  function removeSectionButton(id) {
    const old = document.getElementById(id);
    if (old) old.remove();
  }

  function placeSectionButtons() {
    if (isLibraryDetailVisibleV75()) {
      removeAllSectionButtonsV75();
      return;
    }

    const song = extractCurrentSong("ko");
    const lyricsMap = song.lyricsMap || {};
    const titleMap = song.titleMap || {};
    const foreign = lyricsMap.en || lyricsMap.ja || lyricsMap.zh || lyricsMap.es || lyricsMap.fr || lyricsMap.foreign;
    const foreignTitleKey = foreign?.key || "en";
    const foreignTitle = getTitleForKey(foreignTitleKey);
    const isMusicNoteEdit = isMusicNoteDetailEditVisibleV75();

    if (isMusicNoteEdit) {
      updateMusicNoteForeignLyricsHeadingV82(lyricsMap);
    }

    if (titleMap.ko) {
      installTitleButton(
        "soridraw-section-title-ko-send-v10",
        "KO 제목입력",
        async () => {
          const current = extractCurrentSong("ko");
          await sendSong({ ...current, title: getTitleForKey("ko"), prompt: "", lyrics: "" }, "한국어 제목");
        }
      );
    } else {
      removeSectionButton("soridraw-section-title-ko-send-v10");
    }

    if (foreignTitle && foreignTitle !== titleMap.ko) {
      installTitleButton(
        "soridraw-section-title-foreign-send-v10",
        "EN 제목입력",
        async () => {
          const current = extractCurrentSong(foreignTitleKey);
          await sendSong({ ...current, title: getTitleForKey(foreignTitleKey), prompt: "", lyrics: "" }, `${foreign?.label || "영어"} 제목`);
        }
      );
    } else {
      removeSectionButton("soridraw-section-title-foreign-send-v10");
    }

    // Music Note Edit 화면에서는 프롬프트도 Edit 전용 버튼으로 처리한다.
    if (song.prompt && !isMusicNoteEdit) {
      installSectionButton(
        "soridraw-section-prompt-send-v10",
        "프롬프트 입력",
        /음악 프롬프트|곡 프롬프트|PROMPT/i,
        async () => {
          const current = extractCurrentSong("ko");
          await sendSong({ ...current, title: "", lyrics: "", prompt: current.prompt }, "프롬프트");
        }
      );
    } else {
      removeSectionButton("soridraw-section-prompt-send-v10");
    }

    if (installEditLyricsButtonsV64(song, lyricsMap, foreign)) {
      return;
    }

    if (lyricsMap.ko?.text || hasMusicNoteEditKoreanLyricsSection()) {
      installSectionButton(
        "soridraw-section-ko-send-v10",
        "한국어 가사입력",
        /한글\s*가사|한국어\s*가사|LYRICS\s*KO|L\s*Y\s*R\s*I\s*C\s*S\s*K\s*O/i,
        async () => {
          const current = extractCurrentSong("ko");
          await sendSong({ ...current, title: "", prompt: "", lyrics: current.lyrics }, "한국어 가사");
        }
      );
    } else {
      removeSectionButton("soridraw-section-ko-send-v10");
    }

    if (foreign?.text) {
      installSectionButton(
        "soridraw-section-foreign-send-v10",
        `${foreign.label} 가사입력`,
        new RegExp(`${escapeRegex(foreign.label)} 가사|외국어 가사|LYRICS FOREIGN|ENGLISH LYRICS|LYRICS EN|영어 가사`, "i"),
        async () => {
          const current = extractCurrentSong(foreign.key);
          await sendSong({ ...current, title: "", prompt: "", lyrics: current.lyrics }, `${foreign.label} 가사`);
        }
      );
    } else {
      removeSectionButton("soridraw-section-foreign-send-v10");
    }
  }






  function isStudioGeneratedResultVisible() {
    const bodyText = document.body?.innerText || "";

    const hasGeneratedContent =
      /제목\s*\(TITLE\)|음악\s*프롬프트|곡\s*프롬프트|한글\s*가사|한국어\s*가사|영어\s*가사|\[Genre\]|\[Instruments\]|\[Atmosphere\]|\[Vocals\]|\[Arrangement\]|\[Verse|\[Chorus|\[Intro/i.test(bodyText);

    const isSelectorOnly =
      /장르를\s*선택하세요|스타일\s*키워드를\s*선택하세요|사운드\s*키워드를\s*선택하세요|분위기\s*키워드를\s*선택하세요|주제를\s*선택하세요/i.test(bodyText) &&
      !/제목\s*\(TITLE\)|음악\s*프롬프트|한글\s*가사|영어\s*가사/i.test(bodyText);

    const isMusicNoteLike =
      /노트\s*스페이스|마이\s*노트|공유\s*노트|저장한\s*곡을\s*편집하고/i.test(bodyText);

    return hasGeneratedContent && !isSelectorOnly && !isMusicNoteLike;
  }


  function findMusicNoteEditTitleCardV82() {
    const root = getMusicNoteEditRootV79();
    if (!root) return null;

    const candidates = [];

    for (const el of Array.from(root.querySelectorAll("section, article, div"))) {
      if (!isElementVisibleV75(el)) continue;

      const text = textOf(el);
      const rect = el.getBoundingClientRect();

      if (rect.width < 300 || rect.height < 110 || rect.height > 640) continue;

      const hasTitleLabel = /(^|\n|\s)(TITLE|T\s*I\s*T\s*L\s*E)(\s|\n|$)|제목/i.test(text);
      if (!hasTitleLabel) continue;

      // 제목 카드가 아닌 다른 큰 카드 제외
      if (/LYRICS|L\s*Y\s*R\s*I\s*C\s*S|가사|PROMPT|P\s*R\s*O\s*M\s*P\s*T|프롬프트|INFO\s*SET|상세\s*정보|Music\s*API|수노\s*URL|SUNO\s*LINK/i.test(text)) continue;

      let score = 0;
      if (/제목/i.test(text)) score += 80;
      if (/TITLE|T\s*I\s*T\s*L\s*E/i.test(text)) score += 60;
      if (/제목\s*복사|TITLE\s*COPY|복사/i.test(text)) score += 30;
      if (rect.top > -40 && rect.top < window.innerHeight * 0.65) score += 20;
      score -= Math.max(0, rect.height - 360) / 50;

      candidates.push({ el, rect, score });
    }

    candidates.sort((a, b) => b.score - a.score || a.rect.height - b.rect.height);
    return candidates[0]?.el || null;
  }

  function placeMusicNoteEditFullInputBarV82() {
    const root = getMusicNoteEditRootV79();
    if (!root) return false;

    const card = findMusicNoteEditTitleCardV82();
    if (!card || !card.parentElement || !root.contains(card.parentElement)) return false;

    let widget = document.getElementById(WIDGET_ID);
    if (!widget) widget = buildWidget();

    widget.className = "soridraw-send-resultbar soridraw-musicnote-fullinputbar-v114";

    // 대문 아래 / 제목 카드 바로 위
    if (widget.parentElement !== card.parentElement || widget.nextElementSibling !== card) {
      card.parentElement.insertBefore(widget, card);
    }

    return true;
  }

  function updateMusicNoteForeignLyricsHeadingV82(lyricsMap) {
    const root = getMusicNoteEditRootV79();
    if (!root) return;

    const foreign = lyricsMap?.en || lyricsMap?.ja || lyricsMap?.zh || lyricsMap?.es || lyricsMap?.fr || lyricsMap?.foreign;
    if (!foreign?.label || foreign.label === "외국어") return;

    const card = findEditLyricsCardV64("foreign");
    if (!card || !root.contains(card)) return;

    const target = `${foreign.label} 가사`;

    // 큰 카드 전체를 건드리지 않고, '외국어 가사' 텍스트 노드만 교체한다.
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const value = String(node.nodeValue || "");
      if (normalizeText(value) === "외국어 가사") {
        node.nodeValue = value.replace(/외국어\s*가사/, target);
      }
    }
  }

  function removeFullInputBarWhenNotStudioResult() {
    if (isStudioGeneratedResultVisible() || isMusicNoteDetailEditVisibleV75()) return;
    const widget = document.getElementById(WIDGET_ID);
    if (widget) widget.remove();
  }



  function findTitleCardElement() {
    const candidates = [];

    for (const el of Array.from(document.querySelectorAll("section, article, div"))) {
      const text = textOf(el);
      const rect = el.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 90 || rect.height > 760) continue;
      if (!/제목\s*\(TITLE\)|TITLE/i.test(text)) continue;
      if (/Music\s*Note|뮤직\s*노트|노트\s*스페이스/i.test(text)) continue;

      let score = 0;
      if (/제목\s*\(TITLE\)|TITLE/i.test(text)) score += 30;
      if (/전체복사|제목복사|보관함|1\s*\/\s*10/i.test(text)) score += 20;
      if (/음악\s*프롬프트|한글\s*가사|영어\s*가사/i.test(text)) score -= 25;
      if (rect.top > -80 && rect.top < window.innerHeight * 0.85) score += 10;

      candidates.push({ el, rect, score });
    }

    candidates.sort((a, b) => b.score - a.score || a.rect.height - b.rect.height);
    const best = candidates[0]?.el;
    if (!best) return null;

    // 제목 카드 내부 요소가 잡히면, 카드처럼 보이는 상위 컨테이너까지 올린다.
    let card = best;
    let current = best;
    while (current.parentElement && current.parentElement !== document.body && current.parentElement.tagName !== "MAIN") {
      const parent = current.parentElement;
      const parentText = textOf(parent);
      const parentRect = parent.getBoundingClientRect();

      if (!/제목\s*\(TITLE\)|TITLE/i.test(parentText)) break;
      if (parentRect.height > 900 || parentRect.width < 240) break;
      if (/음악\s*프롬프트|한글\s*가사|영어\s*가사/i.test(parentText)) break;

      card = parent;
      current = parent;
    }

    return card;
  }

  function placeWidget() {
    if (isLibraryDetailVisibleV75()) {
      removeAllSectionButtonsV75();
      return;
    }

    ensureStyle();

    // v82: 뮤직노트 Detail & Edit에서는 전체입력 바를 팝업 내부 대문 아래 / 제목 카드 위에 둔다.
    if (isMusicNoteDetailEditVisibleV75()) {
      if (!placeMusicNoteEditFullInputBarV82()) {
        const widget = document.getElementById(WIDGET_ID);
        if (widget) widget.remove();
      }

      placeSectionButtons();
      lockSectionButtonPositions();
      ensureKoLyricsFallbackButton();
      cleanupMusicNoteEditDuplicateLyricButtons();
      refreshStatusAndButtons();
      return;
    }

    if (!isStudioGeneratedResultVisible()) {
      removeFullInputBarWhenNotStudioResult();
      placeSectionButtons();
      lockSectionButtonPositions();
      return;
    }

    let widget = document.getElementById(WIDGET_ID);
    if (!widget) widget = buildWidget();

    const card = findTitleCardElement();
    if (card?.parentElement) {
      widget.className = "soridraw-send-resultbar";

      if (widget.parentElement !== card.parentElement || widget.nextElementSibling !== card) {
        card.parentElement.insertBefore(widget, card);
      }
    } else {
      widget.remove();
      placeSectionButtons();
      lockSectionButtonPositions();
      return;
    }

    placeSectionButtons();
    lockSectionButtonPositions();
    ensureKoLyricsFallbackButton();
    cleanupMusicNoteEditDuplicateLyricButtons();
    refreshStatusAndButtons();
  }



async function refreshStatusAndButtons() {
    const widget = document.getElementById(WIDGET_ID);
    if (!widget) return;

    let song;
    try { song = withMusicNotePromptV83(extractCurrentSong("ko")); } catch { return; }

    const statusEl = widget.querySelector(".soridraw-status");
    const koFull = widget.querySelector('[data-action="sendFullKo"]');
    const foreignFull = widget.querySelector('[data-action="sendFullForeign"]');

    const map = song.lyricsMap || {};
    const foreign = map.en || map.ja || map.zh || map.es || map.fr || map.foreign;

    koFull.hidden = !map.ko?.text;
    foreignFull.hidden = !foreign?.text;

    if (map.ko?.text) koFull.textContent = "한국어 전체입력";
    if (foreign?.text) foreignFull.textContent = `${foreign.label} 전체입력`;

    const status = await getStatus(song);
    statusEl.classList.remove("sent", "done");
    if (status === "sent") {
      statusEl.textContent = "보냄";
      statusEl.classList.add("sent");
    } else if (status === "done") {
      statusEl.textContent = "완료";
      statusEl.classList.add("done");
    } else {
      statusEl.textContent = "대기";
    }
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }


  let immediatePlaceFrameV94 = null;
  function runImmediateButtonRefreshV94() {
    if (isLibraryDetailVisibleV75()) {
      removeAllSectionButtonsV75();
      return;
    }

    cleanupLegacyExtensionButtons();
    removeFullInputBarWhenNotStudioResult();
    ensureSafeSidePanelStyle();
    cleanupMusicNoteEditDuplicateLyricButtons();

    // v94: 스크롤 중에도 카드 버튼을 즉시 재부착/재정렬한다.
    // 프롬프트 버튼은 offscreen 카드 탐색까지 쓰기 때문에 카드에 미리 붙어 있고,
    // 화면에 다시 들어오는 순간 늦게 나타나는 느낌이 줄어든다.
    placeSectionButtons();
    lockSectionButtonPositions();
    ensureKoLyricsFallbackButton();
  }

  function scheduleImmediateButtonRefreshV94() {
    if (immediatePlaceFrameV94) return;
    immediatePlaceFrameV94 = requestAnimationFrame(() => {
      immediatePlaceFrameV94 = null;
      try { runImmediateButtonRefreshV94(); } catch {}
    });
  }

  let placeTimer = null;
  function schedulePlace() {
    cleanupLegacyExtensionButtons();
    removeFullInputBarWhenNotStudioResult();
    ensureSafeSidePanelStyle();
    forceStudioEntryOnceSafely();
    clearTimeout(placeTimer);
    placeTimer = setTimeout(placeWidget, 80);
  }

  const observer = new MutationObserver(schedulePlace);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedulePlace);
  window.addEventListener("scroll", scheduleImmediateButtonRefreshV94, true);
  window.addEventListener("wheel", scheduleImmediateButtonRefreshV94, { passive: true, capture: true });
  window.addEventListener("touchmove", scheduleImmediateButtonRefreshV94, { passive: true, capture: true });

  setTimeout(() => { cleanupLegacyExtensionButtons(); ensureSafeSidePanelStyle(); forceStudioEntryOnceSafely(); placeWidget(); }, 500);
  setInterval(() => {
    if (isLibraryDetailVisibleV75()) {
      removeAllSectionButtonsV75();
      return;
    }
    cleanupLegacyExtensionButtons();
    removeFullInputBarWhenNotStudioResult();
    ensureKoLyricsFallbackButton();
    cleanupMusicNoteEditDuplicateLyricButtons();
    ensureSafeSidePanelStyle();
    forceStudioEntryOnceSafely();
    refreshStatusAndButtons();
    placeSectionButtons();
    lockSectionButtonPositions();
    ensureKoLyricsFallbackButton();
    cleanupMusicNoteEditDuplicateLyricButtons();
  }, 2500);
})();


try {
  if (!window.soridrawLockSectionResizeV23) {
    window.soridrawLockSectionResizeV23 = true;
    window.addEventListener("resize", () => {
      setTimeout(() => {
        try {
          if (typeof cleanupLegacyExtensionButtons === "function") cleanupLegacyExtensionButtons();
          if (typeof placeSectionButtons === "function") placeSectionButtons();
          if (typeof lockSectionButtonPositions === "function") lockSectionButtonPositions();
          if (typeof ensureKoLyricsFallbackButton === "function") ensureKoLyricsFallbackButton();
    cleanupMusicNoteEditDuplicateLyricButtons();
        } catch {}
      }, 80);
    }, { passive: true });
  }
} catch {}
