#!/usr/bin/env bash
set -euo pipefail

echo '=== APP TOOLTIP HOST ==='
grep -n -C 18 -E 'StudioDescriptionOverlayHost|setHoveredItem|hoveredItemPlacement|studioDescription' src/App.tsx | head -n 320 || true

echo '=== APP TITLE TOOLTIP SAMPLES ==='
grep -n -C 8 'soridraw-card-title-tooltip' src/App.tsx | head -n 260 || true

echo '=== MYPAGE AUTO MODEL UI ==='
grep -n -C 35 -E 'autoModelFallback|대체 Gemini|기본 Gemini' src/pages/MyPage.tsx | tail -n 320 || true

echo '=== GLOBAL PLAYER LAYERS ==='
grep -n -C 10 -E 'data-soridraw-global-player|z-\[100\]|z-\[99\]|z-\[140\]' src/components/GlobalPlayer.tsx || true
