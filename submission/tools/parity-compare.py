#!/usr/bin/env python3
# Compares PNG captures pixel by pixel between <ref-dir> and <new-dir>.
# Usage: parity-compare.py <ref-dir> <new-dir> [x,y,w,h;...]  (optional ignore rects applied to every file)
import sys
from pathlib import Path
from PIL import Image, ImageChops

ref_dir, new_dir = Path(sys.argv[1]), Path(sys.argv[2])
ignores = []
if len(sys.argv) > 3:
    for r in sys.argv[3].split(";"):
        if r.strip():
            x, y, w, h = [int(v) for v in r.split(",")]
            ignores.append((x, y, x + w, y + h))

fails = []
print(f"{'capture':<28} {'size ref':<14} {'size new':<14} {'diff px':>10}")
for ref_path in sorted(ref_dir.glob("*.png")):
    new_path = new_dir / ref_path.name
    name = ref_path.name
    if not new_path.exists():
        print(f"{name:<28} MISSING in new dir")
        fails.append(name)
        continue
    a, b = Image.open(ref_path).convert("RGB"), Image.open(new_path).convert("RGB")
    if a.size != b.size:
        print(f"{name:<28} {a.size} vs {b.size}  SIZE MISMATCH")
        fails.append(name)
        continue
    diff = ImageChops.difference(a, b)
    px = diff.load()
    n = 0
    for y in range(a.height):
        for x in range(a.width):
            if any(x >= r[0] and x < r[2] and y >= r[1] and y < r[3] for r in ignores):
                continue
            if px[x, y] != (0, 0, 0):
                n += 1
    status = "OK" if n == 0 else "DIFF"
    print(f"{name:<28} {a.width}x{a.height:<7} {b.width}x{b.height:<7} {n:>10} {status}")
    if n:
        fails.append(name)

sys.exit(1 if fails else 0)
