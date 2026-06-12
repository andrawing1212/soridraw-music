function normalizeText(value) {
  return String(value || "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function getCurrentValue(element) {
  if (!element) return "";
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value || "";
  return element.innerText || element.textContent || "";
}

function dispatchEditEvents(element, value) {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value.slice(0, 1) }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function clearEditable(element) {
  if (!element) return;

  element.focus();

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(element, "");
    else element.value = "";
    dispatchEditEvents(element, "");
    return;
  }

  if (element.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("delete", false, null);
    element.textContent = "";
    element.innerHTML = "";
    dispatchEditEvents(element, "");
  }
}

function setNativeValue(element, value) {
  if (!element) return false;

  const cleanValue = normalizeText(value);
  element.focus();

  const isTextInput = element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
  const isEditableBox =
    element.isContentEditable ||
    element.hasAttribute("contenteditable") ||
    element.getAttribute("role") === "textbox";

  if (isTextInput) {
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(element, cleanValue);
    else element.value = cleanValue;
  } else if (isEditableBox) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, cleanValue);
    } catch {}

    if (normalizeText(getCurrentValue(element)) !== cleanValue) {
      element.textContent = cleanValue;
    }
  } else {
    element.textContent = cleanValue;
  }

  dispatchEditEvents(element, cleanValue);

  try {
    element.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: cleanValue
    }));
  } catch {}

  element.blur();
  return true;
}

function getEditableFields(scope = document) {
  return Array.from(scope.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable], [role='textbox']"))
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const editable =
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox" ||
        el.hasAttribute("contenteditable");

      return editable &&
        rect.width > 40 &&
        rect.height > 18 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || 1) > 0;
    });
}

function getElementText(el) {
  return String(el?.innerText || el?.textContent || "").trim();
}

function getFieldContext(el) {
  const chunks = [];
  let node = el;
  let depth = 0;
  while (node && node !== document.body && depth < 7) {
    chunks.push(getElementText(node));
    node = node.parentElement;
    depth += 1;
  }

  chunks.push(el.getAttribute("placeholder") || "");
  chunks.push(el.getAttribute("aria-label") || "");
  chunks.push(el.getAttribute("name") || "");
  chunks.push(el.id || "");

  return chunks.join(" ").toLowerCase();
}


function getFieldLabelContext(el) {
  let ctx = getFieldContext(el);
  const value = normalizeText(getCurrentValue(el)).toLowerCase();

  // Styles 칸 안에 이미 들어있던 '독일어 가사...' 같은 값 때문에
  // style 후보가 가사로 오판되지 않도록 현재 입력값은 context 판정에서 제거한다.
  if (value) {
    ctx = ctx.replace(value, " ");
  }

  return ctx;
}

function hasContext(el, patterns) {
  const ctx = getFieldContext(el);
  return patterns.some((pattern) => pattern.test(ctx));
}

function findFieldBySection(sectionPattern, negativePatterns = [], preferTop = false) {
  const fields = getEditableFields();

  const candidates = fields
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const context = getFieldContext(el);
      let score = 0;

      if (sectionPattern.test(context)) score += 120;
      if (el.tagName === "TEXTAREA" || el.isContentEditable) score += 20;
      score += Math.min(30, rect.height / 12);

      for (const negative of negativePatterns) {
        if (negative.test(context)) score -= 100;
      }

      if (preferTop) score += Math.max(0, 30 - rect.top / 20);

      return { el, score, rect, context };
    })
    .filter((row) => row.score > 40)
    .sort((a, b) => b.score - a.score || a.rect.top - b.rect.top);

  return candidates[0]?.el || null;
}

function findTitleField() {
  const fields = getEditableFields();
  const candidates = fields
    .map((el) => {
      const ctx = getFieldContext(el);
      const rect = el.getBoundingClientRect();
      let score = 0;
      if (/title|제목|song name|name/.test(ctx)) score += 120;
      if (el.tagName === "INPUT") score += 25;
      if (/lyrics|lyric|가사|styles|style|prompt|프롬프트/.test(ctx)) score -= 90;
      score += Math.max(0, 20 - rect.top / 40);
      return { el, score, rect };
    })
    .filter((row) => row.score > 45)
    .sort((a, b) => b.score - a.score || a.rect.top - b.rect.top);

  return candidates[0]?.el || null;
}

