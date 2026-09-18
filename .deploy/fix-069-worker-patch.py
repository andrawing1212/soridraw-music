from pathlib import Path

patch_path = Path('cloudflare/explore-worker/patches/040-explore-like-w1-delayed-count.mjs')
source = patch_path.read_text(encoding='utf-8')
if 'const enqueueReplacement040 =' in source:
    print('040 enqueue composition already fixed')
    raise SystemExit(0)

segment_start = source.index('${legacyEnqueue}\n\nasync function enqueueExploreLikeBatch035')
function_start = segment_start + len('${legacyEnqueue}\n\n')
segment_end = source.index('\n\nasync function hasExploreLikeQueue069040', function_start)
wrapper = source[function_start:segment_end]
source = source[:segment_start] + source[segment_end:]

anchor = "const legacyEnqueue = functionRange('enqueueExploreLikeBatch035').text\n  .replace('async function enqueueExploreLikeBatch035(', 'async function enqueueExploreLikeBatchLegacy040(');\n"
if anchor not in source:
    raise SystemExit('[069] 040 legacy enqueue anchor missing')

insertion = anchor + "\nconst enqueueReplacement040 = `${legacyEnqueue}\\n\\n" + wrapper + "`;\nreplaceFunction('enqueueExploreLikeBatch035', enqueueReplacement040);\n"
source = source.replace(anchor, insertion, 1)
patch_path.write_text(source, encoding='utf-8')
print('040 enqueue composition fixed')
