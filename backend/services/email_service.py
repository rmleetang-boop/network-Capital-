"""Centralized Brevo (Sendinblue) transactional email service.

All outgoing email in Network Capital flows through this module.

Design constraints:
    * Email failures NEVER crash the request — every public function logs and
      returns False on failure.
    * Sender identity is fixed: "Network Capital <noreply@networkcapitalapp.co.za>".
    * The Brevo Python SDK is synchronous; we wrap calls in ``asyncio.to_thread``
      so FastAPI route handlers remain async-safe.
    * Configuration is environment-driven via ``BREVO_API_KEY``.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Optional

import brevo_python
from brevo_python.rest import ApiException

logger = logging.getLogger(__name__)

# ---- Sender identity (fixed per product requirement) ---------------------
SENDER_NAME = "Network Capital"
SENDER_EMAIL = "noreply@networkcapitalapp.co.za"

_BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")

# Lazy-singleton client. Re-built once at import time when the key is present.
_client: Optional[brevo_python.TransactionalEmailsApi] = None


def _get_client() -> Optional[brevo_python.TransactionalEmailsApi]:
    """Return a configured Brevo TransactionalEmailsApi client, or None if no key."""
    global _client
    if not _BREVO_API_KEY:
        return None
    if _client is not None:
        return _client
    cfg = brevo_python.Configuration()
    cfg.api_key["api-key"] = _BREVO_API_KEY
    _client = brevo_python.TransactionalEmailsApi(brevo_python.ApiClient(cfg))
    return _client


def _send_sync(
    to_email: str,
    subject: str,
    html_content: str,
    *,
    text_content: Optional[str] = None,
    to_name: Optional[str] = None,
    reply_to: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> Optional[str]:
    """Synchronous send — returns Brevo message_id on success, None on failure."""
    client = _get_client()
    if client is None:
        logger.info(f"[MAIL-SKIP] No BREVO_API_KEY configured — to={to_email} subj={subject!r}")
        return None
    if not to_email:
        logger.info(f"[MAIL-SKIP] Empty recipient — subj={subject!r}")
        return None
    try:
        recipient = {"email": to_email}
        if to_name:
            recipient["name"] = to_name
        send = brevo_python.SendSmtpEmail(
            sender={"name": SENDER_NAME, "email": SENDER_EMAIL},
            to=[recipient],
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            reply_to={"email": reply_to} if reply_to else None,
            tags=tags or [],
        )
        result = client.send_transac_email(send)
        message_id = getattr(result, "message_id", None) or getattr(result, "messageId", None)
        logger.info(f"[MAIL-SENT] to={to_email} id={message_id} subj={subject!r}")
        return message_id
    except ApiException as exc:
        logger.warning(
            f"[MAIL-FAIL] Brevo ApiException to={to_email} status={exc.status} "
            f"reason={exc.reason} body={(exc.body or '')[:200]!r}"
        )
        return None
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[MAIL-FAIL] Unexpected error to={to_email} err={exc}")
        return None


async def send_transactional_email(
    to_email: str,
    subject: str,
    html_content: str,
    *,
    text_content: Optional[str] = None,
    to_name: Optional[str] = None,
    reply_to: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> bool:
    """Send a transactional email via Brevo, async-safe. Never raises."""
    message_id = await asyncio.to_thread(
        _send_sync,
        to_email,
        subject,
        html_content,
        text_content=text_content,
        to_name=to_name,
        reply_to=reply_to,
        tags=tags,
    )
    return message_id is not None


def is_configured() -> bool:
    """True when BREVO_API_KEY is set — used by callers to decide fallback paths."""
    return bool(_BREVO_API_KEY)


# ─────────────────────────────────────────────────────────────────────────────
# Iter 58d — Monthly payout overview email (1st of every month 00:00 SAST)
# ─────────────────────────────────────────────────────────────────────────────
async def send_monthly_payout_overview(
    *,
    to_email: str,
    first_name: str,
    wallet_balance: float,
    currency: str,
    payout_message: str,
    promotions: list[dict],
    month_label: str,
) -> bool:
    """Single-purpose monthly email. Does NOT change any other email logic.

    `payout_message` must be the canonical sentence from `_current_payout_message()`.
    `promotions` is a list of dicts each carrying at minimum `title` and `ends_iso`
    (ISO-8601). Empty list is fine.
    """
    safe_name = (first_name or "there").strip()[:60]
    balance_pretty = f"{currency} {wallet_balance:,.2f}"
    if promotions:
        promo_html = "".join(
            f'<li style="margin:6px 0;color:#0f172a;">{(p.get("title") or "Promotion")[:120]}'
            f' — ends {(p.get("ends_label") or p.get("ends_iso") or "soon")[:60]}</li>'
            for p in promotions
        )
        promo_section_html = (
            '<p style="margin:18px 0 6px;color:#0f172a;font-weight:600;">Promotions still running:</p>'
            f'<ul style="padding-left:18px;margin:0 0 14px;">{promo_html}</ul>'
        )
        promo_text_lines = "\n".join(
            f"- {(p.get('title') or 'Promotion')[:120]} — ends {(p.get('ends_label') or p.get('ends_iso') or 'soon')[:60]}"
            for p in promotions
        )
        promo_section_text = f"\n\nPromotions still running:\n{promo_text_lines}"
    else:
        promo_section_html = ""
        promo_section_text = ""

    subject = f"Network Capital · {month_label} payout schedule"
    html = f"""<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f7fb;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;">
    <p style="margin:0 0 6px;color:#0f172a;font-size:15px;">Hi {safe_name},</p>
    <p style="margin:14px 0;color:#0f172a;font-size:14px;">Your wallet balance: <strong>{balance_pretty}</strong>.</p>
    <p style="margin:14px 0;color:#0f172a;font-size:14px;">{payout_message}</p>
    {promo_section_html}
    <p style="margin:18px 0 0;color:#475569;font-size:12px;">— Network Capital</p>
  </div>
</body></html>"""
    text = (
        f"Hi {safe_name},\n\n"
        f"Your wallet balance: {balance_pretty}.\n\n"
        f"{payout_message}"
        f"{promo_section_text}\n\n"
        f"— Network Capital"
    )
    return await send_transactional_email(
        to_email=to_email,
        to_name=safe_name,
        subject=subject,
        html_content=html,
        text_content=text,
        tags=["monthly-payout-overview"],
    )

