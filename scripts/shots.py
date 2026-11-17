# Generates shots.json from a story.ts file for QA.
import json, os, re, sys

story_path = sys.argv[1] if len(sys.argv) > 1 else "src/videos/paxsilica/story.ts"
out_path = sys.argv[2] if len(sys.argv) > 2 else "out/paxsilica/shots.json"

src = open(story_path, encoding="utf-8").read()
tm = re.search(r"TOTAL\s*=\s*(\d+)", src)
total = int(tm.group(1)) if tm else 1800
shots = [{"id": int(i), "a": int(a), "b": total if b == "TOTAL" else int(b)}
         for i, a, b in re.findall(r"\{\s*id:\s*(\d+),\s*a:\s*(\d+),\s*b:\s*(\w+),", src)]
xm = re.search(r"XFADE:\s*Record<number,\s*number>\s*=\s*\{([^}]+)\}", src)
xf = {int(k): int(v) for k, v in re.findall(r"(\d+):\s*(\d+)", xm.group(1))} if xm else {}
sa = {s["id"]: s["a"] for s in shots}
fm = re.search(r"FLASH_AT\s*=\s*(\d+)", src)
fl = int(fm.group(1)) if fm else 330

meta = {
    "shots": shots,
    "flash": [fl, fl + 4],
    "xfade": [[sa[k] - w // 2, sa[k] + w // 2] for k, w in xf.items() if k in sa],
}
os.makedirs(os.path.dirname(out_path), exist_ok=True)
open(out_path, "w", encoding="utf-8").write(json.dumps(meta, indent=2) + "\n")
print(f"wrote {len(shots)} shots to {out_path}")
