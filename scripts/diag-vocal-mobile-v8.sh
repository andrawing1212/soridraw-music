#!/usr/bin/env bash
set -euo pipefail

echo '=== VOCAL UI LABELS / MEMBERS ==='
grep -R -n -C 6 -E '남성 멤버|여성 멤버|멤버 추가|보컬A|보컬B|group.*member|vocal.*member|members\.map|vocalMembers' src/App.tsx src/components src/pages 2>/dev/null || true

echo '=== VOCAL GRID / CLASS NAMES ==='
grep -R -n -C 5 -E 'grid-cols-2|grid-template-columns|vocal.*group|group.*vocal|vocal.*card|member.*card|soridraw.*vocal' src/App.tsx src/components/studio src/components 2>/dev/null | head -n 700 || true

echo '=== VOCAL CSS ==='
grep -n -C 6 -E 'vocal|member|멤버' src/components/studio/studioLayout.css src/index.css 2>/dev/null | head -n 900 || true
