#!/usr/bin/env bash
set -euo pipefail

echo '=== APP HOST SOURCE ==='
sed -n '130,285p' src/App.tsx

echo '=== APP HOST INVOCATION ==='
grep -n -C 18 '<StudioDescriptionOverlayHost' src/App.tsx || true

echo '=== TITLE HOVER HANDLERS ==='
grep -n -E 'onMouseEnter=.*setShow.*TitleTooltip|onMouseLeave=.*setShow.*TitleTooltip' src/App.tsx src/components/GenreHierarchySelector.tsx || true

echo '=== MYPAGE PERSONAL SETTINGS ==='
sed -n '632,670p' src/pages/MyPage.tsx
