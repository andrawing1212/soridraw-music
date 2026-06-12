(() => {
  const params = new URLSearchParams(location.search);
  const src = params.get("src") || "";
  const audio = document.getElementById("audio");
  const manual = document.getElementById("manualPlay");
  const urlBox = document.getElementById("url");

  urlBox.textContent = src || "재생 URL이 없습니다.";

  if (!src) {
    manual.style.display = "inline-flex";
    return;
  }

  audio.src = src;
  audio.autoplay = true;
  audio.preload = "auto";

  async function tryPlay() {
    try {
      await audio.play();
      manual.style.display = "none";
    } catch {
      manual.style.display = "inline-flex";
    }
  }

  manual.addEventListener("click", tryPlay);
  audio.addEventListener("canplay", tryPlay, { once: true });

  setTimeout(tryPlay, 120);
  setTimeout(tryPlay, 650);
})();
