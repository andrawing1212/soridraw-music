#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "package.json"
REPORT = ROOT / "DOCS" / "STAGE1_FREEZE_REPORT.md"


def git_lines(*args: str) -> list[str]:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, check=True, text=True, capture_output=True
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


# Capture what the legacy prebuild chain actually changed before removing it.
legacy_changed = git_lines("diff", "--name-only")
source_changed = [p for p in legacy_changed if p.startswith("src/")]
other_changed = [p for p in legacy_changed if not p.startswith("src/")]

package = json.loads(PACKAGE.read_text(encoding="utf-8"))
scripts = package.setdefault("scripts", {})
removed = {}
for key in ("predev", "prebuild", "prelint"):
    if key in scripts:
        removed[key] = scripts.pop(key)

# Keep ordinary commands deterministic and non-mutating.
scripts["lint"] = "tsc --noEmit"
scripts["build"] = "vite build"

PACKAGE.write_text(
    json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(
    "# Stage 1 Build Patch Freeze Report\n\n"
    "## 목적\n"
    "기존 `predev / prebuild / prelint`에서 Python이 `src/**`를 수정하던 체인을 딱 1회 실행해 최종 결과를 실제 소스에 고정하고, 이후 빌드가 소스를 변경하지 않도록 한다.\n\n"
    "## Legacy chain 1회 실행 결과\n"
    f"- 변경된 `src/**` 파일 수: **{len(source_changed)}**\n"
    f"- 기타 변경 파일 수: **{len(other_changed)}**\n"
    "- 제거한 자동 소스변형 스크립트: `predev`, `prebuild`, `prelint`\n\n"
    "### Legacy chain이 실제로 변경한 src 파일\n"
    + ("\n".join(f"- `{p}`" for p in source_changed) if source_changed else "- 없음 (현재 커밋 소스가 이미 legacy 결과와 동일)")
    + "\n\n### 기타 변경 파일\n"
    + ("\n".join(f"- `{p}`" for p in other_changed) if other_changed else "- 없음")
    + "\n\n## 검증 기준\n"
    "1. `npx tsc --noEmit` 통과\n"
    "2. 자동 소스변형이 제거된 상태에서 `npm run build` 통과\n"
    "3. `npm run build`를 연속 두 번 실행해도 `src/**`와 `package.json` diff가 동일\n"
    "4. 검증 성공 전에는 `preview`에 합치지 않음\n",
    encoding="utf-8",
)

print(f"Removed lifecycle mutators: {', '.join(removed) if removed else 'none'}")
print(f"Legacy src changes frozen: {len(source_changed)}")
for path in source_changed:
    print(f"  - {path}")