function findLyricsField() {
  return findFieldBySection(
    /(^|\s)(lyrics|lyric|가사)(\s|$)|write\s+prompt\s+instrumental/,
    [/styles|style|스타일|more options/],
    true
  );
}


function isVisibleNode(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
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

function findVisibleShortLabel(pattern) {
  const candidates = [];

  for (const el of Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,button,span,p,div,label"))) {
    if (!isVisibleNode(el)) continue;

    const text = normalizeText(el.innerText || el.textContent || "");
    if (!text || text.length > 80) continue;
    if (!pattern.test(text)) continue;

    const rect = el.getBoundingClientRect();
    candidates.push({ el, rect, text });
  }

  candidates.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
  return candidates[0]?.el || null;
}

function findSectionCardFromLabel(labelEl) {
  if (!labelEl) return null;

  let current = labelEl;

  for (let depth = 0; current && current !== document.body && depth < 9; depth += 1) {
    const rect = current.getBoundingClientRect();
    const fields = getEditableFields(current);

    if (
      fields.length &&
      rect.width > 240 &&
      rect.height > 90 &&
      rect.height < window.innerHeight * 0.92
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function findEditableInsideSection(section) {
  if (!section) return null;

  const fields = getEditableFields(section)
    .map((el) => ({ el, rect: el.getBoundingClientRect(), value: normalizeText(getCurrentValue(el)) }))
    .filter((row) => row.rect.width > 80 && row.rect.height > 24)
    .sort((a, b) => {
      const areaB = b.rect.width * b.rect.height;
      const areaA = a.rect.width * a.rect.height;
      return areaB - areaA || a.rect.top - b.rect.top;
    });

  return fields[0]?.el || null;
}

function findStyleFieldByVisibleSection() {
  const label = findVisibleShortLabel(/^(styles|style|스타일)$/i);
  const section = findSectionCardFromLabel(label);
  return findEditableInsideSection(section);
}

function findStyleField() {
  const sectionField = findStyleFieldByVisibleSection();
  if (sectionField) return sectionField;

  const fields = getEditableFields();

  const candidates = fields
    .map((el) => {
      const rect = el.getBoundingClientRect();
      const ctx = getFieldLabelContext(el);
      const rawCtx = getFieldContext(el);
      let score = 0;

      if (/(^|\s)(styles|style|스타일)(\s|$)|style of music|music style|describe style/i.test(ctx)) score += 180;
      if (/(^|\s)(styles|style|스타일)(\s|$)|style of music|music style|describe style/i.test(rawCtx)) score += 60;
      if (el.tagName === "TEXTAREA" || el.isContentEditable || el.hasAttribute("contenteditable") || el.getAttribute("role") === "textbox") score += 25;
      score += Math.min(30, rect.height / 12);

      if (/lyrics|lyric|가사|write\s+prompt\s+instrumental/i.test(ctx)) score -= 130;
      if (/more options/i.test(ctx)) score -= 40;

      return { el, score, rect, ctx };
    })
    .filter((row) => row.score > 55)
    .sort((a, b) => b.score - a.score || a.rect.top - b.rect.top);

  return candidates[0]?.el || null;
}

function findFallbackLargeField(exclude = new Set()) {
  return getEditableFields()
    .filter((el) => !exclude.has(el) && (el.tagName === "TEXTAREA" || el.isContentEditable))
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .sort((a, b) => b.rect.height - a.rect.height)[0]?.el || null;
}

function sanitizePromptOnly(text) {
  let out = normalizeText(text);

  // 방어적으로 가사 라벨 이후가 섞이면 제거
  const lyricMarkers = [
    "\n[lyrics]",
    "\n[한글 가사]",
    "\nlyrics",
    "\n한글 가사",
    "\n[verse",
    "\n[chorus",
    "\n[pre-chorus",
    "\n[bridge",
    "\n[outro",
    "\n[intro"
  ];

  const lower = out.toLowerCase();
  let cut = out.length;
  for (const marker of lyricMarkers) {
    const idx = lower.indexOf(marker.toLowerCase());
    if (idx > 0 && idx < cut) cut = idx;
  }

  return normalizeText(out.slice(0, cut));
}

function sanitizeLyricsOnly(text) {
  let out = normalizeText(text);

  // 방어적으로 프롬프트 라벨이 앞에 섞이면 제거
  out = out.replace(/^\[title\][\s\S]*?\[lyrics\]/i, "");
  out = out.replace(/^\[music prompt\][\s\S]*?\[lyrics\]/i, "");
  out = out.replace(/^\[lyrics\]/i, "");

  return normalizeText(out);
}

function fillSuno(song) {
  const title = normalizeText(song?.title || "");
  const lyrics = sanitizeLyricsOnly(song?.lyrics || "");
  const prompt = sanitizePromptOnly(song?.prompt || "");

  const used = new Set();
  const filled = [];

  // v86 핵심:
  // 프롬프트 단독 입력은 잘 되는데 전체입력에서만 안 됐던 이유는
  // 가사 입력 후 Styles 탐색이 흔들릴 수 있었기 때문이다.
  // 그래서 전체입력에서도 Styles/프롬프트를 가장 먼저 넣는다.
  const styleField = prompt ? findStyleField() : null;
  if (styleField && prompt) {
    setNativeValue(styleField, prompt);

    setTimeout(() => {
      const current = normalizeText(getCurrentValue(styleField));
      if (current !== prompt) {
        setNativeValue(styleField, prompt);
      }
    }, 250);

    used.add(styleField);
    filled.push("prompt");
  }

  const titleField = title ? findTitleField() : null;
  if (titleField && title && !used.has(titleField)) {
    setNativeValue(titleField, title);
    used.add(titleField);
    filled.push("title");
  }

  const lyricsField = lyrics ? findLyricsField() : null;
  if (lyricsField && lyrics && !used.has(lyricsField)) {
    setNativeValue(lyricsField, lyrics);
    used.add(lyricsField);
    filled.push("lyrics");
  }

  if (!filled.includes("lyrics") && lyrics) {
    const fallbackLyrics = findFallbackLargeField(used);
    if (fallbackLyrics && !hasContext(fallbackLyrics, [/styles|style|스타일/])) {
      setNativeValue(fallbackLyrics, lyrics);
      used.add(fallbackLyrics);
      filled.push("lyrics_fallback");
    }
  }

  if (!filled.includes("prompt") && prompt) {
    const fallbackPrompt = findStyleFieldByVisibleSection() || findFallbackLargeField(used);
    if (fallbackPrompt && !used.has(fallbackPrompt) && !hasContext(fallbackPrompt, [/lyrics|lyric|가사|title|제목/])) {
      setNativeValue(fallbackPrompt, prompt);
      used.add(fallbackPrompt);
      filled.push("prompt_fallback");
    }
  }

  if (prompt && !filled.some((item) => item.includes("prompt"))) {
    return {
      ok: false,
      reason: "styles_prompt_not_filled",
      filled,
      promptLength: prompt.length,
      styleFieldFound: !!styleField,
      fieldCount: getEditableFields().length
    };
  }

  if (!filled.length) return { ok: false, reason: "suno_no_safe_target", promptLength: prompt.length };

  return {
    ok: true,
    mode: "prompt_first_fill_v114",
    filled,
    promptLength: prompt.length,
    styleFieldFound: !!styleField,
    fieldCount: getEditableFields().length
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "fillSuno") {
    try {
      sendResponse(fillSuno(message.song));
    } catch (error) {
      sendResponse({ ok: false, reason: error?.message || String(error) });
    }
    return true;
  }
});


// v114: 본문 재생버튼 제외, 하단 플레이어 컨트롤의 가운데 재생 버튼만 클릭
(() => {
  if (window.__SORIDRAW_SUNO_MANAGED_AUTOPLAY_V114__) return;
  window.__SORIDRAW_SUNO_MANAGED_AUTOPLAY_V114__ = true;

  let clickedHref = "";
  let stoppedHref = "";

  function norm(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isSongPage() {
    return /^\/song\//i.test(location.pathname || "");
  }

  function rectOf(el) {
    try {
      return el.getBoundingClientRect();
    } catch {
      return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    }
  }

  function centerOf(el) {
    const r = rectOf(el);
    return { rect: r, x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function isVisible(el) {
    if (!el) return false;
    const r = rectOf(el);
    const s = getComputedStyle(el);
    return r.width > 10 &&
      r.height > 10 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < window.innerHeight &&
      r.left < window.innerWidth &&
      s.display !== "none" &&
      s.visibility !== "hidden" &&
      Number(s.opacity || 1) > 0;
  }

  function labelOf(el) {
    return norm([
      el?.innerText,
      el?.textContent,
      el?.getAttribute?.("aria-label"),
      el?.getAttribute?.("title"),
      el?.getAttribute?.("data-testid"),
      el?.getAttribute?.("data-state"),
      el?.getAttribute?.("class"),
      el?.className
    ].filter(Boolean).join(" "));
  }

  function htmlOf(el) {
    return String(el?.innerHTML || "");
  }

  function buttons() {
    return Array.from(document.querySelectorAll("button, [role='button'], [aria-label], [title]"))
      .filter(isVisible);
  }

  function hasBlockingDialog() {
    const dialogs = Array.from(document.querySelectorAll("[role='dialog'], [aria-modal='true'], dialog"))
      .filter(isVisible);
    if (!dialogs.length) return false;

    const text = norm(dialogs.map((d) => d.innerText || d.textContent || "").join(" "));
    if (!text) return true;

    return /확인|경고|warning|are you sure|leave|continue|cancel|취소|계속|previous|이전/i.test(text);
  }

  function hasPauseIcon(el) {
    const label = labelOf(el);
    const html = htmlOf(el);
    return /pause|paused|일시정지/i.test(label) ||
      /pause|paused|icon-pause|Pause/i.test(html);
  }

  function hasPlayIcon(el) {
    const label = labelOf(el);
    const html = htmlOf(el);

    if (/play|재생/i.test(label) && !/playlist|display/i.test(label)) return true;
    if (/play|icon-play|Play/i.test(html)) return true;
    if (/<svg/i.test(html) && /polygon|triangle/i.test(html)) return true;
    if (el?.querySelector?.("svg polygon")) return true;

    const r = rectOf(el);
    const svgOnly = !!el?.querySelector?.("svg, path") && !norm(el.innerText || el.textContent);
    return svgOnly && r.width >= 22 && r.width <= 120 && r.height >= 22 && r.height <= 120;
  }

  function isPrevNextButton(el) {
    const label = labelOf(el);
    const html = htmlOf(el);

    if (/previous|prev|next|skip|rewind|fast-forward|fastforward|skip-back|skip-forward|chevron-left|chevron-right|이전|다음|앞곡|다음곡|전곡|후곡|건너뛰기/i.test(label)) return true;
    if (/previous|prev|next|skip|rewind|fast-forward|skip-back|skip-forward|chevron-left|chevron-right/i.test(html)) return true;

    return false;
  }

  function isSocialButton(el) {
    const label = labelOf(el);
    const html = htmlOf(el);

    if (/like|dislike|thumb|thumbs|comment|share|more|menu|좋아요|싫어요|댓글|공유|더보기|메뉴/i.test(label)) return true;
    if (/like|dislike|thumb|thumbs|message-circle|comment|share|more-horizontal|ellipsis|dots/i.test(html)) return true;

    return false;
  }

  function isForbiddenButton(el) {
    const label = labelOf(el);

    if (isSocialButton(el)) return true;
    if (/remix|edit|download|similar|create|copy|수정|편집|다운로드|복사/i.test(label)) return true;

    const text = norm(el.innerText || el.textContent || "");
    if (/^\s*▶?\s*\d+\s*$/.test(text) || (/^\d+$/.test(text.replace(/[^\d]/g, "")) && text.length <= 5)) return true;

    return false;
  }

  function isBottomAppNavButton(el) {
    const { y } = centerOf(el);
    const label = labelOf(el);
    const html = htmlOf(el);

    if (y < window.innerHeight * 0.925) return false;
    return /home|search|create|library|profile|explore|홈|검색|생성|라이브러리|프로필|nav|compass|user/i.test(label + " " + html);
  }

  function isInPlayerStrip(el) {
    const { rect, x, y } = centerOf(el);

    // PC/태블릿: 하단 중앙의 고정 플레이어 바
    const pcTabletStrip = y > window.innerHeight * 0.72 &&
      y < window.innerHeight * 0.985 &&
      x > window.innerWidth * 0.18 &&
      x < window.innerWidth * 0.82;

    // 모바일: 최하단 네비게이션 바로 윗줄의 미니플레이어
    const mobileMiniStrip = y > window.innerHeight * 0.82 &&
      y < window.innerHeight * 0.925 &&
      x > window.innerWidth * 0.52 &&
      x < window.innerWidth * 0.98;

    const reasonableSize = rect.width >= 18 &&
      rect.width <= 125 &&
      rect.height >= 18 &&
      rect.height <= 110;

    return reasonableSize && (pcTabletStrip || mobileMiniStrip);
  }

  function playerControlCandidates() {
    return buttons()
      .filter((el) => {
        if (isBottomAppNavButton(el)) return false;
        if (isForbiddenButton(el)) return false;
        if (!isInPlayerStrip(el)) return false;
        if (!el.querySelector?.("svg, path")) return false;
        return true;
      })
      .map((el) => ({ el, ...centerOf(el), label: labelOf(el), html: htmlOf(el) }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }

  function groupPlayerRows(items) {
    const rows = [];
    for (const item of items) {
      let row = rows.find((r) => Math.abs(r.y - item.y) < 30);
      if (!row) {
        row = { y: item.y, items: [] };
        rows.push(row);
      }
      row.items.push(item);
      row.y = row.items.reduce((sum, it) => sum + it.y, 0) / row.items.length;
    }

    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
    }

    return rows;
  }

  function pickCenterBetweenPrevNext(row) {
    const items = row.items;
    if (items.length < 3) return null;

    // │◀ / ▶ / ▶│ 형태에서 가운데 버튼 찾기.
    // 라벨이 없을 수 있으므로 x 순서 기준으로도 판단한다.
    for (let i = 1; i < items.length - 1; i++) {
      const left = items[i - 1];
      const mid = items[i];
      const right = items[i + 1];

      if (isForbiddenButton(mid.el)) continue;
      if (isPrevNextButton(mid.el)) continue;
      if (hasPauseIcon(mid.el)) return mid.el;
      if (!hasPlayIcon(mid.el)) continue;

      const leftLooksSide = isPrevNextButton(left.el) || Math.abs(mid.x - left.x) < 95;
      const rightLooksSide = isPrevNextButton(right.el) || Math.abs(right.x - mid.x) < 95;
      const balanced = Math.abs((mid.x - left.x) - (right.x - mid.x)) < 70;

      if (leftLooksSide && rightLooksSide && balanced) {
        return mid.el;
      }
    }

    return null;
  }

  function pickPcTabletCenter(row) {
    if (!row.items.length) return null;

    const usable = row.items.filter((item) => {
      if (isForbiddenButton(item.el)) return false;
      if (isPrevNextButton(item.el)) return false;
      return hasPlayIcon(item.el) || hasPauseIcon(item.el);
    });

    if (!usable.length) return null;

    usable.sort((a, b) => Math.abs(a.x - window.innerWidth * 0.5) - Math.abs(b.x - window.innerWidth * 0.5));
    const pick = usable[0];
    if (!pick) return null;

    if (Math.abs(pick.x - window.innerWidth * 0.5) > Math.max(120, window.innerWidth * 0.20)) return null;
    return pick.el;
  }

  function pickMobileRightCenter(row) {
    const usable = row.items.filter((item) => {
      if (item.x < window.innerWidth * 0.52) return false;
      if (isForbiddenButton(item.el)) return false;
      if (isPrevNextButton(item.el)) return false;
      return hasPlayIcon(item.el) || hasPauseIcon(item.el);
    });

    if (!usable.length) return null;

    // 모바일 미니플레이어 오른쪽 컨트롤 영역에서 가운데 버튼 선택
    usable.sort((a, b) => Math.abs(a.x - window.innerWidth * 0.82) - Math.abs(b.x - window.innerWidth * 0.82));
    return usable[0]?.el || null;
  }

  function findPlayerCenterButton() {
    const rows = groupPlayerRows(playerControlCandidates());
    if (!rows.length) return null;

    // 먼저 prev/play/next 형태가 명확한 줄에서 가운데 버튼
    for (const row of rows) {
      const between = pickCenterBetweenPrevNext(row);
      if (between) return between;
    }

    const mobileRows = rows
      .filter((row) => row.y > window.innerHeight * 0.82 && row.y < window.innerHeight * 0.925)
      .sort((a, b) => b.y - a.y);

    for (const row of mobileRows) {
      const pick = pickMobileRightCenter(row);
      if (pick) return pick;
    }

    const pcRows = rows
      .filter((row) => row.y > window.innerHeight * 0.72)
      .sort((a, b) => b.items.length - a.items.length);

    for (const row of pcRows) {
      const pick = pickPcTabletCenter(row);
      if (pick) return pick;
    }

    return null;
  }

  function isAlreadyPlaying() {
    for (const media of Array.from(document.querySelectorAll("audio, video"))) {
      try {
        if (!media.paused && !media.ended && media.currentTime > 0) return true;
      } catch {}
    }

    const btn = findPlayerCenterButton();
    return !!btn && hasPauseIcon(btn);
  }

  function findPlayButton() {
    const btn = findPlayerCenterButton();
    if (!btn) return null;
    if (hasPauseIcon(btn)) return null;
    if (!hasPlayIcon(btn)) return null;
    return btn;
  }

  function clickButton(button) {
    const rect = rectOf(button);
    const x = Math.round(rect.left + rect.width / 2);
    const y = Math.round(rect.top + rect.height / 2);

    try { button.focus({ preventScroll: true }); } catch {}

    const common = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y };

    try { button.dispatchEvent(new PointerEvent("pointerover", { ...common, pointerType: "mouse", isPrimary: true })); } catch {}
    try { button.dispatchEvent(new MouseEvent("mouseover", common)); } catch {}
    try { button.dispatchEvent(new PointerEvent("pointermove", { ...common, pointerType: "mouse", isPrimary: true })); } catch {}
    try { button.dispatchEvent(new MouseEvent("mousemove", common)); } catch {}
    try { button.dispatchEvent(new PointerEvent("pointerdown", { ...common, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1 })); } catch {}
    try { button.dispatchEvent(new MouseEvent("mousedown", { ...common, button: 0, buttons: 1 })); } catch {}
    try { button.dispatchEvent(new PointerEvent("pointerup", { ...common, pointerType: "mouse", isPrimary: true, button: 0, buttons: 0 })); } catch {}
    try { button.dispatchEvent(new MouseEvent("mouseup", { ...common, button: 0, buttons: 0 })); } catch {}
    try { button.dispatchEvent(new MouseEvent("click", { ...common, button: 0, buttons: 0 })); } catch {}
    try { button.click(); } catch {}
  }

  async function isManagedPlaybackTab() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "isManagedPlaybackTab" });
      return !!response?.ok && !!response?.isManaged;
    } catch {
      return false;
    }
  }

  async function tryAutoplay(reason = "tick", force = false) {
    if (!isSongPage()) return { ok: false, reason: "not_song_page" };
    if (!force && !(await isManagedPlaybackTab())) return { ok: false, reason: "not_managed_tab" };

    const href = location.href;

    if (stoppedHref === href) return { ok: false, reason: "stopped_for_dialog_or_bad_click" };
    if (clickedHref === href) return { ok: false, reason: "already_clicked_once_for_this_url" };

    if (hasBlockingDialog()) {
      stoppedHref = href;
      return { ok: false, reason: "blocking_dialog" };
    }

    if (isAlreadyPlaying()) return { ok: true, reason: "already_playing" };

    const button = findPlayButton();
    if (!button) return { ok: false, reason: "player_center_play_button_not_found" };

    clickedHref = href;
    clickButton(button);

    setTimeout(() => {
      if (hasBlockingDialog()) stoppedHref = href;
    }, 500);

    return { ok: true, reason: "clicked_player_center_once", label: labelOf(button) };
  }

  function scheduleAutoplay(reason = "schedule", force = false) {
    const delays = [160, 420, 900, 1700, 3000, 4800, 7200, 9800];
    for (const delay of delays) {
      setTimeout(() => tryAutoplay(`${reason}-${delay}`, force), delay);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "soridrawManagedSunoAutoplay") {
      tryAutoplay(message.reason || "message", true).then(sendResponse);
      scheduleAutoplay("message-followup", true);
      return true;
    }
  });

  scheduleAutoplay("initial", false);

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      clickedHref = "";
      stoppedHref = "";
      scheduleAutoplay("url-change", false);
    }
  }, 500);

  const observer = new MutationObserver(() => {
    if (clickedHref !== location.href && stoppedHref !== location.href) {
      setTimeout(() => tryAutoplay("mutation", false), 100);
    }
  });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();
