from pathlib import Path

PROXY_MARKER = 'SORIDRAW_888_SPLIT_LANGUAGE_MIX_ROUTE'
ADMIN_MARKER = 'SORIDRAW_888_ADMIN_CONTEXT_LABELS'

proxy_path = Path('src/services/geminiProxyClient.ts')
proxy = proxy_path.read_text(encoding='utf-8')

if PROXY_MARKER not in proxy:
    if 'SORIDRAW_887_LATENCY_FASTPATH' not in proxy:
        raise SystemExit('888 requires 887 latency fastpath to run first')

    chain_before = """const SORIDRAW_887_LATENCY_FASTPATH = true;
const INITIAL_SONG_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;"""
    chain_after = """const SORIDRAW_887_LATENCY_FASTPATH = true;
const SORIDRAW_888_SPLIT_LANGUAGE_MIX_ROUTE = true;
const INITIAL_SONG_MODEL_CHAIN = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;
const LANGUAGE_MIX_MODEL_CHAIN = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
] as const;"""
    if proxy.count(chain_before) != 1:
        raise SystemExit(f'888 chain anchor mismatch: {proxy.count(chain_before)}')
    proxy = proxy.replace(chain_before, chain_after, 1)

    context_before = """function isInitialSongGenerationContext(context: string): boolean {
  const clean = String(context || '').trim();
  return clean === 'generateSong'
    || clean === 'generateSongCompactFallback'
    || clean.startsWith('languageMixLockedWholeRewrite')
    || clean.startsWith('generateSong v2');
}"""
    context_after = """function isLanguageMixWholeRewriteContext(context: string): boolean {
  return String(context || '').trim().startsWith('languageMixLockedWholeRewrite');
}

function isInitialSongGenerationContext(context: string): boolean {
  const clean = String(context || '').trim();
  return clean === 'generateSong'
    || clean === 'generateSongCompactFallback'
    || clean.startsWith('generateSong v2');
}"""
    if proxy.count(context_before) != 1:
        raise SystemExit(f'888 context anchor mismatch: {proxy.count(context_before)}')
    proxy = proxy.replace(context_before, context_after, 1)

    cooldown_before = """  const canonical = isInitialSongGenerationContext(context)
    ? [...INITIAL_SONG_MODEL_CHAIN]
    : context === FAST_REPAIR_CONTEXT
      ? [...FAST_REPAIR_MODEL_CHAIN]
      : [];"""
    cooldown_after = """  const canonical = isLanguageMixWholeRewriteContext(context)
    ? [...LANGUAGE_MIX_MODEL_CHAIN]
    : isInitialSongGenerationContext(context)
      ? [...INITIAL_SONG_MODEL_CHAIN]
      : context === FAST_REPAIR_CONTEXT
        ? [...FAST_REPAIR_MODEL_CHAIN]
        : [];"""
    if proxy.count(cooldown_before) != 1:
        raise SystemExit(f'888 cooldown anchor mismatch: {proxy.count(cooldown_before)}')
    proxy = proxy.replace(cooldown_before, cooldown_after, 1)

    resolve_anchor = """  if (context === FAST_REPAIR_CONTEXT) {"""
    resolve_insert = """  if (isLanguageMixWholeRewriteContext(context) && requested.length > 1) {
    const languageMixChain = LANGUAGE_MIX_MODEL_CHAIN.filter((model) => requested.includes(model));
    if (languageMixChain.length) return languageMixChain;
  }

  if (context === FAST_REPAIR_CONTEXT) {"""
    if proxy.count(resolve_anchor) != 1:
        raise SystemExit(f'888 resolve anchor mismatch: {proxy.count(resolve_anchor)}')
    proxy = proxy.replace(resolve_anchor, resolve_insert, 1)

    proxy_path.write_text(proxy, encoding='utf-8')
    print('Applied SORIDRAW 888: initial song stays 3.6-first; language mix restored to 3.7-first chain.')
else:
    print('888 split language-mix route already applied')

admin_path = Path('src/pages/AdminGeminiAuditPage.tsx')
admin = admin_path.read_text(encoding='utf-8')

if ADMIN_MARKER not in admin:
    labels_anchor = """  languageMixWholeLyricRetry: '언어 혼합 재작성',"""
    labels_replacement = """  languageMixWholeLyricRetry: '언어 혼합 재작성',
  languageMixLockedWholeRewrite: '언어 혼합 가사 재작성',
  repairV1FinalProductionCues: '섹션 지시문 보완',"""
    if admin.count(labels_anchor) != 1:
        raise SystemExit(f'888 admin labels anchor mismatch: {admin.count(labels_anchor)}')
    admin = admin.replace(labels_anchor, labels_replacement, 1)

    helper_anchor = """};

function numberText(value: number): string {"""
    helper_replacement = """};

const SORIDRAW_888_ADMIN_CONTEXT_LABELS = true;

function contextLabel(context: string): string {
  const clean = String(context || '').trim();
  if (clean.startsWith('languageMixLockedWholeRewrite')) return '언어 혼합 가사 재작성';
  return CONTEXT_LABELS[clean] || clean || 'Gemini 호출';
}

function numberText(value: number): string {"""
    if admin.count(helper_anchor) != 1:
        raise SystemExit(f'888 admin helper anchor mismatch: {admin.count(helper_anchor)}')
    admin = admin.replace(helper_anchor, helper_replacement, 1)

    skip_before = """{CONTEXT_LABELS[skip.context] || skip.context}"""
    call_before = """{CONTEXT_LABELS[call.context] || call.context}"""
    if admin.count(skip_before) != 1:
        raise SystemExit(f'888 admin skip label anchor mismatch: {admin.count(skip_before)}')
    if admin.count(call_before) != 1:
        raise SystemExit(f'888 admin call label anchor mismatch: {admin.count(call_before)}')
    admin = admin.replace(skip_before, "{contextLabel(skip.context)}", 1)
    admin = admin.replace(call_before, "{contextLabel(call.context)}", 1)

    admin_path.write_text(admin, encoding='utf-8')
    print('Applied SORIDRAW 888: admin Gemini audit internal context labels shown in Korean.')
else:
    print('888 admin context labels already applied')

# 889 stays a separate, additive patch but is chained here so existing dev/lint/build hooks apply it.
apply_889 = Path('.deploy/apply-889-gemini-key-identity.py')
if apply_889.exists():
    exec(compile(apply_889.read_text(encoding='utf-8'), str(apply_889), 'exec'), {'__name__': '__main__'})

# 890 simplifies the visible Gemini key UI after the 889 metadata patch is applied.
apply_890 = Path('.deploy/apply-890-gemini-key-simple-ui.py')
if apply_890.exists():
    exec(compile(apply_890.read_text(encoding='utf-8'), str(apply_890), 'exec'), {'__name__': '__main__'})
