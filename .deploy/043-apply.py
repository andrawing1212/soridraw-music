from PIL import Image
from pathlib import Path
import json, re

root = Path('.')
brand = root / 'public/brand'
mask_source = Image.open(brand / 'soridraw-favicon-test-042.png').convert('RGBA')
alpha = mask_source.getchannel('A')
bbox = alpha.getbbox()
if not bbox or alpha.getpixel((0, 0)) != 0:
    raise SystemExit('invalid TEST transparent source')
mask_crop = alpha.crop(bbox)

# Reuse the already-verified SORIDRAW transparent shape from TEST 042.
# Only recolor it to the production yellow -> coral -> pink identity.
def lerp(a, b, t):
    return int(round(a + (b - a) * t))

def production_color(t):
    top = (255, 198, 0)
    mid = (255, 125, 72)
    bottom = (255, 48, 145)
    if t <= 0.52:
        u = t / 0.52
        return tuple(lerp(top[i], mid[i], u) for i in range(3))
    u = (t - 0.52) / 0.48
    return tuple(lerp(mid[i], bottom[i], u) for i in range(3))

def colored_crop():
    w, h = mask_crop.size
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    pix = out.load()
    a = mask_crop.load()
    for y in range(h):
        rgb = production_color(0 if h <= 1 else y / (h - 1))
        for x in range(w):
            av = a[x, y]
            if av:
                pix[x, y] = (rgb[0], rgb[1], rgb[2], av)
    return out

crop = colored_crop()

def render(size: int, fill: float = 0.94):
    max_side = int(round(size * fill))
    scale = min(max_side / crop.width, max_side / crop.height)
    w = max(1, int(round(crop.width * scale)))
    h = max(1, int(round(crop.height * scale)))
    piece = crop.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(piece, ((size - w) // 2, (size - h) // 2))
    return canvas

outputs = {
    'soridraw-favicon-production-043.png': 96,
    'soridraw-app-production-043.png': 192,
    'soridraw-app-production-043-256.png': 256,
    'soridraw-app-production-043-512.png': 512,
}
for name, size in outputs.items():
    im = render(size)
    im.save(brand / name, format='PNG', optimize=False)
    a = im.getchannel('A')
    b = a.getbbox()
    if a.getpixel((0, 0)) != 0 or not b or max(b[2]-b[0], b[3]-b[1]) < int(size * 0.90):
        raise SystemExit(f'bad production icon {name}: {b}')

render(256).save(
    brand / 'soridraw-production-043.ico',
    format='ICO',
    sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)],
)

manifest_path = root / 'public/manifest.production.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['name'] = 'SORIDRAW'
manifest['short_name'] = 'SORIDRAW'
manifest['icons'] = [
    {'src':'/brand/soridraw-app-production-043.png','sizes':'192x192','type':'image/png','purpose':'any'},
    {'src':'/brand/soridraw-app-production-043-256.png','sizes':'256x256','type':'image/png','purpose':'any'},
    {'src':'/brand/soridraw-app-production-043-512.png','sizes':'512x512','type':'image/png','purpose':'any'},
]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'public/app-version.json').write_text(json.dumps({'version':'043'}, indent=2) + '\n', encoding='utf-8')

update_path = root / 'src/services/appUpdateNotice.ts'
update_text = update_path.read_text(encoding='utf-8')
if "CURRENT_APP_VERSION = '042'" not in update_text:
    raise SystemExit('042 update version anchor missing')
update_path.write_text(update_text.replace("CURRENT_APP_VERSION = '042'", "CURRENT_APP_VERSION = '043'", 1), encoding='utf-8')

main_text = (root / 'src/main.tsx').read_text(encoding='utf-8')
if 'startAppUpdateNotice();' not in main_text:
    raise SystemExit('update notice bootstrap missing')

index_path = root / 'index.html'
text = index_path.read_text(encoding='utf-8')
text = text.replace('<title>SORIDRAW(T)</title>', '<title>SORIDRAW</title>', 1)
text = text.replace('name="apple-mobile-web-app-title" content="SORIDRAW(T)"', 'name="apple-mobile-web-app-title" content="SORIDRAW"', 1)
text = text.replace('name="application-name" content="SORIDRAW(T)"', 'name="application-name" content="SORIDRAW"', 1)
pattern = re.compile(r'\s*<!-- 042: TEST transparent app icon / favicon \+ environment names -->.*?document\.documentElement\.dataset\.soridrawEnvironment = environment;\n\s*document\.documentElement\.dataset\.soridrawAppName = appName;\n\s*\}\)\(\);\n\s*</script>', re.S)
replacement = r'''
    <!-- 043: PRODUCTION transparent app icon / favicon + environment names -->
    <link id="soridraw-favicon" rel="icon" type="image/png" sizes="96x96" href="/brand/soridraw-favicon-production-043.png" />
    <link id="soridraw-shortcut-icon" rel="shortcut icon" type="image/x-icon" href="/brand/soridraw-production-043.ico" />
    <link id="soridraw-apple-touch-icon" rel="apple-touch-icon" sizes="192x192" href="/brand/soridraw-app-production-043.png" />
    <link id="soridraw-manifest" rel="manifest" href="/manifest.production.json" crossorigin="use-credentials" />
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
        if (environment === 'production') {
          if (favicon) { favicon.type = 'image/png'; favicon.href = '/brand/soridraw-favicon-production-043.png'; }
          if (shortcutIcon) { shortcutIcon.type = 'image/x-icon'; shortcutIcon.href = '/brand/soridraw-production-043.ico'; }
          if (appleTouchIcon) appleTouchIcon.href = '/brand/soridraw-app-production-043.png';
          if (manifest) manifest.href = '/manifest.production.json';
        } else if (environment === 'test') {
          if (favicon) { favicon.type = 'image/png'; favicon.href = '/brand/soridraw-favicon-test-042.png'; }
          if (shortcutIcon) { shortcutIcon.type = 'image/x-icon'; shortcutIcon.href = '/brand/soridraw-test-042.ico'; }
          if (appleTouchIcon) appleTouchIcon.href = '/brand/soridraw-app-test-042.png';
          if (manifest) manifest.href = '/manifest.test.json';
        } else {
          if (favicon) { favicon.type = 'image/png'; favicon.href = '/brand/soridraw-favicon-preview.png?v=036'; }
          if (shortcutIcon) { shortcutIcon.type = 'image/png'; shortcutIcon.href = '/brand/soridraw-favicon-preview.png?v=036'; }
          if (appleTouchIcon) appleTouchIcon.href = '/brand/soridraw-app-preview.png?v=036';
          if (manifest) manifest.href = '/manifest.preview.json?v=036';
        }
        document.documentElement.dataset.soridrawEnvironment = environment;
        document.documentElement.dataset.soridrawAppName = appName;
      })();
    </script>'''
text, count = pattern.subn(replacement, text, count=1)
if count != 1:
    raise SystemExit(f'index branding block replacement count={count}')
index_path.write_text(text, encoding='utf-8')
print('APPLY_PRODUCTION_043=PASS')
