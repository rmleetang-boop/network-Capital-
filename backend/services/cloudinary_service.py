"""Iter 56f — Cloudinary upload service.

All user-uploaded media (images / videos / raw documents) is pushed to Cloudinary
so it survives Kubernetes pod redeploys (which wipe local disk).

Configuration is via environment variables; if they're missing, the helpers gracefully
fall back to ``None`` and callers should keep their existing local-disk write path
as the secondary route. Once the env vars are set, all new uploads go to Cloudinary.

Folder layout:
    posts/         feed images + videos
    products/      product hero images
    announcements/ admin announcement banners
    files/         downloadable raw files (PDF / EPUB / ZIP / DOC / PPT / XLS / TXT / MD / CSV)
    stories/       24-hour stories
    profile/       avatars + cover photos

Delivery URLs include ``f_auto,q_auto`` (automatic format + quality optimisation)
for images/videos. Raw files keep their original URL.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_CONFIGURED = False
_CLOUD_NAME: Optional[str] = None


def _configure_once() -> bool:
    """Lazy-initialise the global cloudinary config. Returns True if usable."""
    global _CONFIGURED, _CLOUD_NAME
    if _CONFIGURED:
        return bool(_CLOUD_NAME)
    cloud = os.environ.get("CLOUDINARY_CLOUD_NAME") or ""
    api_key = os.environ.get("CLOUDINARY_API_KEY") or ""
    api_secret = os.environ.get("CLOUDINARY_API_SECRET") or ""
    if not (cloud and api_key and api_secret):
        _CONFIGURED = True
        _CLOUD_NAME = None
        return False
    try:
        import cloudinary  # noqa: WPS433  — late import keeps cold-start fast
        cloudinary.config(
            cloud_name=cloud, api_key=api_key, api_secret=api_secret, secure=True,
        )
        _CLOUD_NAME = cloud
        _CONFIGURED = True
        return True
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[CLOUDINARY] config failed: {exc}")
        _CONFIGURED = True
        _CLOUD_NAME = None
        return False


def is_enabled() -> bool:
    return _configure_once()


def _safe_public_id(filename: str) -> str:
    """Generate a unique, URL-safe public_id from the original filename."""
    base = (filename or "asset").rsplit("/", 1)[-1].rsplit(".", 1)[0]
    base = re.sub(r"[^A-Za-z0-9_-]+", "_", base)[:48].strip("_") or "asset"
    return f"{base}_{uuid.uuid4().hex[:10]}"


def _optimized_url(url: str, *, resource_type: str) -> str:
    """Inject ``f_auto,q_auto`` into a Cloudinary URL.

    Cloudinary URLs look like:
      https://res.cloudinary.com/<cloud>/<resource_type>/upload/<public_id>.<ext>
    We insert the transformation between ``/upload/`` and the public_id segment.
    Raw resources don't support these transformations and are returned unchanged.
    """
    if not url or resource_type == "raw":
        return url
    return url.replace("/upload/", "/upload/f_auto,q_auto/", 1)


async def upload_bytes(
    raw: bytes,
    *,
    folder: str,
    filename: str,
    resource_type: str = "image",   # "image" | "video" | "raw"
) -> Optional[Dict[str, Any]]:
    """Upload an in-memory bytestring to Cloudinary.

    Returns ``None`` if Cloudinary is not configured (caller falls back to disk).
    Returns ``{url, public_id, bytes, format, duration, resource_type}`` on success.
    """
    if not _configure_once():
        return None
    try:
        import cloudinary.uploader  # noqa: WPS433
        public_id = _safe_public_id(filename)
        loop = asyncio.get_running_loop()
        def _do_upload():
            return cloudinary.uploader.upload(
                raw,
                public_id=public_id,
                folder=folder,
                resource_type=resource_type,
                overwrite=False,
                use_filename=False,
                unique_filename=True,
                # Keep the originals — we'll request optimized versions via the delivery URL.
                # If the asset is a video, this still works (Cloudinary auto-transcodes).
            )
        result: Dict[str, Any] = await loop.run_in_executor(None, _do_upload)
        secure_url = result.get("secure_url") or result.get("url") or ""
        opt_url = _optimized_url(secure_url, resource_type=resource_type)
        return {
            "url": opt_url,
            "public_id": result.get("public_id"),
            "bytes": int(result.get("bytes") or 0),
            "format": result.get("format"),
            "duration": result.get("duration"),
            "resource_type": resource_type,
            "secure_url_raw": secure_url,
        }
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[CLOUDINARY-UPLOAD] failed folder={folder} kind={resource_type} err={exc}")
        return None


async def destroy(public_id: str, *, resource_type: str = "image") -> bool:
    """Delete an asset by public_id (used by admin moderation flows)."""
    if not _configure_once() or not public_id:
        return False
    try:
        import cloudinary.uploader  # noqa: WPS433
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True),
        )
        return result.get("result") == "ok"
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[CLOUDINARY-DESTROY] failed pid={public_id} err={exc}")
        return False
