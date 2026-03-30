#!/usr/bin/env python3
"""将 out/ 下各题 JSON 合并为 docs/data/bank.json，供静态复习站读取。"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    out_dir = root / "out"
    dest = root / "docs" / "data" / "bank.json"
    if not out_dir.is_dir():
        print(f"缺少目录: {out_dir}", file=sys.stderr)
        sys.exit(1)

    items: list[dict] = []
    for path in sorted(out_dir.rglob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"跳过 {path}: {e}", file=sys.stderr)
            continue
        if not isinstance(data, dict) or "id" not in data:
            continue
        items.append(data)

    items.sort(key=lambda x: (str(x.get("difficulty", "")), int(x["id"])))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    print(f"已写入 {len(items)} 条 → {dest}")


if __name__ == "__main__":
    main()
