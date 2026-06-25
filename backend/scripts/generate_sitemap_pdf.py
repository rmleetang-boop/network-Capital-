"""Iter 58 — Generate the Network Capital feature site-map PDF.

Renders a hierarchical (tree-style) PDF visually inspired by the user-provided
"home → categories → sub-features" diagram, but in landscape and styled with
the Network Capital brand palette (navy + gold).

Outputs to /app/frontend/public/Network-Capital-Sitemap.pdf so it's downloadable
as a static asset at /Network-Capital-Sitemap.pdf.

Run:  python /app/backend/scripts/generate_sitemap_pdf.py
"""
from __future__ import annotations
from reportlab.lib.pagesizes import landscape, A3
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.units import mm

# ── Network Capital site map: 7 categories ↳ features ↳ user benefit ──
SITEMAP = {
    "Core Experience": {
        "color": "#1e4fa5",
        "items": [
            ("Home Feed",      "Discover posts, reels & stories from your network in one scroll."),
            ("Explore",        "Surface trending people and topics across all 54 regions."),
            ("Hashtags",       "Jump into any topic — follow tags that match your interests."),
            ("Profile",        "Your editable identity card · network score · achievements."),
            ("Notifications",  "Never miss reactions, mentions or score events."),
            ("Direct Messages","Encrypted chat with media & stokvel hand-offs."),
        ],
    },
    "Score & Rewards": {
        "color": "#E8A817",
        "items": [
            ("Network Score",   "Uncapped score — every meaningful engagement adds up."),
            ("Score Tracker",   "Itemised score history so you know what worked."),
            ("Leaderboards",    "See your global + regional rank in real time."),
            ("Activities",      "All score-earning actions in one place with daily caps."),
            ("Net Worth",       "Your network capital across every relationship lane."),
            ("Wallet",          "Multi-currency balance and quick withdrawals."),
        ],
    },
    "Commerce & Creator": {
        "color": "#10b981",
        "items": [
            ("My Store",        "Launch a free storefront in under 60 seconds."),
            ("Quick Sell",      "Publish a product or service in 4 lean steps — or one screen."),
            ("Digital Products","Sell e-books, files & PDFs — Gumroad-style auto-delivery."),
            ("Marketplace",     "Browse every product across the platform."),
            ("Follow Stores",   "Get notified when sellers you love drop new items."),
            ("Audience Insights","See who's looking, sharing & buying."),
        ],
    },
    "Community": {
        "color": "#8b5cf6",
        "items": [
            ("My Network",     "Three lanes: social, professional, financial — your full circle."),
            ("Stokvels",       "Group savings circles with shared backing pools."),
            ("Places",         "Trust-based reviews of local businesses in 54 countries."),
            ("Jobs",           "Apply to roles — every application is admin-moderated."),
            ("Regional Hubs",  "African community hubs at country + city level."),
            ("Activities Hub", "Find local events, meet-ups and community moments."),
        ],
    },
    "Ambassador & Promotions": {
        "color": "#ec4899",
        "items": [
            ("Become Ambassador",     "Apply for R8,500 ZAR allocation + tiered withdrawals."),
            ("Command Center",        "KPI cockpit + AI insights for ambassadors."),
            ("Network Graph",         "Visualise the reach of your invites in real time."),
            ("Active Promotions",     "Time-windowed SAST campaigns to share & earn."),
            ("Referral Programme",    "Earn R10 per 100 conversion points."),
            ("Ambassador Leaderboard","Climb the global ambassador rankings."),
        ],
    },
    "Premium & Insights": {
        "color": "#06b6d4",
        "items": [
            ("Stokvel+ Premium",  "Unlock multi-currency + larger backing pools."),
            ("Audience Insights", "Per-product analytics dashboard."),
            ("Score Boosts",      "Earn faster with milestone multipliers."),
            ("Priority Support",  "Skip the queue — direct line to the team."),
        ],
    },
    "Settings & Help": {
        "color": "#64748b",
        "items": [
            ("Settings",        "Currency, privacy, deactivation — all your controls."),
            ("Help & FAQ",      "Quick-fire answers + how-to guides."),
            ("Legal",           "T&Cs, privacy, community standards — always available."),
            ("Account Security","Password reset, account lock, 2-factor controls."),
        ],
    },
}

OUTPUT = "/app/frontend/public/Network-Capital-Sitemap.pdf"

# ── Layout constants ─────────────────────────────────────────────
PAGE = landscape(A3)                # 16.5" × 11.7"
W, H = PAGE
MARGIN = 14 * mm

NAVY = HexColor("#04101e")
NAVY_SOFT = HexColor("#0a1f3a")
GOLD = HexColor("#E8A817")
WHITE_SOFT = HexColor("#f5f7fb")
GREY = HexColor("#cbd5e1")
TEXT = HexColor("#0f172a")


def draw_header(c):
    # Brand bar
    c.setFillColor(NAVY)
    c.rect(0, H - 22 * mm, W, 22 * mm, stroke=0, fill=1)

    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 28)
    c.drawString(MARGIN, H - 14 * mm, "Network Capital")
    c.setFillColor(white)
    c.setFont("Helvetica", 12)
    c.drawString(MARGIN, H - 19 * mm, "Feature site map — what every section gives you")

    # Right side meta
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 9)
    c.drawRightString(W - MARGIN, H - 14 * mm, "EVERY SURFACE, ONE PAGE")
    c.setFillColor(WHITE_SOFT)
    c.setFont("Helvetica", 8)
    c.drawRightString(W - MARGIN, H - 19 * mm, "v2026.02 · networkcapitalapp.co.za")


