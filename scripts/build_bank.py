#!/usr/bin/env python3
"""将 out/ 下各题 JSON 合并为 docs/data/bank.json，供静态复习站读取。

若存在 out/<id>/image.jpg，会复制到 docs/images/<id>.jpg，并把写入 bank.json 的
image_url 改为相对路径 images/<id>.jpg（GitHub Pages 只发布 docs/，无法直接访问 out/）。
无本地图片时保留 JSON 里原有的外链 image_url。
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    out_dir = root / "out"
    dest = root / "docs" / "data" / "bank.json"
    images_dest = root / "docs" / "images"
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

    images_dest.mkdir(parents=True, exist_ok=True)
    for old in images_dest.glob("*.jpg"):
        old.unlink()

    copied = 0
    for item in items:
        qid = int(item["id"])
        src = out_dir / str(qid) / "image.jpg"
        if src.is_file():
            shutil.copy2(src, images_dest / f"{qid}.jpg")
            item["image_url"] = f"images/{qid}.jpg"
            copied += 1

    items.sort(key=lambda x: (str(x.get("difficulty", "")), int(x["id"])))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    print(f"已写入 {len(items)} 条 → {dest}（本地图 {copied} 张 → {images_dest}）")


if __name__ == "__main__":
    main()
