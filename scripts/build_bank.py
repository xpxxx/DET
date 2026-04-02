#!/usr/bin/env python3
"""将 out/、out_e/、out_c/ 下各题 JSON 合并为 docs/data/bank.json。

同时按题型写入 bank_a.json / bank_e.json / bank_c.json，供前端并行拉取，减轻单次大文件
pending 过久（合并文件仍保留为 bank.json 作回退）。

- out/：看图说话（key=a 等），若存在 out/<id>/image.jpg 则复制到 docs/images/<id>.jpg，
  并写入 image_url 为 images/<id>.jpg（GitHub Pages 只发布 docs/）。
- out_e/：阅读说话（key=e），无配图；extData 含参考翻译、答题模板等。
- out_c/：口语样本（key=c），无配图；字段与阅读说话相同。

至少需存在 out/、out_e/、out_c/ 之一。
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    dest = root / "docs" / "data" / "bank.json"
    images_dest = root / "docs" / "images"

    roots = [root / "out", root / "out_e", root / "out_c"]
    existing = [p for p in roots if p.is_dir()]
    if not existing:
        print("缺少目录: out/、out_e/、out_c/ 至少其一", file=sys.stderr)
        sys.exit(1)

    loaded: list[tuple[dict, Path]] = []
    for out_dir in existing:
        for path in sorted(out_dir.rglob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError) as e:
                print(f"跳过 {path}: {e}", file=sys.stderr)
                continue
            if not isinstance(data, dict) or "id" not in data:
                continue
            loaded.append((data, path.parent))

    loaded.sort(key=lambda x: (str(x[0].get("difficulty", "")), int(x[0]["id"])))
    items = [x[0] for x in loaded]

    images_dest.mkdir(parents=True, exist_ok=True)
    for old in images_dest.glob("*.jpg"):
        old.unlink()

    copied = 0
    for item, qdir in loaded:
        qid = int(item["id"])
        src = qdir / "image.jpg"
        if src.is_file():
            shutil.copy2(src, images_dest / f"{qid}.jpg")
            item["image_url"] = f"images/{qid}.jpg"
            copied += 1

    def norm_key(d: dict) -> str:
        k = str(d.get("key") or "a").lower()
        if k == "e":
            return "e"
        if k == "c":
            return "c"
        return "a"

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")

    for label, fname in (("a", "bank_a.json"), ("e", "bank_e.json"), ("c", "bank_c.json")):
        chunk = [x for x in items if norm_key(x) == label]
        (dest.parent / fname).write_text(json.dumps(chunk, ensure_ascii=False), encoding="utf-8")

    na, ne, nc = (
        sum(1 for x in items if norm_key(x) == "a"),
        sum(1 for x in items if norm_key(x) == "e"),
        sum(1 for x in items if norm_key(x) == "c"),
    )
    print(
        f"已写入 {len(items)} 条 → {dest}（a={na}, e={ne}, c={nc}）· 分卷 bank_a/e/c.json · 本地图 {copied} 张 → {images_dest}"
    )


if __name__ == "__main__":
    main()
