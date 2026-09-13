from pathlib import Path

# Compatibility bridge for the 074 display-count replay type used by the 075 release verifier.
path = Path('scripts/verify-explore-like-cost-optimization.mjs')
text = path.read_text(encoding='utf-8')
old = "assert.match(flushFunction, /const accountSyncResults: ExploreLikeBatchResult\\[\\] = \\[\\]/);"
new = "assert.match(flushFunction, /const accountSyncResults: (?:ExploreLikeBatchResult\\[\\]|Array<ExploreLikeBatchResult & \\{ displayLikeCount\\?: number \\}>) = \\[\\]/);"
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise RuntimeError('075 verifier compatibility anchor missing')
path.write_text(text, encoding='utf-8')
print('075 existing like verifier compatibility patched.')
