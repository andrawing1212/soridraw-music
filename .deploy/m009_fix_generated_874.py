from pathlib import Path

p = Path('.deploy/apply-874-build-safety.py')
s = p.read_text(encoding='utf-8')
count = s.count("''''\n")
if count != 2:
    raise SystemExit(f'M009 generated 874 quote repair mismatch: {count}')
s = s.replace("''''\n", "'''\n")
p.write_text(s, encoding='utf-8')
print('M009_GENERATED_874_QUOTE_REPAIR=2')
