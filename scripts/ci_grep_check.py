#!/usr/bin/env python3
"""CI check: Ensure zero forbidden niche-specific terms appear in engine/ and dashboard/src/."""
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
terms_file = root / "engine" / "forbidden_terms.txt"

if not terms_file.exists():
    print(f"ERROR: Terms file not found at {terms_file}", file=sys.stderr)
    sys.exit(1)

forbidden = [
    line.strip().lower()
    for line in terms_file.read_text(encoding="utf-8").splitlines()
    if line.strip() and not line.startswith("#")
]

matches = []

# 1. Check engine/*.py
engine_dir = root / "engine"
for p in engine_dir.rglob("*.py"):
    text = p.read_text(encoding="utf-8", errors="ignore").lower()
    for word in forbidden:
        pattern = rf"\b{re.escape(word)}\b"
        if re.search(pattern, text):
            matches.append(f"{p.relative_to(root)}: '{word}'")

# 2. Check dashboard/src/ if present
dash_src = root / "dashboard" / "src"
if dash_src.exists():
    for p in dash_src.rglob("*"):
        if p.is_file() and p.suffix in (".js", ".jsx", ".ts", ".tsx", ".css", ".html"):
            text = p.read_text(encoding="utf-8", errors="ignore").lower()
            for word in forbidden:
                pattern = rf"\b{re.escape(word)}\b"
                if re.search(pattern, text):
                    matches.append(f"{p.relative_to(root)}: '{word}'")

if matches:
    print("[FAIL] CI Grep Check FAILED! Forbidden niche terms found in universal core:", file=sys.stderr)
    for m in matches:
        print(f"  - {m}", file=sys.stderr)
    sys.exit(1)

print(f"[PASS] CI Grep Check PASSED: 0 forbidden terms found in engine/ and dashboard/src/ (checked {len(forbidden)} terms across codebase).")
