#!/usr/bin/env bash
set -euo pipefail

echo '=== STUDIO CONTROL Z LAYERS ==='
grep -R -n -C 3 -E 'soridraw-studio-(builder|result)-collapse-toggle|soridraw-studio-action-(bar|collapsed)|soridraw-lite-studio-splitter' src/components/studio src/App.tsx | grep -E '(^|-)z-index:|z-\[|collapse-toggle|action-bar|action-collapsed|splitter' | head -n 500 || true

echo '=== HIGH APP MODAL Z LAYERS ==='
grep -n -E 'z-\[(2[0-9]{2}|[3-9][0-9]{2}|[1-9][0-9]{3,})\]' src/App.tsx src/components/GlobalPlayer.tsx | head -n 120 || true
