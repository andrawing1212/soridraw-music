from pathlib import Path

workflow_path = Path('.github/workflows/temp-stage4-recent-musicnote-safety-20260905.yml')
source = workflow_path.read_text(encoding='utf-8')
marker = "          python3 <<'PY'\n"
start = source.find(marker)
if start < 0:
    raise SystemExit('stage4 patch heredoc start not found')
start += len(marker)
end = source.find("\n          PY", start)
if end < 0:
    raise SystemExit('stage4 patch heredoc end not found')
block = source[start:end]
lines = block.splitlines()
dedented = "\n".join(line[10:] if line.startswith("          ") else line for line in lines) + "\n"
compiled = compile(dedented, str(workflow_path) + ':embedded-stage4', 'exec')
exec(compiled, {"__name__": "__main__"})