def draw_root_node(c, cx, cy):
    """Central HOME node + label."""
    r = 14 * mm
    c.setFillColor(NAVY)
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.5)
    c.circle(cx, cy, r, stroke=1, fill=1)
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(cx, cy + 1, "HOME")
    c.setFillColor(white)
    c.setFont("Helvetica", 8)
    c.drawCentredString(cx, cy - 7, "Network")
    c.drawCentredString(cx, cy - 14, "Capital")


def draw_category(c, x, y, w, h, label, color, items):
    """Draws a category card with its sub-features + benefit lines."""
    accent = HexColor(color)
    # Card bg
    c.setFillColor(WHITE_SOFT)
    c.setStrokeColor(accent)
    c.setLineWidth(1.0)
    c.roundRect(x, y - h, w, h, 4 * mm, stroke=1, fill=1)

    # Header strip
    strip_h = 8 * mm
    c.setFillColor(accent)
    c.roundRect(x, y - strip_h, w, strip_h, 4 * mm, stroke=0, fill=1)
    # mask bottom corners on header strip
    c.rect(x, y - strip_h, w, 2 * mm, stroke=0, fill=1)

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(x + 4 * mm, y - 5.5 * mm, label.upper())
    c.setFont("Helvetica", 7.5)
    c.drawRightString(x + w - 4 * mm, y - 5.5 * mm, f"{len(items)} features")

    # Items
    style_h = ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=9, leading=11, textColor=TEXT)
    style_b = ParagraphStyle("b", fontName="Helvetica", fontSize=7.6, leading=9.5, textColor=HexColor("#475569"))
    cur_y = y - strip_h - 4 * mm
    item_w = w - 8 * mm
    for name, benefit in items:
        # bullet square
        c.setFillColor(accent)
        c.rect(x + 4 * mm, cur_y - 2.5 * mm, 1.6 * mm, 1.6 * mm, stroke=0, fill=1)

        # title
        p_t = Paragraph(name, style_h)
        p_t.wrapOn(c, item_w - 4 * mm, 12)
        p_t.drawOn(c, x + 7.5 * mm, cur_y - 3.5 * mm)

        # benefit
        p_b = Paragraph(benefit, style_b)
        pw, ph = p_b.wrapOn(c, item_w - 4 * mm, 30)
        p_b.drawOn(c, x + 7.5 * mm, cur_y - 3.5 * mm - ph - 1)
        cur_y -= ph + 7 * mm


def draw_connector(c, cx, cy, tx, ty, color):
    """Bezier-ish curve from root to category card."""
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(1.0)
    c.setDash(2, 2)
    c.line(cx, cy, tx, ty)
    c.setDash()


def draw_footer(c):
    c.setStrokeColor(GREY)
    c.line(MARGIN, 14 * mm, W - MARGIN, 14 * mm)
    c.setFillColor(NAVY_SOFT)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN, 9 * mm, "Network Capital is a Community Resource Ecosystem. Shared participation, not financial advice.")
    c.setFillColor(GOLD)
    c.setFont("Helvetica-Bold", 8)
    c.drawRightString(W - MARGIN, 9 * mm, "PRINTABLE A3 LANDSCAPE")


def render():
    c = canvas.Canvas(OUTPUT, pagesize=PAGE)
    c.setTitle("Network Capital — Feature site map")
    c.setAuthor("Network Capital")
    draw_header(c)

    # Geometry — 7 cards in a 4 × 2 grid (last row uses last slot for legend)
    cat_w = 90 * mm
    cat_h = 78 * mm
    gap_x = 6 * mm
    gap_y = 8 * mm

    grid_top = H - 32 * mm
    grid_left = MARGIN
    total_grid_w = 4 * cat_w + 3 * gap_x
    grid_left = (W - total_grid_w) / 2

    cards = list(SITEMAP.items())

    # Row 1: 4 cards above middle of page (we don't actually use root in middle —
    # the layout is a clean grid because root-radial would be too busy with 7
    # categories. The visual hierarchy is preserved via the colour-coded headers.)
    for i, (label, payload) in enumerate(cards):
        col = i % 4
        row = i // 4
        x = grid_left + col * (cat_w + gap_x)
        y = grid_top - row * (cat_h + gap_y)
        if i == 6:  # last card centred on row 2 (we have 7 categories, 3 on row 2)
            pass  # leave default grid
        draw_category(c, x, y, cat_w, cat_h, label, payload["color"], payload["items"])

    # Legend / footer note inside the empty slot if 7th column is missing
    if len(cards) % 4 != 0:
        empty_slots = 4 - (len(cards) % 4)
        last_row = len(cards) // 4
        first_empty_col = len(cards) % 4
        x = grid_left + first_empty_col * (cat_w + gap_x)
        y = grid_top - last_row * (cat_h + gap_y)
        # Legend / brand card
        c.setFillColor(NAVY)
        c.setStrokeColor(GOLD)
        c.roundRect(x, y - cat_h, cat_w * empty_slots + (empty_slots - 1) * gap_x, cat_h, 4 * mm, stroke=1, fill=1)
        # Title
        c.setFillColor(GOLD)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 5 * mm, y - 10 * mm, "Why this matters")
        c.setFillColor(white)
        c.setFont("Helvetica", 9.5)
        notes = [
            "Network Capital is a community resource ecosystem — not an investment platform.",
            "Every feature is built around one promise: turn your relationships into real outcomes.",
            "Score is uncapped. Withdrawals are real. Ambassadors are paid in ZAR.",
            "Use this map as a 60-second tour for new members or board reviews.",
            "",
            "Compliance reminder:",
            "We use 'shared access' and 'collective participation' — never 'investing' or 'returns'.",
        ]
        ny = y - 18 * mm
        for line in notes:
            c.drawString(x + 5 * mm, ny, line)
            ny -= 4.5 * mm

    draw_footer(c)
    c.showPage()
    c.save()
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    render()
