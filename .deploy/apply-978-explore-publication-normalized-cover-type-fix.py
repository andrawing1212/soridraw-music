from pathlib import Path

path = Path('src/pages/FavoritesPage.tsx')
text = path.read_text(encoding='utf-8')

old = "String(connectedLink?.coverUrl || connectedLink?.imageUrl || '').trim()"
new = "String(connectedLink?.coverUrl || '').trim()"

# FavoriteSunoLink normalization already folds incoming imageUrl/thumbnailUrl into
# coverUrl. The 902 publication gate must therefore read the normalized field only.
# This is type-only compatibility: persisted data and runtime behavior are unchanged.
if old in text:
    if text.count(old) != 1:
        raise RuntimeError(f'apply-978: Explore cover metadata anchor ambiguous: {text.count(old)}')
    text = text.replace(old, new, 1)
elif new not in text:
    raise RuntimeError('apply-978: Explore cover metadata anchor missing')

if "typeof link?.imageUrl === 'string'" not in text or "const coverUrl = typeof link?.coverUrl === 'string'" not in text:
    raise RuntimeError('apply-978: FavoriteSunoLink imageUrl -> coverUrl normalization contract missing')
if old in text:
    raise RuntimeError('apply-978: legacy normalized-link imageUrl reference still present')

path.write_text(text, encoding='utf-8')
print('apply-978: Explore publication gate uses normalized FavoriteSunoLink.coverUrl; runtime/data behavior unchanged')
