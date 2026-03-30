#!/usr/bin/env python3
"""
从 daniuduolingo.com 题库 API 批量下载「看图说话」等题目的范文与配图。

用法示例:
  python scrape_daniuduolingo.py --key a --difficulty 2 --page 3 --page-size 20
  python scrape_daniuduolingo.py --id 19750 --out ./out

说明: 图片 URL 由题目返回的 md5 按前端规则拼出（CDN 上为 jpg）。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests

BASE = "https://daniuduolingo.com"
API = f"{BASE}/weapp/api"
CDN = "https://cdn.daniuduolingo.com"


def get_token(session: requests.Session) -> str:
    r = session.get(f"{API}/common/noLogInUserToken", timeout=30)
    r.raise_for_status()
    text = r.text.strip()
    if text.startswith("{") or text.startswith("["):
        data = r.json()
        if isinstance(data, dict) and "data" in data:
            return str(data["data"])
        if isinstance(data, dict) and "token" in data:
            return str(data["token"])
    # 接口直接返回 JWT 字符串
    return text


def image_url_from_md5(md5_hex: str) -> str:
    """与站点前端一致的 jpg 路径: /store/files/{md5[3:6]}/{md5}.jpg"""
    o = md5_hex.lower()
    if len(o) != 32 or not re.fullmatch(r"[0-9a-f]{32}", o):
        raise ValueError(f"invalid md5: {md5_hex!r}")
    part = o[3:6]
    return f"{CDN}/store/files/{part}/{o}.jpg"


def fetch_question(session: requests.Session, qid: int) -> dict[str, Any]:
    r = session.get(f"{API}/question", params={"id": qid}, timeout=60)
    r.raise_for_status()
    return r.json()


def fetch_questions_page(
    session: requests.Session,
    *,
    key: str,
    difficulty: str | None,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    params: dict[str, Any] = {"key": key, "page": page, "pageSize": page_size}
    if difficulty is not None and difficulty != "":
        params["difficulty"] = difficulty
    r = session.get(f"{API}/questions", params=params, timeout=60)
    r.raise_for_status()
    return r.json()


def download_file(session: requests.Session, url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    r = session.get(url, timeout=120)
    r.raise_for_status()
    dest.write_bytes(r.content)


def save_record(out_dir: Path, qid: int, detail: dict[str, Any], image_url: str | None) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    rec = {
        "id": detail.get("id"),
        "key": detail.get("key"),
        "difficulty": detail.get("difficulty"),
        "md5": detail.get("md5"),
        "answer": detail.get("answer"),
        "title": detail.get("title"),
        "extData": detail.get("extData"),
        "openTime": detail.get("openTime"),
        "image_url": image_url,
    }
    path = out_dir / f"{qid}.json"
    path.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")


def process_one(
    session: requests.Session,
    qid: int,
    out_dir: Path,
    download_image: bool,
) -> None:
    detail = fetch_question(session, qid)
    md5 = detail.get("md5") or ""
    image_url = None
    try:
        image_url = image_url_from_md5(md5)
    except ValueError:
        pass

    sub = out_dir / str(qid)
    save_record(sub, qid, detail, image_url)

    if download_image and image_url:
        ext = ".jpg"
        download_file(session, image_url, sub / f"image{ext}")

    print(f"ok id={qid} image={'yes' if image_url else 'no'}")


def main() -> None:
    p = argparse.ArgumentParser(description="下载大牛多邻国题库范文与图片")
    p.add_argument("--key", default="a", help="题型 key，与网页 URL 一致，如 a")
    p.add_argument("--difficulty", default="2", help="难度，空字符串表示全部")
    p.add_argument("--page", type=int, default=1)
    p.add_argument("--page-size", type=int, default=20)
    p.add_argument("--id", type=int, help="只抓单题 id")
    p.add_argument("--out", type=Path, default=Path("./daniuduolingo_out"))
    p.add_argument("--no-image", action="store_true", help="只保存 JSON，不下载图片")
    p.add_argument("--sleep", type=float, default=0.4, help="每题间隔秒数，略降请求频率")
    p.add_argument(
        "--no-proxy",
        action="store_true",
        help="忽略 HTTP(S)_PROXY 环境变量（本机代理异常时可试）",
    )
    args = p.parse_args()

    session = requests.Session()
    session.trust_env = not args.no_proxy
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (compatible; study-scraper/1.0)",
            "Accept": "application/json",
        }
    )

    token = get_token(session)
    session.headers["Authorization"] = f"Bearer {token}"

    out_dir: Path = args.out
    out_dir.mkdir(parents=True, exist_ok=True)

    ids: list[int]
    if args.id is not None:
        ids = [args.id]
    else:
        diff = args.difficulty if args.difficulty != "" else None
        # API 的 page 从 1 开始；与网页 page=3 一致时用 --page 3
        raw = fetch_questions_page(
            session,
            key=args.key,
            difficulty=diff,
            page=args.page,
            page_size=args.page_size,
        )
        rows = raw.get("data") or raw.get("list") or []
        ids = [int(x["id"]) for x in rows if "id" in x]
        if not ids:
            print("未获取到题目 id 列表，响应:", json.dumps(raw, ensure_ascii=False)[:500], file=sys.stderr)
            sys.exit(1)

    for qid in ids:
        try:
            process_one(session, qid, out_dir, download_image=not args.no_image)
        except requests.HTTPError as e:
            print(f"HTTP error id={qid}: {e}", file=sys.stderr)
        if args.sleep > 0:
            time.sleep(args.sleep)

    print(f"完成，输出目录: {out_dir.resolve()}")


if __name__ == "__main__":
    main()
