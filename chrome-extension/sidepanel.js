const frame = document.getElementById("appFrame");
const refreshButton = document.getElementById("refresh");
const openTabButton = document.getElementById("openTab");
const envButtons = Array.from(document.querySelectorAll("[data-url]"));
const envPanel = document.getElementById("envPanel");
const toggleEnv = document.getElementById("toggleEnv");

let currentUrl = "https://soridraw-music.vercel.app/?sidepanel=1";

function setActiveButton(url) {
  envButtons.forEach((button) => button.classList.toggle("active", button.dataset.url === url));
}
function setFrameUrl(url) {
  currentUrl = url;
  frame.src = url;
  setActiveButton(url);
}
async function loadStoredUrl() {
  const response = await chrome.runtime.sendMessage({ type: "getAppUrl" });
  setFrameUrl(response?.url || "https://soridraw-music.vercel.app/?sidepanel=1");
}
async function saveUrl(url) {
  await chrome.runtime.sendMessage({ type: "setAppUrl", url });
}
envButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const url = button.dataset.url;
    await saveUrl(url);
    setFrameUrl(url);
  });
});
refreshButton.addEventListener("click", () => { frame.src = currentUrl; });
openTabButton.addEventListener("click", () => { chrome.tabs.create({ url: currentUrl }); });
toggleEnv.addEventListener("click", () => {
  envPanel.classList.toggle("collapsed");
  toggleEnv.classList.toggle("collapsed");
});
loadStoredUrl();
