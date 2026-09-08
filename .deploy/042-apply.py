from PIL import Image
from pathlib import Path
import json
import os
import re

VERSION = "042"
APP_NAME = "SORIDRAW(T)"
brand = Path("public/brand")
brand.mkdir(parents=True, exist_ok=True)
source_path = Path(os.environ["RUNNER_TEMP"]) / "test-blue-source.png"
src = Image.open(source_path).convert("RGBA")
alpha = src.getchannel("A")
bbox = alpha.getbbox()
if not bbox or alpha.getpixel((0, 0)) != 0:
    raise SystemExit("invalid transparent TEST source")
crop = src.crop(bbox)


def render(size: int, fill: float = 0.94):
    max_side = int(round(size * fill))
    scale = min(max_side / crop.width, max_side / crop.height)
    w = max(1, int(round(crop.width * scale)))
    h = max(1, int(round(crop.height * scale)))
    piece = crop.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(piece, ((size - w) // 2, (size - h) // 2))
    return canvas


outputs = {
    "soridraw-favicon-test-042.png": 96,
    "soridraw-app-test-042.png": 192,
    "soridraw-app-test-042-256.png": 256,
    "soridraw-app-test-042-512.png": 512,
}
for name, size in outputs.items():
    im = render(size)
    im.save(brand / name, format="PNG", optimize=False)
    a = im.getchannel("A")
    b = a.getbbox()
    if a.getpixel((0, 0)) != 0 or not b or max(b[2] - b[0], b[3] - b[1]) < int(size * 0.90):
        raise SystemExit(f"bad TEST icon {name}: {b}")

render(256).save(
    brand / "soridraw-test-042.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)

manifest_path = Path("public/manifest.test.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["name"] = APP_NAME
manifest["short_name"] = APP_NAME
manifest["icons"] = [
    {"src": "/brand/soridraw-app-test-042.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "/brand/soridraw-app-test-042-256.png", "sizes": "256x256", "type": "image/png", "purpose": "any"},
    {"src": "/brand/soridraw-app-test-042-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
Path("public/app-version.json").write_text(json.dumps({"version": VERSION}, indent=2) + "\n", encoding="utf-8")

update_service = Path("src/services/appUpdateNotice.ts")
update_service.write_text(
    """const CURRENT_APP_VERSION = '042';
const VERSION_URL = '/app-version.json';
const NOTICE_ID = 'soridraw-app-update-notice';
const MIN_CHECK_INTERVAL_MS = 30_000;
let started = false;
let lastCheckedAt = 0;

const showUpdateNotice = () => {
  if (document.getElementById(NOTICE_ID)) return;
  const button = document.createElement('button');
  button.id = NOTICE_ID;
  button.type = 'button';
  button.textContent = '새 업데이트 · 적용';
  button.setAttribute('aria-label', '새 업데이트 적용');
  Object.assign(button.style, {
    position: 'fixed', top: 'max(12px, env(safe-area-inset-top))', right: '12px',
    zIndex: '2147483646', border: '0', borderRadius: '999px', padding: '9px 13px',
    background: '#ffb400', color: '#151515', fontSize: '12px', fontWeight: '700',
    lineHeight: '1', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,.22)'
  });
  button.addEventListener('click', () => window.location.reload());
  document.body.appendChild(button);
};

const checkForUpdate = async (force = false) => {
  const now = Date.now();
  if (!force && now - lastCheckedAt < MIN_CHECK_INTERVAL_MS) return;
  lastCheckedAt = now;
  try {
    const response = await fetch(`${VERSION_URL}?t=${now}`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json() as { version?: string | number };
    const remoteVersion = String(payload?.version || '').trim();
    if (remoteVersion && remoteVersion !== CURRENT_APP_VERSION) showUpdateNotice();
  } catch {
    // Offline/network errors stay silent and retry on the next app return.
  }
};

export const startAppUpdateNotice = () => {
  if (started || typeof window === 'undefined') return;
  started = true;
  void checkForUpdate(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  window.addEventListener('focus', () => void checkForUpdate());
};
""",
    encoding="utf-8",
)

main_path = Path("src/main.tsx")
main_text = main_path.read_text(encoding="utf-8")
anchor = "import { startPreviewVersionSignal } from './services/versionSignalService';\n"
if "startAppUpdateNotice" not in main_text:
    if anchor not in main_text:
        raise SystemExit("main.tsx import anchor missing")
    main_text = main_text.replace(anchor, anchor + "import { startAppUpdateNotice } from './services/appUpdateNotice';\n", 1)
    main_text = main_text.replace("void startPreviewVersionSignal();\n", "void startPreviewVersionSignal();\nstartAppUpdateNotice();\n", 1)
main_path.write_text(main_text, encoding="utf-8")

index_path = Path("index.html")
text = index_path.read_text(encoding="utf-8")
text = text.replace("<title>SORIDRAW's Studio</title>", "<title>SORIDRAW(T)</title>", 1)
text = text.replace(
    '<meta name="apple-mobile-web-app-title" content="SORIDRAW" />',
    '<meta id="soridraw-apple-app-title" name="apple-mobile-web-app-title" content="SORIDRAW(T)" />\n    <meta id="soridraw-application-name" name="application-name" content="SORIDRAW(T)" />',
    1,
)
pattern = re.compile(
    r"\s*<!-- 036: environment-specific app icon / favicon -->.*?document\.documentElement\.dataset\.soridrawEnvironment = environment;\n\s*\}\)\(\);\n\s*</script>",
    re.S,
)
replacement = '''
    <!-- 042: TEST transparent app icon / favicon + environment names -->
    <link id="soridraw-favicon" rel="icon" type="image/png" sizes="96x96" href="/brand/soridraw-favicon-test-042.png" />
    <link id="soridraw-shortcut-icon" rel="shortcut icon" type="image/x-icon" href="/brand/soridraw-test-042.ico" />
    <link id="soridraw-apple-touch-icon" rel="apple-touch-icon" sizes="192x192" href="/brand/soridraw-app-test-042.png" />
    <link id="soridraw-manifest" rel="manifest" href="/manifest.test.json" crossorigin="use-credentials" />
    <script>
      (function() {
        var host = String(window.location.hostname || '').toLowerCase();
        var environment = 'preview';
        if (host === 'soridraw.com' || host === 'www.soridraw.com' || host === 'soridraw.web.app') {
          environment = 'production';
        } else if (host === 'test.soridraw.com' || host === 'soridraw-test.web.app') {
          environment = 'test';
        }
        var appName = environment === 'production' ? 'SORIDRAW' : environment === 'test' ? 'SORIDRAW(T)' : 'SORIDRAW(P)';
        document.title = appName;
        var appleTitle = document.getElementById('soridraw-apple-app-title');
        var applicationName = document.getElementById('soridraw-application-name');
        if (appleTitle) appleTitle.setAttribute('content', appName);
        if (applicationName) applicationName.setAttribute('content', appName);
        var favicon = document.getElementById('soridraw-favicon');
        var shortcutIcon = document.getElementById('soridraw-shortcut-icon');
        var appleTouchIcon = document.getElementById('soridraw-apple-touch-icon');
        var manifest = document.getElementById('soridraw-manifest');
        if (environment === 'test') {
          if (favicon) { favicon.type = 'image/png'; favicon.href = '/brand/soridraw-favicon-test-042.png'; }
          if (shortcutIcon) { shortcutIcon.type = 'image/x-icon'; shortcutIcon.href = '/brand/soridraw-test-042.ico'; }
          if (appleTouchIcon) appleTouchIcon.href = '/brand/soridraw-app-test-042.png';
          if (manifest) manifest.href = '/manifest.test.json';
        } else {
          var fallbackFavicon = environment === 'production' ? '/brand/soridraw-favicon-production.svg?v=036' : '/brand/soridraw-favicon-preview.png?v=036';
          var fallbackType = environment === 'production' ? 'image/svg+xml' : 'image/png';
          if (favicon) { favicon.type = fallbackType; favicon.href = fallbackFavicon; }
          if (shortcutIcon) { shortcutIcon.type = fallbackType; shortcutIcon.href = fallbackFavicon; }
          if (appleTouchIcon) appleTouchIcon.href = '/brand/soridraw-app-' + environment + '.png?v=036';
          if (manifest) manifest.href = '/manifest.' + environment + '.json?v=036';
        }
        document.documentElement.dataset.soridrawEnvironment = environment;
        document.documentElement.dataset.soridrawAppName = appName;
      })();
    </script>'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f"index branding block replacement count={count}")
index_path.write_text(text, encoding="utf-8")

print("APPLY_TEST_042=PASS")
