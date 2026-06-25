"""Iter 58 — One-off backfill: migrate base64 image blobs to Cloudinary.

Scans:
  - posts.image       (single-image posts)
  - posts.image_data_url (legacy iter55 base64 fallback — promoted then unset)
  - posts.slides[].image and posts.slides[].image_data_url
  - users.photo       (profile avatar)

For every document whose image field is a `data:image/...;base64,...` URL, this
script uploads the bytes to Cloudinary (folders: `posts/`, `profile/`) and
rewrites the field to the returned secure URL. The legacy `image_data_url`
fallback is removed once the main `image` is a URL.

Idempotent — re-running is safe (URL fields are left alone).

Run:
    cd /app/backend
    python -m scripts.migrate_images_to_cloudinary

Set DRY_RUN=1 to preview without writing.
"""

from __future__ import annotations

import asyncio
import base64
import os
import re
import sys
import logging
from typing import Optional

# Make sibling imports work when run with `python -m scripts.migrate_images_to_cloudinary`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from services import cloudinary_service  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("migrate_images")

DRY_RUN = os.environ.get("DRY_RUN") == "1"
DATA_URL_RE = re.compile(r"data:([^;]+);base64,(.+)", re.DOTALL)


async def _upload(blob: str, folder: str) -> Optional[str]:
    """Decode a data: URL and upload to Cloudinary. Returns secure URL or None."""
    m = DATA_URL_RE.match(blob)
    if not m:
        return None
    try:
        mime, payload = m.group(1), m.group(2)
        raw = base64.b64decode(payload)
        ext = (mime.split("/")[-1] or "bin").lower()
        kind = "video" if mime.startswith("video/") else "image"
        if DRY_RUN:
            log.info(f"[DRY] would upload {len(raw)} bytes to {folder}/ ({kind})")
            return f"https://res.cloudinary.com/DRY/upload/{folder}/dryrun.{ext}"
        res = await cloudinary_service.upload_bytes(
            raw, folder=folder, filename=f"backfill.{ext}", resource_type=kind,
        )
        return (res or {}).get("url")
    except Exception as exc:  # noqa: BLE001
        log.warning(f"upload failed in folder={folder}: {exc}")
        return None


async def migrate_users(db) -> int:
    migrated = 0
    cursor = db.users.find(
        {"photo": {"$regex": r"^data:image"}},
        {"_id": 0, "id": 1, "photo": 1, "username": 1},
        no_cursor_timeout=False,
    )
    async for u in cursor:
        url = await _upload(u["photo"], "profile")
        if not url:
            # Couldn't decode/upload — most likely corrupt base64 padding. Clear
            # the field so the regex stops matching it on future runs (idempotency).
            if not DRY_RUN:
                await db.users.update_one({"id": u["id"]}, {"$set": {"photo": ""}})
            log.info(f"users[{u['id']}] @{u.get('username')} → CLEARED (corrupt base64)")
            continue
        if not DRY_RUN:
            await db.users.update_one({"id": u["id"]}, {"$set": {"photo": url}})
        migrated += 1
        log.info(f"users[{u['id']}] @{u.get('username')} → {url[:60]}…")
    return migrated


async def migrate_posts(db) -> int:
    migrated = 0
    # Single-image posts
    cursor = db.posts.find(
        {"$or": [
            {"image": {"$regex": r"^data:image"}},
            {"image_data_url": {"$regex": r"^data:image"}},
        ]},
        {"_id": 0, "id": 1, "image": 1, "image_data_url": 1},
    )
    async for p in cursor:
        new_image = p.get("image") or ""
        if new_image.startswith("data:"):
            uploaded = await _upload(new_image, "posts")
            if uploaded:
                new_image = uploaded
        elif not new_image and (p.get("image_data_url") or "").startswith("data:"):
            uploaded = await _upload(p["image_data_url"], "posts")
            if uploaded:
                new_image = uploaded
        if new_image and new_image.startswith("http"):
            if not DRY_RUN:
                await db.posts.update_one(
                    {"id": p["id"]},
                    {"$set": {"image": new_image}, "$unset": {"image_data_url": ""}},
                )
            migrated += 1
            log.info(f"posts[{p['id']}] → {new_image[:60]}…")

    # Carousel slides
    slide_cursor = db.posts.find(
        {"slides.image": {"$regex": r"^data:image"}},
        {"_id": 0, "id": 1, "slides": 1},
    )
    async for p in slide_cursor:
        slides = p.get("slides") or []
        changed = False
        for s in slides:
            if (s.get("image") or "").startswith("data:"):
                up = await _upload(s["image"], "posts")
                if up:
                    s["image"] = up
                    changed = True
            s.pop("image_data_url", None)
        if changed and not DRY_RUN:
            await db.posts.update_one({"id": p["id"]}, {"$set": {"slides": slides}})
            migrated += 1
            log.info(f"posts[{p['id']}] slides migrated ({len(slides)} slides)")
    return migrated


async def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not (mongo_url and db_name):
        log.error("MONGO_URL and DB_NAME must be set")
        sys.exit(1)
    if not cloudinary_service.is_enabled() and not DRY_RUN:
        log.error("Cloudinary is not configured — set CLOUDINARY_* env vars or run with DRY_RUN=1")
        sys.exit(1)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    log.info(f"DRY_RUN={DRY_RUN}")
    n_users = await migrate_users(db)
    n_posts = await migrate_posts(db)
    log.info(f"DONE — users migrated={n_users}, posts migrated={n_posts}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
