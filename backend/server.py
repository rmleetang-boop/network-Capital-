from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

security = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_admin(x_admin_password: str = Header(None)):
    """Admin auth guard: requires X-Admin-Password header to match env."""
    expected = os.environ.get('ADMIN_PASSWORD')
    if not expected or x_admin_password != expected:
        raise HTTPException(status_code=403, detail="Admin access required")
    return True

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    username: str
    bio: Optional[str] = ""
    photo: Optional[str] = ""
    phone: Optional[str] = None
    full_name: Optional[str] = None
    referred_by_code: Optional[str] = None
    terms_accepted: Optional[bool] = False
    terms_accepted_at: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    token: str
    user: Dict[str, Any]

class User(BaseModel):
    id: str
    email: str
    username: str
    bio: str
    photo: str
    network_score: int
    rank: str
    created_at: str
    referral_code: str
    referred_by: Optional[str] = None
    achievements: List[str] = []
    city: Optional[str] = None
    country: Optional[str] = None
    profession: Optional[str] = None
    interests: List[str] = []
    full_name: Optional[str] = None
    is_creator: Optional[bool] = False
    user_type: Optional[str] = "member"
    wallet_balance: Optional[float] = 0.0
    photos: List[Dict[str, Any]] = []
    videos: List[Dict[str, Any]] = []
    articles: List[Dict[str, Any]] = []
    currency: Optional[str] = "USD"
    premium_unlocked: Optional[bool] = False
    monthly_score: Optional[int] = 0
    month_key: Optional[str] = None
    cap_reached_at: Optional[str] = None
    session_minutes_today: Optional[int] = 0
    likes_received_count: Optional[int] = 0
    comments_given_count: Optional[int] = 0
    birth_month: Optional[int] = None
    # Jobs feature
    user_kind: Optional[str] = "social"  # "social" | "professional"
    skills: Optional[List[str]] = []
    experience: Optional[List[Dict[str, Any]]] = []
    job_post_unlocked: Optional[bool] = False
    # Friendly share code (referrals + Stokvel invites): networkcapitalapp.<username>.<MM>.<##>
    share_code: Optional[str] = None
    # Email verification (mock OTP)
    email_verified: Optional[bool] = False
    email_verified_at: Optional[str] = None
    # Founding-member 2× multiplier window
    is_founder: Optional[bool] = False
    founder_signup_rank: Optional[int] = None
    founder_multiplier_until: Optional[str] = None
    # Role-based admin (iter 25)
    role: Optional[str] = "user"  # "user" | "moderator" | "admin"
    # Ambassador (iter 28 — flag-driven, exposed via role dropdown as 'ambassador' option in iter 35)
    is_ambassador: Optional[bool] = False
    ambassador_rank: Optional[str] = None
    # Withdrawal feature (iter 34)
    promotion_zar_balance: Optional[float] = 0.0

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    profession: Optional[str] = None
    interests: Optional[List[str]] = None
    currency: Optional[str] = None
    birth_month: Optional[int] = None
    # Professional profile (only relevant when user_kind == 'professional')
    user_kind: Optional[str] = None  # "social" | "professional"
    skills: Optional[List[str]] = None
    experience: Optional[List[Dict[str, Any]]] = None

# ============== CURRENCY & PREMIUM ==============

SUPPORTED_CURRENCIES = {
    # code: (symbol, label, USD→cur rate as of prototype)
    "USD": {"symbol": "$",  "label": "US Dollar",        "rate": 1.0},
    "EUR": {"symbol": "€",  "label": "Euro",             "rate": 0.93},
    "GBP": {"symbol": "£",  "label": "British Pound",    "rate": 0.80},
    "ZAR": {"symbol": "R",  "label": "South African Rand","rate": 18.20},
    "NGN": {"symbol": "₦",  "label": "Nigerian Naira",   "rate": 1480.0},
    "KES": {"symbol": "KSh","label": "Kenyan Shilling",  "rate": 129.0},
    "GHS": {"symbol": "GH₵","label": "Ghanaian Cedi",    "rate": 14.50},
    "JPY": {"symbol": "¥",  "label": "Japanese Yen",     "rate": 155.0},
    "AUD": {"symbol": "A$", "label": "Australian Dollar","rate": 1.52},
    "CAD": {"symbol": "C$", "label": "Canadian Dollar",  "rate": 1.36},
}

PREMIUM_FEE_USD = 10.0

class PremiumPaymentRequest(BaseModel):
    currency: str  # must be in SUPPORTED_CURRENCIES
    payment_method: Optional[str] = "mock"  # "mock" for prototype

# ============== CONNECTIONS / HUBS / MEDIA ==============

class ConnectionRequestPayload(BaseModel):
    to_user_id: str
    type: str  # "social" | "financial" | "professional"
    message: Optional[str] = ""
    stokvel_id: Optional[str] = None  # only for financial type

class ArticleCreate(BaseModel):
    title: str
    content: str
    cover_image: Optional[str] = None

class MediaUpload(BaseModel):
    data_url: str  # base64 data URL
    caption: Optional[str] = ""

class Post(BaseModel):
    id: str
    user_id: str
    username: str
    user_photo: str
    user_score: int
    content: str
    image: Optional[str] = None
    video: Optional[str] = None
    hashtags: List[str] = []
    mentions: List[str] = []
    likes: List[str] = []
    comments: List[Dict[str, Any]] = []
    shares: int = 0
    is_official: Optional[bool] = False
    created_at: str

class CreatePostRequest(BaseModel):
    content: str
    image: Optional[str] = None
    video: Optional[str] = None
    is_official: Optional[bool] = False  # admin-only — triggers broadcast email fan-out

class CommentRequest(BaseModel):
    content: str

class NotificationModel(BaseModel):
    id: str
    user_id: str
    type: str
    message: str
    points: int
    read: bool
    created_at: str

class DashboardStats(BaseModel):
    current_score: int
    weekly_growth: int
    rank: str
    total_posts: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_referrals: int

class WalletBalance(BaseModel):
    balance: float
    total_earned: float
    total_spent: float
    pending: float

class Transaction(BaseModel):
    id: str
    user_id: str
    type: Optional[str] = "unknown"
    amount: Optional[float] = 0.0
    description: Optional[str] = ""
    status: Optional[str] = "completed"
    created_at: Optional[str] = ""

class Stokvel(BaseModel):
    id: str
    name: str
    description: str
    created_by: str
    creator_name: str
    members: List[Dict[str, Any]]
    total_pool: float
    target_amount: float
    payout_cycle: str
    next_payout_date: Optional[str] = None
    created_at: str
    status: str
    group_strength: int
    activation_fee_paid: Optional[bool] = True
    members_fees_paid: Optional[Dict[str, bool]] = {}
    # Purpose declares what the group is pooling money for — savings is just one option.
    # Allowed: savings | holiday | event | gift | group_trip | wedding | funeral | other
    purpose: Optional[str] = "savings"

class CreateStokvelRequest(BaseModel):
    name: str
    description: str
    target_amount: float
    payout_cycle: str
    purpose: Optional[str] = "savings"

class InviteMemberRequest(BaseModel):
    user_id: str

class ContributionRequest(BaseModel):
    amount: float
    note: Optional[str] = None

class Contribution(BaseModel):
    id: str
    stokvel_id: str
    user_id: str
    username: str
    user_photo: str
    amount: float
    note: str
    created_at: str

class DepositRequest(BaseModel):
    amount: float

# ============== CREATOR/PRODUCT MODELS ==============

class CreateProductRequest(BaseModel):
    name: str
    problem_solved: str
    description: Optional[str] = ""
    estimated_cost: float
    timeline: str  # e.g., "3 months", "6 months"
    interest_level: str  # "idea", "prototype", "ready_to_launch"
    category: Optional[str] = "general"
    release_date: Optional[str] = None
    min_support: Optional[float] = 10.0
    max_support: Optional[float] = 1000.0
    images: Optional[List[str]] = []
    # New: type (product or service), local currency, availability framing
    type: Optional[str] = "product"  # "product" | "service"
    currency: Optional[str] = None  # auto-defaults to creator country if not set
    availability: Optional[str] = "available_now"  # available_now | available_in_days | preorder | on_request
    availability_days: Optional[int] = None  # used when availability == "available_in_days"

class Product(BaseModel):
    id: str
    creator_id: str
    creator_name: str
    name: str
    problem_solved: str
    description: str
    estimated_cost: float
    timeline: str
    interest_level: str
    category: str
    release_date: Optional[str]
    min_support: float
    max_support: float
    images: List[str]
    status: str  # "pending_review", "approved", "rejected"
    total_supporters: int
    total_support_amount: float
    created_at: str
    approved_at: Optional[str]
    type: Optional[str] = "product"
    currency: Optional[str] = "USD"
    availability: Optional[str] = "available_now"
    availability_days: Optional[int] = None

class ProductFollower(BaseModel):
    id: str
    product_id: str
    name: str
    email: str
    phone: str
    created_at: str

class FollowProductRequest(BaseModel):
    name: str
    email: str
    phone: str

class ProductSupportRequest(BaseModel):
    amount: float
    note: Optional[str] = ""

# ============== STORIES / BOOKMARKS / EXPLORE / NOTIFICATIONS ==============

class StoryCreate(BaseModel):
    media_type: str  # "image" | "video"
    media_url: str   # base64 data URL
    caption: Optional[str] = ""

class ProductSupport(BaseModel):
    id: str
    product_id: str
    user_id: str
    username: str
    stokvel_id: Optional[str]  # If contributed via stokvel
    amount: float
    note: str
    created_at: str

class ProgressiveSignupRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    step: int = 1

class CompleteProfileRequest(BaseModel):
    full_name: str
    username: str
    bio: Optional[str] = ""
    intent: str  # "member" or "creator"
    terms_accepted: bool
    # Birth month — required at signup for personalised referral links + birthday recognition
    birth_month: Optional[int] = None  # 1-12
    # User kind — drives profile layout & Jobs feature visibility ("social" or "professional")
    user_kind: Optional[str] = "social"
    # Location (optional at signup but encouraged)
    country: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None
    # Banking — required for Stokvel participation
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    swift_code: Optional[str] = None
    branch_number: Optional[str] = None


class BankingDetailsRequest(BaseModel):
    bank_name: str
    account_number: str
    swift_code: str
    branch_number: str

class SendOtpRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    code: str

class UserScore(BaseModel):
    user_id: str
    username: str
    individual_score: float
    contribution_consistency_score: float
    contribution_amount_score: float
    engagement_score: float
    referral_score: float
    group_health_score: float
    tier: str
    streak_days: int
    total_contributions: float
    last_updated: str

class GroupScore(BaseModel):
    stokvel_id: str
    group_score: float
    tier: str
    total_pool: float
    member_count: int
    avg_member_score: float
    liquidity_ratio: float
    last_updated: str

class RewardAllocation(BaseModel):
    id: str
    user_id: str
    stokvel_id: str
    reward_type: str
    amount: float
    tier: str
    description: str
    status: str
    created_at: str

class SmartAccessRequest(BaseModel):
    id: str
    user_id: str
    stokvel_id: str
    requested_amount: float
    approved_amount: float
    user_score: float
    access_percentage: float
    status: str
    cost_method: str
    created_at: str
    approved_at: Optional[str] = None

class RequestSmartAccess(BaseModel):
    stokvel_id: str
    requested_amount: float

class WithdrawalRequest(BaseModel):
    amount: float
    purpose: str
    recipient_user_id: Optional[str] = None  # defaults to requester

class SetSignatoriesRequest(BaseModel):
    signatory_ids: List[str]  # 1–3 user_ids who can approve withdrawals

class Badge(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    requirement: str

class UserBadge(BaseModel):
    user_id: str
    badge_id: str
    earned_at: str

class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    photo: str
    score: float
    tier: str
    total_contributions: float

def calculate_rank(score: int) -> str:
    """5-tier lifetime ranking — see /legal §Network Score."""
    if score < 1000:
        return "Member"
    elif score < 3000:
        return "Contributor"
    elif score < 6000:
        return "Connector"
    elif score < 9000:
        return "Builder"
    else:
        return "Steward"

async def update_user_score(user_id: str, points: int, notification_msg: str, action: str = "legacy", source_id: Optional[str] = None):
    """Award points using new monthly-cap + premium-2x system. Backwards compatible."""
    await award_points(user_id, action, points, source_id=source_id, message=notification_msg)


# ============== NETWORK SCORE — REBALANCED (Iter 18) ==============
# Lifetime ranking out of 10,000. A *dedicated* user reaches Steward tier in ~12 months.
# ============================================================================
# NETWORK SCORE ENGINE — refactored iter 22
# ============================================================================
# Cap: 10,000 per calendar month; resets at month rollover.
# Highest badge of the month is saved to user.badge_history (see _close_month()).
# Three tiers (highest → lowest):
#   T1 Ads · T2 Referrals & invites · T3 Standard social activity
# Per-action daily caps + 24h same-source cooldown + 80% single-action review flag.
# ============================================================================

# ============== NETWORK SCORE — uncapped growth, 10k = top contributor ==
# Score grows indefinitely. The 10,000 threshold is the "Top Contributor"
# monthly badge — reaching it qualifies the member for badge / premium rewards,
# but additional points beyond 10k still count toward lifetime rank.
# Per-action daily caps + 24h same-source cooldown + 80% single-action review flag.
# ============================================================================

MONTHLY_TOP_CONTRIBUTOR_THRESHOLD = 10000
MONTHLY_SCORE_CAP = MONTHLY_TOP_CONTRIBUTOR_THRESHOLD   # legacy alias kept for compat; no longer enforces a hard cap
LIFETIME_SCORE_CAP = MONTHLY_SCORE_CAP                  # legacy alias kept for /tiers endpoint
WEEKLY_RESOURCE_DROP_LIMIT = 1
PREMIUM_TOP_GRACE_DAYS = 90

# Per-action config — points + daily count cap (None = no daily count cap)
SCORE_TABLE = {
    # ── T1: AD ENGAGEMENT (highest value) ────────────────────────────────────
    "ad_watch_engage":   {"points": 500, "daily_cap": 5},     # watched 100% + engaged with product
    "ad_watch_share":    {"points": 300, "daily_cap": None},  # diminishing per unique ad: 300/150/50/50/50
    # ── T2: REFERRALS & INVITATIONS ──────────────────────────────────────────
    "referral_qualified":     {"points": 400, "daily_cap": None},  # referred member crosses 1,000 same month
    "referral_feature_unlock":{"points": 200, "daily_cap": None},  # referred friend activates a feature
    "referral_first_post":    {"points": 150, "daily_cap": None},  # referred friend posts in first 7 days
    # ── T3: STANDARD SOCIAL ACTIVITY ─────────────────────────────────────────
    "post_create":       {"points": 50, "daily_cap": 5},
    "post_share":        {"points": 20, "daily_cap": 10},
    "comment_quality":   {"points": 30, "daily_cap": 10},     # AI-validated relevance ≥0.6
    "post_like":         {"points": 5,  "daily_cap": 20},
    "video_watched":     {"points": 10, "daily_cap": 10},     # non-ad video to completion
    # ── Misc / kept for back-compat (not in tier doc but already wired) ──────
    "daily_checkin":     {"points": 10, "daily_cap": 1},
    "story_create":      {"points": 5,  "daily_cap": 10},
    "weekly_resource_drop": {"points": 30, "daily_cap": None},
    "monthly_streak":    {"points": 100, "daily_cap": None},
    "stokvel_first_join":{"points": 250, "daily_cap": None},
    "activity_created":  {"points": 150, "daily_cap": None},
    "activity_joined":   {"points": 25,  "daily_cap": None},
    "profile_completed": {"points": 250, "daily_cap": 1},
    "creator_engagement":{"points": 500, "daily_cap": None},
    "premium_welcome_bonus": {"points": 500, "daily_cap": None},
    "manual_admin_grant":{"points": 0,  "daily_cap": None},
    # ── NEW (iter 25) — My Places, My Network, Job reactions ───────────────────
    "place_review_create": {"points": 40, "daily_cap": 10},   # genuine review with rating
    "connection_made":     {"points": 25, "daily_cap": 20},   # mutual accept (both sides earn)
    "job_share":           {"points": 20, "daily_cap": 10},   # share a job
}

# Ad share diminishing returns — per unique ad (key = ad_id)
AD_SHARE_LADDER = [300, 150, 50, 50, 50]   # 1st→5th share; >5 returns 0

# 24-hour cooldown applies to: liking the same post, sharing the same post, watching the
# same ad, etc. NB: ad_watch_share is intentionally NOT in this set — its diminishing
# ladder (300/150/50/50/50, max 5) is its own anti-abuse mechanism.
COOLDOWN_ACTIONS = {
    "post_like", "post_share", "post_create", "comment_quality",
    "ad_watch_engage", "video_watched",
    "place_review_create", "job_share",
}

# Auto-flag user for review when >80% of monthly points come from a single action type
SINGLE_ACTION_REVIEW_THRESHOLD = 0.80


def _month_key(dt: Optional[datetime] = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return dt.strftime("%Y-%m")

def _date_key(dt: Optional[datetime] = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%d")


# ============== REFERRAL / SHARE CODE ==============
# Friendly, brand-anchored format: networkcapitalapp.<username>.<MM>.<##>
# Example: networkcapitalapp.maria.06.42
# - username: lowercase, sanitised (alnum + underscore)
# - MM: 2-digit birth month (01-12), or "00" if not yet set
# - ##: deterministic 2-digit checksum derived from user.id (stable across renames)
SHARE_CODE_PREFIX = "networkcapitalapp"


def _share_code_suffix(user_id: str) -> str:
    """Stable 2-digit suffix derived from the user's UUID — survives username/birth-month changes."""
    if not user_id:
        return "00"
    # Last 2 hex chars of the uuid → mod 100, zero-padded
    try:
        digest = int(user_id.replace("-", "")[-8:], 16)
        return f"{digest % 100:02d}"
    except Exception:
        return "00"


def build_share_code(username: Optional[str], birth_month: Optional[int], user_id: str) -> str:
    """Build the friendly referral/share code shown to the user."""
    uname = (username or "member").strip().lower()
    # Sanitise username: alnum + underscore only, max 20 chars
    uname = "".join(c if c.isalnum() or c == "_" else "" for c in uname)[:20] or "member"
    try:
        bm = int(birth_month) if birth_month else 0
        if not (0 <= bm <= 12):
            bm = 0
    except (TypeError, ValueError):
        bm = 0
    mm = f"{bm:02d}"
    suffix = _share_code_suffix(user_id)
    return f"{SHARE_CODE_PREFIX}.{uname}.{mm}.{suffix}"


async def _refresh_share_code(user_id: str) -> Optional[str]:
    """Idempotently regenerate and persist user.share_code based on current username + birth_month."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return None
    code = build_share_code(user.get("username"), user.get("birth_month"), user_id)
    if user.get("share_code") != code:
        await db.users.update_one({"id": user_id}, {"$set": {"share_code": code}})
    return code

# ── Badges (highest of the month is saved into user.badge_history) ──────────
BADGE_TIERS = [
    (10000, "Network Legend"),
    (9000,  "Diamond Achiever"),
    (6000,  "Gold Influencer"),
    (3000,  "Silver Connector"),
    (1000,  "Bronze Networker"),
]


def calculate_badge(score: int) -> Optional[str]:
    for threshold, name in BADGE_TIERS:
        if score >= threshold:
            return name
    return None


async def _close_month(user: dict, prev_month_key: str) -> None:
    """Persist the highest badge earned in the just-ended month into badge_history."""
    score_at_close = int(user.get("monthly_score", 0))
    badge = calculate_badge(score_at_close)
    if not badge or not prev_month_key:
        return
    try:
        await db.users.update_one(
            {"id": user["id"]},
            {"$push": {
                "badge_history": {
                    "month": prev_month_key,
                    "badge": badge,
                    "score": score_at_close,
                    "saved_at": datetime.now(timezone.utc).isoformat(),
                }
            }},
        )
    except Exception as e:
        logger.warning(f"_close_month failed for user={user.get('id')}: {e}")


async def _ensure_month_state(user: dict) -> dict:
    """If the calendar month has rolled over since the user's last activity, save the
    user's highest badge for the closing month, then reset monthly_score & network_score."""
    cur_key = _month_key()
    if user.get("month_key") == cur_key:
        return user

    prev_key = user.get("month_key")
    # Persist closing-month badge BEFORE resetting score
    if prev_key:
        await _close_month(user, prev_key)

    new_state = {"month_key": cur_key, "session_minutes_today": 0, "last_session_date": _date_key()}

    # Premium grace: stay at top score for 3 months from cap
    keep_at_top = False
    if (
        user.get("premium_unlocked")
        and user.get("monthly_score", 0) >= MONTHLY_SCORE_CAP
        and user.get("cap_reached_at")
    ):
        try:
            cap_dt = datetime.fromisoformat(user["cap_reached_at"].replace("Z", "+00:00"))
            if (datetime.now(timezone.utc) - cap_dt).days < PREMIUM_TOP_GRACE_DAYS:
                keep_at_top = True
        except Exception:
            pass

    if keep_at_top:
        new_state["monthly_score"] = MONTHLY_SCORE_CAP
        new_state["network_score"] = MONTHLY_SCORE_CAP
    else:
        new_state["monthly_score"] = 0
        new_state["network_score"] = 0
        new_state["cap_reached_at"] = None

    await db.users.update_one({"id": user["id"]}, {"$set": new_state})
    user.update(new_state)
    return user


async def _check_review_flag(user_id: str, monthly_score: int) -> None:
    """Auto-flag a user for review when >80% of monthly points come from a single action type."""
    if monthly_score < 1000:
        return  # noise floor — small accounts can't get flagged
    pipeline = [
        {"$match": {"user_id": user_id, "month_key": _month_key()}},
        {"$group": {"_id": "$action", "total": {"$sum": "$points"}}},
        {"$sort": {"total": -1}},
        {"$limit": 1},
    ]
    rows = await db.score_events.aggregate(pipeline).to_list(1)
    if rows and rows[0]["total"] / max(monthly_score, 1) >= SINGLE_ACTION_REVIEW_THRESHOLD:
        await db.users.update_one(
            {"id": user_id},
            {"$set": {
                "review_flag": {
                    "reason": "single_action_dominance",
                    "action": rows[0]["_id"],
                    "share": round(rows[0]["total"] / monthly_score, 3),
                    "month": _month_key(),
                    "flagged_at": datetime.now(timezone.utc).isoformat(),
                }
            }},
        )


async def _resolve_base_points(action: str, base_points: int, source_id: Optional[str], user_id: str) -> int:
    """Computes the base points for the given action. Handles ad-share diminishing returns."""
    if action == "ad_watch_share" and source_id:
        # Diminishing per unique ad: 300 / 150 / 50 / 50 / 50, max 5 shares
        prior = await db.score_events.count_documents({
            "user_id": user_id, "action": "ad_watch_share", "source_id": source_id,
        })
        if prior >= len(AD_SHARE_LADDER):
            return 0
        return AD_SHARE_LADDER[prior]
    if base_points and base_points > 0:
        return base_points
    cfg = SCORE_TABLE.get(action)
    if isinstance(cfg, dict):
        return int(cfg.get("points", 0))
    if isinstance(cfg, int):
        return cfg
    return 0


async def award_points(
    user_id: str,
    action: str,
    base_points: int = 0,
    source_id: Optional[str] = None,
    message: Optional[str] = None,
    actor_ip: Optional[str] = None,
    actor_device: Optional[str] = None,
) -> int:
    """Award points — refactored iter 22.

    Enforces:
      • Monthly cap (10,000) — hard reset at month rollover (badge saved first).
      • Per-action daily cap (count of events today) from SCORE_TABLE.
      • 24-hour cooldown for (action, source_id) when action is in COOLDOWN_ACTIONS.
      • Ad-share diminishing returns (300/150/50/50/50 per unique ad, max 5 shares).
      • Premium / Founder 2× multiplier (max 2×, no stacking).
      • Auto review-flag when >80% of monthly points come from one action.
    """
    user = await db.users.find_one({"id": user_id})
    if not user:
        return 0

    user = await _ensure_month_state(user)

    # Resolve base points (handles ad-share ladder + table lookup)
    base_points = await _resolve_base_points(action, base_points, source_id, user_id)
    if base_points <= 0:
        return 0

    monthly = user.get("monthly_score", 0)
    # Score growth is no longer hard-capped at the monthly threshold. The 10k
    # mark only flags the "Top Contributor" badge. We still respect per-action
    # daily caps and the 24h same-source cooldown below.

    # Per-action daily count cap
    cfg = SCORE_TABLE.get(action) or {}
    daily_cap = cfg.get("daily_cap") if isinstance(cfg, dict) else None
    if daily_cap is not None:
        today_count = await db.score_events.count_documents({
            "user_id": user_id, "action": action, "date_key": _date_key(),
        })
        if today_count >= daily_cap:
            return 0

    # 24-hour cooldown on identical (action, source_id)
    if source_id and action in COOLDOWN_ACTIONS:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        recent = await db.score_events.find_one({
            "user_id": user_id,
            "action": action,
            "source_id": source_id,
            "created_at": {"$gte": cutoff},
        })
        if recent:
            return 0

    # Weekly resource drop — at most once per ISO week
    if action == "weekly_resource_drop":
        week_key = datetime.now(timezone.utc).strftime("%G-W%V")
        existing = await db.score_events.find_one({
            "user_id": user_id, "action": "weekly_resource_drop", "week_key": week_key,
        })
        if existing:
            return 0

    # Multiplier — Premium OR Founder window grants 2× (max 2×, no stacking)
    is_premium = bool(user.get("premium_unlocked"))
    is_founder_active = False
    fmu = user.get("founder_multiplier_until")
    if fmu:
        try:
            until_dt = datetime.fromisoformat(str(fmu).replace("Z", "+00:00"))
            if datetime.now(timezone.utc) <= until_dt:
                is_founder_active = True
        except (ValueError, TypeError):
            pass
    multiplier = 2 if (is_premium or is_founder_active) else 1
    awarded = base_points * multiplier
    # No hard ceiling — score grows uncapped. The 10k threshold is informational.
    if awarded <= 0:
        return 0

    new_monthly = monthly + awarded

    update = {
        "monthly_score": new_monthly,
        "network_score": new_monthly,
        "rank": calculate_rank(new_monthly),
    }
    if new_monthly >= MONTHLY_TOP_CONTRIBUTOR_THRESHOLD and not user.get("cap_reached_at"):
        # First time hitting 10k this month → mark as Top Contributor.
        update["cap_reached_at"] = datetime.now(timezone.utc).isoformat()
        update["top_contributor_at"] = update["cap_reached_at"]

    await db.users.update_one({"id": user_id}, {"$set": update})

    await db.score_events.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "points": awarded,
        "base_points": base_points,
        "multiplier": multiplier,
        "source_id": source_id,
        "month_key": _month_key(),
        "week_key": datetime.now(timezone.utc).strftime("%G-W%V"),
        "date_key": _date_key(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    if message:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "score_increase",
            "message": message,
            "points": awarded,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

    # T2 Referral payout — fires ONCE per referrer/invitee when invitee crosses 1,000
    # in the SAME month. Reward is "referral_qualified" (+400). Replaces the old +200/+500 split.
    if monthly < 1000 and new_monthly >= 1000 and user.get("referrer_id"):
        ref_id = user["referrer_id"]
        already = await db.score_events.find_one({
            "user_id": ref_id,
            "action": "referral_qualified",
            "source_id": user_id,
        })
        if not already:
            await award_points(
                ref_id, "referral_qualified", 0, source_id=user_id,
                message=f"Referral qualified — @{user.get('username')} crossed 1,000",
            )
            # Mark attribution as rewarded so we don't double-pay via _maybe_reward_referrer
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"referral_attribution.status": "rewarded"}},
            )

    # Single-action dominance review flag (>80% from one action type)
    await _check_review_flag(user_id, new_monthly)

    # Promotions tracker (iter 29) — fire-and-forget tag this event
    try:
        await _record_promotion_event(user_id=user_id, action=action, points=awarded)
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"promotion track failed for {user_id}/{action}: {exc}")

    return awarded


async def revoke_score_event(user_id: str, action: str, source_id: str) -> int:
    """Reverses a previously-awarded score event when the user undoes the action
    (delete post / delete comment / un-like). Removes the score_events row so daily-cap
    counts re-open, and deducts the awarded points from monthly_score & network_score
    (clamped at 0). Returns the number of points reversed (0 if nothing matched)."""
    if not (user_id and action and source_id):
        return 0
    ev = await db.score_events.find_one({
        "user_id": user_id, "action": action, "source_id": source_id,
    })
    if not ev:
        return 0
    pts = int(ev.get("points", 0))
    await db.score_events.delete_one({"_id": ev["_id"]})
    if pts > 0:
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "monthly_score": 1, "network_score": 1})
        if user:
            new_monthly = max(0, int(user.get("monthly_score", 0)) - pts)
            await db.users.update_one(
                {"id": user_id},
                {"$set": {
                    "monthly_score": new_monthly,
                    "network_score": new_monthly,
                    "rank": calculate_rank(new_monthly),
                }},
            )
    return pts

@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(request: SignupRequest):
    existing_user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": request.username}, {"_id": 0})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(request.password)
    
    # Handle referral
    referred_by_user_id = None
    if request.referred_by_code:
        referrer = await db.users.find_one({"referral_code": request.referred_by_code})
        if referrer:
            referred_by_user_id = referrer["id"]
            # Award referrer bonus (when referred user signs up)
            await db.users.update_one(
                {"id": referrer["id"]},
                {"$inc": {"network_score": 5, "wallet_balance": 10.0}}  # $10 referral bonus
            )
            await _notify_wallet_credit(referrer["id"], 10.0, f"Referral bonus — @{request.username} joined")
    
    user_data = {
        "id": user_id,
        "email": request.email,
        "password": hashed_password,
        "username": request.username,
        "bio": request.bio,
        "photo": request.photo,
        "phone": request.phone,
        "full_name": request.full_name,
        "network_score": 0,
        "rank": "Rising Star",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "referral_code": user_id[:8],
        "referred_by": referred_by_user_id,
        "referred_by_code": request.referred_by_code,
        "achievements": [],
        "wallet_balance": 0.0,
        "total_earned": 0.0,
        "total_spent": 0.0,
        "terms_accepted": request.terms_accepted or False,
        "terms_accepted_at": request.terms_accepted_at or datetime.now(timezone.utc).isoformat(),
        "terms_version": "2025-01"
    }
    
    result = await db.users.insert_one(user_data)
    
    token = create_access_token({"sub": user_id})
    
    user_response = {
        "id": user_id,
        "email": request.email,
        "username": request.username,
        "bio": request.bio,
        "photo": request.photo,
        "network_score": 0,
        "rank": "Rising Star",
        "created_at": user_data["created_at"],
        "referral_code": user_id[:8],
        "referred_by": None,
        "achievements": [],
        "wallet_balance": 0.0
    }
    
    return {"token": token, "user": user_response}

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Auto-reactivate: a successful login cancels a pending deactivation.
    # If the account is in deletion grace period, login also cancels that.
    auto_unset = {}
    auto_set = {}
    if user.get("deactivated"):
        auto_set["deactivated"] = False
        auto_unset["deactivated_at"] = ""
        auto_unset["deactivation_reason"] = ""
    if user.get("pending_deletion"):
        auto_set["pending_deletion"] = False
        auto_unset["deletion_purge_at"] = ""
        auto_unset["deletion_requested_at"] = ""
        auto_unset["deletion_reason"] = ""
    if auto_set or auto_unset:
        upd = {}
        if auto_set: upd["$set"] = auto_set
        if auto_unset: upd["$unset"] = auto_unset
        await db.users.update_one({"id": user["id"]}, upd)
        user = await db.users.find_one({"id": user["id"]}, {"_id": 0})

    token = create_access_token({"sub": user["id"]})
    user_response = {k: v for k, v in user.items() if k != "password"}
    return {"token": token, "user": user_response}

@api_router.get("/users/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.put("/users/me")
async def update_profile(request: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if request.username:
        existing = await db.users.find_one({"username": request.username, "id": {"$ne": current_user["id"]}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = request.username
    if request.bio is not None:
        update_data["bio"] = request.bio
    if request.photo is not None:
        update_data["photo"] = request.photo
    if request.city is not None:
        update_data["city"] = request.city
    if request.country is not None:
        update_data["country"] = request.country
    if request.profession is not None:
        update_data["profession"] = request.profession
    if request.interests is not None:
        update_data["interests"] = request.interests
    if request.currency is not None:
        if request.currency not in SUPPORTED_CURRENCIES:
            raise HTTPException(status_code=400, detail="Unsupported currency")
        update_data["currency"] = request.currency
    if request.birth_month is not None:
        if not (1 <= int(request.birth_month) <= 12):
            raise HTTPException(status_code=400, detail="birth_month must be 1-12")
        update_data["birth_month"] = int(request.birth_month)
    if request.user_kind is not None:
        if request.user_kind not in ("social", "professional"):
            raise HTTPException(status_code=400, detail="user_kind must be 'social' or 'professional'")
        update_data["user_kind"] = request.user_kind
    if request.skills is not None:
        update_data["skills"] = [str(s).strip() for s in request.skills if str(s).strip()][:30]
    if request.experience is not None:
        update_data["experience"] = request.experience[:20]

    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})

    # Propagate photo / username changes to denormalized fields across collections
    # so existing posts, stories, comments, DMs etc. reflect the new profile pic.
    propagate_set = {}
    if "photo" in update_data:
        propagate_set["user_photo"] = update_data["photo"]
        propagate_set["sender_photo"] = update_data["photo"]
        propagate_set["other_photo"] = update_data["photo"]
    if "username" in update_data:
        propagate_set["username"] = update_data["username"]
        propagate_set["sender_username"] = update_data["username"]
    if propagate_set:
        uid = current_user["id"]
        # Posts (top-level)
        post_set = {k: v for k, v in propagate_set.items() if k in {"user_photo", "username"}}
        if post_set:
            await db.posts.update_many({"user_id": uid}, {"$set": post_set})
            await db.stories.update_many({"user_id": uid}, {"$set": post_set})
        # Embedded comments inside posts
        if any(k in propagate_set for k in ("user_photo", "username")):
            comment_update = {}
            if "user_photo" in propagate_set:
                comment_update["comments.$[c].user_photo"] = propagate_set["user_photo"]
            if "username" in propagate_set:
                comment_update["comments.$[c].username"] = propagate_set["username"]
            if comment_update:
                try:
                    await db.posts.update_many(
                        {"comments.user_id": uid},
                        {"$set": comment_update},
                        array_filters=[{"c.user_id": uid}],
                    )
                except Exception:
                    pass
        # DM messages — sender side
        sender_set = {}
        if "sender_photo" in propagate_set:
            sender_set["sender_photo"] = propagate_set["sender_photo"]
        if "sender_username" in propagate_set:
            sender_set["sender_username"] = propagate_set["sender_username"]
        if sender_set:
            await db.dm_messages.update_many({"sender_id": uid}, {"$set": sender_set})

    # Refresh share_code if username or birth_month changed
    if "username" in update_data or "birth_month" in update_data:
        await _refresh_share_code(current_user["id"])

    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    return updated_user

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# ============== CURRENCY & PREMIUM ENDPOINTS ==============

@api_router.get("/currencies")
async def list_currencies():
    return {"currencies": [
        {"code": code, **details}
        for code, details in SUPPORTED_CURRENCIES.items()
    ], "premium_fee_usd": PREMIUM_FEE_USD}

@api_router.post("/users/me/premium")
async def unlock_premium(payload: PremiumPaymentRequest, current_user: dict = Depends(get_current_user)):
    """Legacy MOCK fallback. Stripe-eligible currencies must use /payments/checkout/session.
    Currently used for Paystack-target currencies (NGN, GHS, KES, ZAR) until keys are provided.
    """
    if payload.currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    if payload.currency in STRIPE_CURRENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"Use Stripe checkout for {payload.currency}. POST /api/payments/checkout/session",
        )
    if current_user.get("premium_unlocked"):
        return {
            "already_premium": True,
            "premium_unlocked": True,
            "currency": current_user.get("currency", "USD"),
        }
    meta = SUPPORTED_CURRENCIES[payload.currency]
    local_amount = round(PREMIUM_FEE_USD * meta["rate"], 2)
    await _unlock_premium_for_user(current_user["id"], payload.currency, local_amount, None, "paystack_mock")
    return {
        "premium_unlocked": True,
        "currency": payload.currency,
        "paid_usd": PREMIUM_FEE_USD,
        "paid_local": local_amount,
        "symbol": meta["symbol"],
        "welcome_bonus_points": PREMIUM_PACKAGE["welcome_bonus_points"],
        "mocked": True,
        "provider": "paystack_mock",
    }



def require_premium(current_user: dict):
    """Guard to call inside any financial endpoint that should be premium-gated."""
    if not current_user.get("premium_unlocked"):
        raise HTTPException(
            status_code=402,  # Payment Required
            detail="Premium subscription required. Unlock at /api/users/me/premium"
        )


# ============== STRIPE CHECKOUT (real payment path) ==============

# Currency routing: Stripe handles major global currencies.
# Paystack-eligible currencies (NGN, GHS, KES, ZAR) stay on the MOCK unlock endpoint
# until Paystack keys are provided.
STRIPE_CURRENCIES = {"USD", "EUR", "GBP", "CAD", "AUD", "JPY"}
PAYSTACK_CURRENCIES = {"NGN", "GHS", "KES", "ZAR"}

# Fixed packages — price is NEVER accepted from frontend
PREMIUM_PACKAGE = {
    "id": "premium_unlock",
    "name": "Network Capital Premium",
    "amount_usd": PREMIUM_FEE_USD,  # 10.00
    "welcome_bonus_points": 500,
}


class StripeCheckoutRequest(BaseModel):
    package_id: str = "premium_unlock"
    currency: str = "USD"
    origin_url: str  # window.location.origin from frontend


async def _unlock_premium_for_user(user_id: str, currency: str, local_amount: float, session_id: Optional[str], provider: str):
    """Idempotent: flips premium, awards welcome bonus once, records transaction, auto-narrates."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return False
    if user.get("premium_unlocked"):
        return False  # already unlocked — do nothing

    meta = SUPPORTED_CURRENCIES.get(currency, {"symbol": "$", "rate": 1})
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "premium_unlocked": True,
            "currency": currency,
            "premium_paid_at": datetime.now(timezone.utc).isoformat(),
            "premium_paid_amount_local": local_amount,
            "premium_paid_currency": currency,
            "premium_provider": provider,
            "premium_session_id": session_id,
        }}
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "premium_unlock",
        "amount_usd": PREMIUM_FEE_USD,
        "amount_local": local_amount,
        "currency": currency,
        "description": f"Premium unlock via {provider} ({meta['symbol']}{local_amount} {currency})",
        "status": "completed",
        "provider": provider,
        "session_id": session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Welcome bonus (one-time)
    try:
        await award_points(
            user_id,
            "premium_welcome_bonus",
            PREMIUM_PACKAGE["welcome_bonus_points"],
            source_id=session_id or provider,
            message="Welcome to Premium — +500 bonus points",
        )
    except Exception as e:
        logging.warning(f"Welcome bonus award failed: {e}")
    # Auto-narrate to feed
    try:
        await _auto_post(
            user_id,
            f"Just joined Premium! Ready to level up my savings journey {meta['symbol']}{local_amount:.2f} {currency} #premium #networkcapital",
        )
    except Exception as e:
        logging.warning(f"Auto-narrate premium post failed: {e}")
    return True


@api_router.post("/payments/checkout/session")
async def create_payment_checkout(
    payload: StripeCheckoutRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Creates a Stripe Checkout session for the Premium package.
    Amount is server-defined — frontend CANNOT manipulate price."""
    if current_user.get("premium_unlocked"):
        raise HTTPException(status_code=400, detail="Premium already unlocked")
    if payload.package_id != PREMIUM_PACKAGE["id"]:
        raise HTTPException(status_code=400, detail="Unknown package")
    currency = (payload.currency or "USD").upper()
    if currency not in STRIPE_CURRENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"Currency {currency} not supported by Stripe. Use USD/EUR/GBP/CAD/AUD/JPY, or Paystack (coming soon) for NGN/GHS/KES/ZAR.",
        )

    meta = SUPPORTED_CURRENCIES[currency]
    # Server-side amount derivation
    if currency == "JPY":
        local_amount = round(PREMIUM_FEE_USD * meta["rate"])  # JPY has no decimals
    else:
        local_amount = round(PREMIUM_FEE_USD * meta["rate"], 2)

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    # Build dynamic URLs from the provided frontend origin
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/premium/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/profile?payment=cancelled"

    # Webhook URL — derived from server host, never hardcoded
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"

    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    checkout_request = CheckoutSessionRequest(
        amount=float(local_amount),
        currency=currency.lower(),
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": current_user["id"],
            "package_id": PREMIUM_PACKAGE["id"],
            "source": "premium_paywall",
        },
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)

    # Record pending transaction
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": current_user["id"],
        "package_id": PREMIUM_PACKAGE["id"],
        "amount_usd": PREMIUM_FEE_USD,
        "amount_local": local_amount,
        "currency": currency,
        "provider": "stripe",
        "status": "initiated",
        "payment_status": "pending",
        "metadata": {"source": "premium_paywall"},
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    return {
        "url": session.url,
        "session_id": session.session_id,
        "amount_local": local_amount,
        "currency": currency,
        "symbol": meta["symbol"],
    }


@api_router.get("/payments/checkout/status/{session_id}")
async def get_payment_status(
    session_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """Polled by the frontend after Stripe redirect. Server verifies with Stripe
    and flips premium exactly once."""
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Payment session not found")
    if tx["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your payment session")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    try:
        status_resp: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logging.exception("Stripe status check failed")
        raise HTTPException(status_code=502, detail=f"Stripe status error: {e}")

    # Update the transaction (idempotent — only flip once)
    new_status = status_resp.status
    new_payment_status = status_resp.payment_status
    already_paid = tx.get("payment_status") == "paid"

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "status": new_status,
            "payment_status": new_payment_status,
            "amount_stripe_cents": status_resp.amount_total,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    unlocked_now = False
    if new_payment_status == "paid" and not already_paid:
        unlocked_now = await _unlock_premium_for_user(
            tx["user_id"], tx["currency"], tx["amount_local"], session_id, "stripe"
        )

    return {
        "session_id": session_id,
        "status": new_status,
        "payment_status": new_payment_status,
        "amount_total": status_resp.amount_total,
        "currency": status_resp.currency,
        "premium_unlocked": (new_payment_status == "paid"),
        "just_unlocked": unlocked_now,
        "welcome_bonus_points": PREMIUM_PACKAGE["welcome_bonus_points"] if unlocked_now else 0,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook handler — idempotent premium unlock on checkout.session.completed."""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, signature)
    except Exception as e:
        logging.exception("Stripe webhook validation failed")
        raise HTTPException(status_code=400, detail=f"Webhook error: {e}")

    session_id = event.session_id
    if not session_id:
        return {"received": True}
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        return {"received": True}
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": event.payment_status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "webhook_event_id": event.event_id,
            "webhook_event_type": event.event_type,
        }}
    )
    if event.payment_status == "paid" and tx.get("payment_status") != "paid":
        await _unlock_premium_for_user(
            tx["user_id"], tx["currency"], tx["amount_local"], session_id, "stripe"
        )
    return {"received": True}


# ============== HEARTBEAT, ADS, SCORE SUMMARY, ACTIVITY TRACKER ==============

class HeartbeatResponse(BaseModel):
    minutes_today: int
    points_awarded: int

@api_router.post("/users/me/heartbeat")
async def heartbeat(current_user: dict = Depends(get_current_user)):
    """Frontend pings every 60s while user is active. Awards 10 pts per 180 cumulative minutes."""
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404)
    user = await _ensure_month_state(user)

    today = _date_key()
    last_date = user.get("last_session_date")
    if last_date != today:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_session_date": today, "session_minutes_today": 0}}
        )
        user["session_minutes_today"] = 0

    prev_minutes = user.get("session_minutes_today", 0)
    new_minutes = prev_minutes + 1
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"session_minutes_today": new_minutes}}
    )

    awarded = 0
    if new_minutes // 180 > prev_minutes // 180:
        awarded = await award_points(
            user["id"], "time_on_app", 10,
            message="3 hours active +10"
        )
    return {"minutes_today": new_minutes, "points_awarded": awarded}


class AdWatchPayload(BaseModel):
    with_share: bool = False
    with_engagement: bool = False
    ad_id: Optional[str] = None

@api_router.post("/ads/watch")
async def watch_ad(payload: AdWatchPayload, current_user: dict = Depends(get_current_user)):
    """Reward a user for engaging with or sharing a real, active advertisement.

    SECURITY: Validates the ad actually exists, is active, has reward inventory,
    and the user has not already claimed for the same ad / event in cooldown.
    No points are awarded for merely opening the feed.
    """
    # Must reference a real ad.
    if not payload.ad_id:
        return {"points": 0, "reason": "No active rewarded advertisements available.", "awarded": False}

    ad = await db.ads.find_one({"id": payload.ad_id}, {"_id": 0})
    if not ad:
        return {"points": 0, "reason": "No active rewarded advertisements available.", "awarded": False}

    # Must be active. Block any moderated/draft/expired campaigns.
    is_active = bool(ad.get("is_active", True))
    if not is_active or ad.get("status") in ("draft", "paused", "expired"):
        return {"points": 0, "reason": "This advertisement is not currently rewarding points.", "awarded": False}

    # Time-window guard if the campaign defines start/end.
    now_iso = datetime.now(timezone.utc).isoformat()
    if ad.get("starts_at") and now_iso < str(ad["starts_at"]):
        return {"points": 0, "reason": "Campaign has not started yet.", "awarded": False}
    if ad.get("ends_at") and now_iso > str(ad["ends_at"]):
        return {"points": 0, "reason": "Campaign has ended.", "awarded": False}

    # Reward-inventory guard. Admins can set max_rewards on the ad doc; falls back to
    # unlimited if not set so legacy campaigns continue to work.
    max_rewards = ad.get("max_rewards")
    if isinstance(max_rewards, int) and max_rewards > 0:
        rewards_used = int(ad.get("rewards_used", 0))
        if rewards_used >= max_rewards:
            return {"points": 0, "reason": "Reward inventory exhausted for this ad.", "awarded": False}

    # Action + base
    if payload.with_engagement:
        score_action, base = "ad_watch_engage", 500
        event_kind = "engage"
    elif payload.with_share:
        score_action, base = "ad_watch_share", 100
        event_kind = "share"
    else:
        return {"points": 0, "reason": "Watch fully + share or engage to earn points.", "awarded": False}

    # ── DEDUPLICATION ────────────────────────────────────────────────────
    # 1 reward per (user, ad, event_kind). Enforced atomically via an upsert into
    # ad_reward_claims so concurrent requests can't double-claim.
    dedup_key = f"{current_user['id']}|{payload.ad_id}|{event_kind}"
    try:
        await db.ad_reward_claims.insert_one({
            "id": str(uuid.uuid4()),
            "key": dedup_key,
            "user_id": current_user["id"],
            "ad_id": payload.ad_id,
            "event_kind": event_kind,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except DuplicateKeyError:
        return {"points": 0, "reason": "Reward already claimed for this ad.", "awarded": False, "duplicate": True}
    except Exception:
        # If the unique index is not yet built, fall back to a soft check (still safer than nothing).
        existing = await db.ad_reward_claims.find_one({"key": dedup_key})
        if existing:
            return {"points": 0, "reason": "Reward already claimed for this ad.", "awarded": False, "duplicate": True}
        await db.ad_reward_claims.insert_one({
            "id": str(uuid.uuid4()), "key": dedup_key,
            "user_id": current_user["id"], "ad_id": payload.ad_id,
            "event_kind": event_kind, "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Award via the same award_points pipeline (daily caps + 24h same-source cooldown still apply).
    awarded = await award_points(
        current_user["id"], score_action, base,
        source_id=payload.ad_id,
        message=f"Ad {event_kind} reward +{base}",
    )

    # Mark inventory consumption on the ad doc.
    if awarded > 0:
        await db.ads.update_one(
            {"id": payload.ad_id},
            {"$inc": {"rewards_used": 1, "engagements" if event_kind == "engage" else "shares": 1}},
        )

    return {"points": awarded, "action": score_action, "ad_id": payload.ad_id, "awarded": awarded > 0}


@api_router.get("/score/summary")
async def score_summary(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404)
    user = await _ensure_month_state(user)

    monthly = user.get("monthly_score", 0)
    cap = MONTHLY_SCORE_CAP
    percentage = round((monthly / cap) * 100, 1) if cap else 0
    cap_reached = monthly >= cap

    today = _date_key()
    daily_total = await db.score_events.aggregate([
        {"$match": {"user_id": user["id"], "date_key": today}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]).to_list(1)
    daily_score = daily_total[0]["total"] if daily_total else 0

    week_start = (datetime.now(timezone.utc) - timedelta(days=6)).strftime("%Y-%m-%d")
    weekly_total = await db.score_events.aggregate([
        {"$match": {"user_id": user["id"], "date_key": {"$gte": week_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$points"}}}
    ]).to_list(1)
    weekly_score = weekly_total[0]["total"] if weekly_total else 0

    # Premium grace status
    premium_grace = None
    if user.get("premium_unlocked") and user.get("cap_reached_at"):
        try:
            cap_dt = datetime.fromisoformat(user["cap_reached_at"].replace("Z", "+00:00"))
            days_remaining = max(0, PREMIUM_TOP_GRACE_DAYS - (datetime.now(timezone.utc) - cap_dt).days)
            premium_grace = {"days_remaining": days_remaining, "active": days_remaining > 0}
        except Exception:
            pass

    can_claim_premium = cap_reached and not user.get("premium_unlocked", False)

    # Founder 2× multiplier window status
    founder_active = False
    founder_until = user.get("founder_multiplier_until")
    founder_days_remaining = 0
    if founder_until:
        try:
            until_dt = datetime.fromisoformat(str(founder_until).replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if now <= until_dt:
                founder_active = True
                founder_days_remaining = max(0, (until_dt - now).days)
        except Exception:
            pass

    return {
        "monthly_score": monthly,
        "monthly_cap": cap,
        "percentage": percentage,
        "cap_reached": cap_reached,
        "daily_score": daily_score,
        "weekly_score": weekly_score,
        "lifetime_score": user.get("network_score", 0),
        "rank": user.get("rank", "Rising Star"),
        "premium_unlocked": bool(user.get("premium_unlocked")),
        "premium_multiplier_active": bool(user.get("premium_unlocked")) or founder_active,
        "premium_grace": premium_grace,
        "can_claim_premium": can_claim_premium,
        "founder_multiplier": {
            "active": founder_active,
            "is_founder": bool(user.get("is_founder")),
            "rank": user.get("founder_signup_rank"),
            "days_remaining": founder_days_remaining,
            "until": founder_until,
        },
        "session_minutes_today": user.get("session_minutes_today", 0),
        "month_key": user.get("month_key"),
    }


@api_router.get("/score/activity")
async def score_activity(period: str = "daily", days: int = 30, current_user: dict = Depends(get_current_user)):
    """Returns score events grouped by day/week/month for charts."""
    if period not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="period must be daily|weekly|monthly")

    if period == "daily":
        since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
        rows = await db.score_events.aggregate([
            {"$match": {"user_id": current_user["id"], "date_key": {"$gte": since}}},
            {"$group": {"_id": "$date_key", "total": {"$sum": "$points"}, "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}},
        ]).to_list(365)
        return {"period": "daily", "buckets": [{"key": r["_id"], "points": r["total"], "events": r["count"]} for r in rows]}

    if period == "weekly":
        since = (datetime.now(timezone.utc) - timedelta(days=days * 7)).isoformat()
        events = await db.score_events.find(
            {"user_id": current_user["id"], "created_at": {"$gte": since}},
            {"_id": 0}
        ).to_list(2000)
        from collections import defaultdict
        buckets = defaultdict(lambda: {"points": 0, "events": 0})
        for e in events:
            try:
                dt = datetime.fromisoformat(e["created_at"].replace("Z", "+00:00"))
                year, week, _ = dt.isocalendar()
                key = f"{year}-W{week:02d}"
                buckets[key]["points"] += e["points"]
                buckets[key]["events"] += 1
            except Exception:
                pass
        return {"period": "weekly", "buckets": [{"key": k, **v} for k, v in sorted(buckets.items())]}

    rows = await db.score_events.aggregate([
        {"$match": {"user_id": current_user["id"]}},
        {"$group": {"_id": "$month_key", "total": {"$sum": "$points"}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]).to_list(120)
    return {"period": "monthly", "buckets": [{"key": r["_id"], "points": r["total"], "events": r["count"]} for r in rows]}


@api_router.get("/score/events")
async def score_events_list(limit: int = 50, current_user: dict = Depends(get_current_user)):
    rows = await db.score_events.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"events": rows}


@api_router.post("/score/claim-premium")
async def claim_premium_via_score(current_user: dict = Depends(get_current_user)):
    """Free users who hit the monthly 10K cap can claim premium (no $ charge)."""
    user = await db.users.find_one({"id": current_user["id"]})
    if not user:
        raise HTTPException(status_code=404)
    user = await _ensure_month_state(user)
    if user.get("premium_unlocked"):
        return {"already_premium": True}
    if user.get("monthly_score", 0) < MONTHLY_SCORE_CAP:
        raise HTTPException(status_code=400, detail="Reach 10,000 points this month to claim")

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "premium_unlocked": True,
            "premium_paid_at": datetime.now(timezone.utc).isoformat(),
            "premium_claim_method": "top_score",
            "currency": user.get("currency", "USD"),
        }}
    )
    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "type": "premium_unlock_claimed",
        "amount_usd": 0,
        "currency": user.get("currency", "USD"),
        "description": "Premium unlocked by hitting 10,000 monthly points (no charge)",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"premium_unlocked": True, "claimed_via": "top_score"}


@api_router.post("/score/daily-checkin")
async def daily_checkin(current_user: dict = Depends(get_current_user)):
    """Daily +10 (max once per calendar day, server-enforced)."""
    awarded = await award_points(current_user["id"], "daily_checkin", 0, message="Daily check-in")
    if awarded == 0:
        return {"awarded": 0, "already_today": True}
    return {"awarded": awarded, "message": f"+{awarded} for showing up today"}


@api_router.post("/score/weekly-resource")
async def weekly_resource_drop(current_user: dict = Depends(get_current_user)):
    """Weekly +30 (max once per ISO week)."""
    awarded = await award_points(current_user["id"], "weekly_resource_drop", 0, message="Weekly Resource Drop")
    if awarded == 0:
        return {"awarded": 0, "already_this_week": True}
    return {"awarded": awarded}


@api_router.get("/score/tiers")
async def score_tiers():
    """Public — exposes the rebalanced score table + tier thresholds."""
    return {
        "lifetime_cap": LIFETIME_SCORE_CAP,
        "monthly_cap": MONTHLY_SCORE_CAP,
        "tiers": [
            {"name": "Member", "min": 0, "max": 999},
            {"name": "Contributor", "min": 1000, "max": 2999},
            {"name": "Connector", "min": 3000, "max": 5999},
            {"name": "Builder", "min": 6000, "max": 8999},
            {"name": "Steward", "min": 9000, "max": LIFETIME_SCORE_CAP},
        ],
        "actions": SCORE_TABLE,
        "membership_lanes": {
            "premium_only": ["wallet_ops", "multi_sig_withdrawals", "creator_product_backing", "currency_switcher", "score_2x_multiplier"],
            "score_only": [
                {"feature": "stokvel_eligibility", "min_score": 500},
                {"feature": "priority_activities", "min_score": 2000},
                {"feature": "verified_badge", "min_score": 3000},
                {"feature": "creator_marketplace_listing", "min_score": 4000},
                {"feature": "hub_leaderboard_placement", "min_score": 5000},
            ],
            "bridge": "Hit 10,000 lifetime once → claim 3 months free Premium + permanent Steward badge",
        },
    }



# ============== PUBLIC LANDING DATA (no auth) ==============

# Seed lines used when there is no real activity yet — keeps the landing feed
# from ever appearing empty and reinforces social proof.
_SEED_ACTIVITY = [
    {"type": "joined", "username": "thandi_m", "city": "Cape Town", "minutes_ago": 3, "text": "joined the Circle"},
    {"type": "score", "username": "kabelo_b", "city": "Johannesburg", "minutes_ago": 7, "text": "earned +500 by engaging with a community product", "points": 500},
    {"type": "benefit", "username": "amaka_n", "city": "Lagos", "minutes_ago": 12, "text": "unlocked a Group Benefit (Stokvel Tier 2)"},
    {"type": "joined", "username": "kwame_o", "city": "Accra", "minutes_ago": 18, "text": "joined the Circle"},
    {"type": "score", "username": "lerato_s", "city": "Pretoria", "minutes_ago": 22, "text": "hit a 7-day participation streak (+10)", "points": 10},
    {"type": "benefit", "username": "nia_k", "city": "Nairobi", "minutes_ago": 31, "text": "claimed a Shared Value reward via the group pool"},
    {"type": "score", "username": "sipho_d", "city": "Durban", "minutes_ago": 44, "text": "shared a community update (+10)", "points": 10},
    {"type": "joined", "username": "fatou_a", "city": "Dakar", "minutes_ago": 58, "text": "joined the Circle"},
    {"type": "score", "username": "tendai_z", "city": "Harare", "minutes_ago": 73, "text": "posted a contribution update (+20)", "points": 20},
    {"type": "benefit", "username": "ade_o", "city": "Lagos", "minutes_ago": 88, "text": "qualified for Product Access (premium tier)"},
]


@api_router.get("/activity/live")
async def public_live_activity(limit: int = 30):
    """Public endpoint — recent score events + new members + unlocks for the
    landing-page Live Activity Feed. Falls back to seeded items if the platform
    is empty so the feed never reads as dead."""
    items = []
    # Recent score events (last 6 hours)
    since = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    score_rows = await db.score_events.find(
        {"created_at": {"$gte": since}, "points": {"$gt": 0}},
        {"_id": 0, "user_id": 1, "points": 1, "action": 1, "created_at": 1, "message": 1},
    ).sort("created_at", -1).to_list(limit)
    user_ids = list({r["user_id"] for r in score_rows})
    user_map = {}
    if user_ids:
        for u in await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "username": 1, "city": 1}).to_list(len(user_ids)):
            user_map[u["id"]] = u
    for r in score_rows:
        u = user_map.get(r["user_id"], {})
        if not u:
            continue
        items.append({
            "type": "score",
            "username": u.get("username", "member"),
            "city": (u.get("city") or "").replace("_", " ").title(),
            "text": r.get("message") or f"earned +{r['points']} ({r.get('action','engagement')})",
            "points": r["points"],
            "created_at": r["created_at"],
        })
    # Recent new members (last 24h)
    since_24h = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    new_members = await db.users.find(
        {"created_at": {"$gte": since_24h}},
        {"_id": 0, "username": 1, "city": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(10)
    for u in new_members:
        items.append({
            "type": "joined",
            "username": u.get("username", "member"),
            "city": (u.get("city") or "").replace("_", " ").title(),
            "text": "joined the Circle",
            "created_at": u.get("created_at"),
        })
    # Recent premium unlocks (treat as benefit unlocked)
    benefit_rows = await db.transactions.find(
        {"type": "premium_unlock", "created_at": {"$gte": since_24h}},
        {"_id": 0, "user_id": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(10)
    benefit_user_ids = list({r["user_id"] for r in benefit_rows if r.get("user_id") not in user_map})
    if benefit_user_ids:
        for u in await db.users.find({"id": {"$in": benefit_user_ids}}, {"_id": 0, "id": 1, "username": 1, "city": 1}).to_list(len(benefit_user_ids)):
            user_map[u["id"]] = u
    for r in benefit_rows:
        u = user_map.get(r["user_id"], {})
        if not u:
            continue
        items.append({
            "type": "benefit",
            "username": u.get("username", "member"),
            "city": (u.get("city") or "").replace("_", " ").title(),
            "text": "unlocked Premium Group Benefits",
            "created_at": r.get("created_at"),
        })

    # Sort by created_at desc and trim
    items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    items = items[:limit]

    # Seed fallback so the feed never reads as empty
    if len(items) < 6:
        for s in _SEED_ACTIVITY:
            items.append({**s, "seeded": True})
        items = items[:limit]

    return {"items": items, "total": len(items)}


@api_router.get("/leaderboard/public")
async def public_leaderboard(limit: int = 10):
    """Public top-N members by network_score for the landing page."""
    rows = await db.users.find(
        {"network_score": {"$gt": 0}},
        {"_id": 0, "id": 1, "username": 1, "city": 1, "photo": 1, "network_score": 1},
    ).sort("network_score", -1).limit(limit).to_list(limit)
    out = [{
        "rank": i + 1,
        "username": r.get("username"),
        "city": (r.get("city") or "").replace("_", " ").title(),
        "photo": r.get("photo", ""),
        "network_score": int(r.get("network_score", 0)),
    } for i, r in enumerate(rows)]
    # Pad with seeded leaders if fewer than 5 real participants
    seeds = [
        {"username": "thandi_m", "city": "Cape Town", "photo": "", "network_score": 9420},
        {"username": "kabelo_b", "city": "Johannesburg", "photo": "", "network_score": 8910},
        {"username": "amaka_n", "city": "Lagos", "photo": "", "network_score": 8320},
        {"username": "lerato_s", "city": "Pretoria", "photo": "", "network_score": 7780},
        {"username": "kwame_o", "city": "Accra", "photo": "", "network_score": 7210},
    ]
    if len(out) < 5:
        existing_names = {r["username"] for r in out}
        for s in seeds:
            if len(out) >= limit:
                break
            if s["username"] in existing_names:
                continue
            out.append({"rank": len(out) + 1, **s, "seeded": True})
    return {"leaders": out, "total": len(out)}




import re

async def _auto_post(user_id: str, content: str):
    """Auto-create a post from a system event, as the user themselves."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    post_data = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "username": user["username"],
        "user_photo": user.get("photo", ""),
        "user_score": user.get("network_score", 0),
        "content": content,
        "image": None,
        "video": None,
        "hashtags": extract_hashtags(content),
        "mentions": extract_mentions(content),
        "likes": [],
        "comments": [],
        "shares": 0,
        "is_auto_narrated": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.posts.insert_one(post_data)


# ============== STORIES (24h ephemeral) ==============

STORY_TTL_HOURS = 24

@api_router.post("/stories")
async def create_story(payload: StoryCreate, current_user: dict = Depends(get_current_user)):
    if payload.media_type not in ("image", "video"):
        raise HTTPException(status_code=400, detail="media_type must be image or video")
    if not payload.media_url:
        raise HTTPException(status_code=400, detail="media_url required")
    if len(payload.media_url) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Story too large (max 11MB raw)")
    now = datetime.now(timezone.utc)
    story = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_photo": current_user.get("photo", ""),
        "media_type": payload.media_type,
        "media_url": payload.media_url,
        "caption": payload.caption or "",
        "viewers": [],
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=STORY_TTL_HOURS)).isoformat(),
    }
    await db.stories.insert_one(story)
    if "_id" in story:
        del story["_id"]
    await award_points(current_user["id"], "story_create", 0, source_id=story["id"], message="Posted a story")
    return {"story": story}

@api_router.get("/stories/feed")
async def stories_feed(current_user: dict = Depends(get_current_user)):
    """Active (non-expired) stories grouped by user. Self first, then others."""
    now = datetime.now(timezone.utc).isoformat()
    rows = await db.stories.find({"expires_at": {"$gt": now}}, {"_id": 0}).sort("created_at", 1).to_list(500)
    grouped = {}
    for s in rows:
        grouped.setdefault(s["user_id"], {
            "user_id": s["user_id"],
            "username": s["username"],
            "user_photo": s.get("user_photo", ""),
            "stories": [],
        })
        grouped[s["user_id"]]["stories"].append(s)
    # Mark which groups are "viewed" by current user (all their stories already viewed)
    out = []
    for g in grouped.values():
        viewed = all(current_user["id"] in s.get("viewers", []) for s in g["stories"])
        g["all_viewed"] = viewed
        g["count"] = len(g["stories"])
        out.append(g)
    # Self first
    out.sort(key=lambda x: (x["user_id"] != current_user["id"], x["all_viewed"]))
    return {"groups": out}

@api_router.post("/stories/{story_id}/view")
async def view_story(story_id: str, current_user: dict = Depends(get_current_user)):
    s = await db.stories.find_one({"id": story_id})
    if not s:
        raise HTTPException(status_code=404, detail="Story not found")
    if current_user["id"] not in s.get("viewers", []):
        await db.stories.update_one({"id": story_id}, {"$push": {"viewers": current_user["id"]}})
    return {"viewed": True}

@api_router.delete("/stories/{story_id}")
async def delete_story(story_id: str, current_user: dict = Depends(get_current_user)):
    s = await db.stories.find_one({"id": story_id})
    if not s:
        raise HTTPException(status_code=404)
    if s["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403)
    await db.stories.delete_one({"id": story_id})
    return {"deleted": True}


# ============== BOOKMARKS ==============

@api_router.post("/posts/{post_id}/bookmark")
async def bookmark_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "id": 1})
    if not post:
        raise HTTPException(status_code=404)
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "bookmarks": 1})
    bookmarks = (user or {}).get("bookmarks", [])
    if post_id in bookmarks:
        await db.users.update_one({"id": current_user["id"]}, {"$pull": {"bookmarks": post_id}})
        return {"bookmarked": False}
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"bookmarks": {"$each": [post_id], "$position": 0, "$slice": 500}}}
    )
    return {"bookmarked": True}

@api_router.get("/users/me/bookmarks")
async def list_bookmarks(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "bookmarks": 1})
    ids = (user or {}).get("bookmarks", [])
    if not ids:
        return {"posts": []}
    posts = await db.posts.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    by_id = {p["id"]: p for p in posts}
    return {"posts": [by_id[i] for i in ids if i in by_id]}


# ============== HASHTAGS ==============

HASHTAG_RE = re.compile(r"#([A-Za-z0-9_]{2,30})")
MENTION_RE = re.compile(r"@([A-Za-z0-9_]{2,30})")

def extract_hashtags(text: str):
    return list({m.group(1).lower() for m in HASHTAG_RE.finditer(text or "")})

def extract_mentions(text: str):
    return list({m.group(1).lower() for m in MENTION_RE.finditer(text or "")})

@api_router.get("/hashtags/{tag}/posts")
async def hashtag_posts(tag: str, limit: int = 50):
    tag = tag.lower().lstrip("#")
    posts = await db.posts.find(
        {"hashtags": tag}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"tag": tag, "posts": posts, "count": len(posts)}

@api_router.get("/hashtags/trending")
async def trending_hashtags(limit: int = 12):
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}, "hashtags": {"$exists": True, "$ne": []}}},
        {"$unwind": "$hashtags"},
        {"$group": {"_id": "$hashtags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": limit},
    ]
    rows = await db.posts.aggregate(pipeline).to_list(limit)
    return {"tags": [{"tag": r["_id"], "count": r["count"]} for r in rows]}



# ============== ACTIVITIES (curated community experiences) ==============

class ActivityCreateRequest(BaseModel):
    title: str
    description: str
    country: str
    city: str
    venue: Optional[str] = ""
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    cost_amount: float = 0
    cost_currency: str = "USD"
    cost_note: Optional[str] = ""
    max_participants: Optional[int] = None
    cover_image: Optional[str] = None
    category: Optional[str] = "experience"

ACTIVITY_CATEGORIES = ["dinner", "concert", "travel", "holiday", "experience"]


@api_router.post("/activities")
async def create_activity(payload: ActivityCreateRequest, current_user: dict = Depends(get_current_user)):
    if payload.country not in AFRICAN_REGIONS:
        raise HTTPException(status_code=400, detail="Unknown country")
    if payload.cost_currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail="Unsupported currency")
    if payload.category and payload.category not in ACTIVITY_CATEGORIES:
        raise HTTPException(status_code=400, detail="Unknown category")

    activity = {
        "id": str(uuid.uuid4()),
        "creator_id": current_user["id"],
        "creator_username": current_user["username"],
        "creator_photo": current_user.get("photo", ""),
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "country": payload.country,
        "country_label": AFRICAN_REGIONS[payload.country]["label"],
        "city": payload.city,
        "city_label": _humanize(payload.city),
        "venue": (payload.venue or "").strip(),
        "date": payload.date,
        "time": payload.time,
        "cost_amount": float(payload.cost_amount or 0),
        "cost_currency": payload.cost_currency,
        "cost_note": payload.cost_note or "",
        "max_participants": payload.max_participants,
        "cover_image": payload.cover_image or None,
        "category": payload.category or "experience",
        "participants": [],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.activities.insert_one(activity)
    activity.pop("_id", None)
    try:
        await award_points(current_user["id"], "activity_created", 0, source_id=activity["id"], message="Created an Activity")
    except Exception:
        pass
    return activity


@api_router.get("/activities")
async def list_activities(country: Optional[str] = None, city: Optional[str] = None, category: Optional[str] = None, limit: int = 60):
    q: Dict[str, Any] = {"status": "active"}
    if country:
        q["country"] = country
    if city:
        q["city"] = city
    if category:
        q["category"] = category
    rows = await db.activities.find(q, {"_id": 0}).sort([("date", 1), ("created_at", -1)]).to_list(limit)
    return {"activities": rows, "total": len(rows)}


@api_router.get("/activities/{activity_id}")
async def get_activity(activity_id: str):
    a = await db.activities.find_one({"id": activity_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Activity not found")
    return a


@api_router.post("/activities/{activity_id}/join")
async def join_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    a = await db.activities.find_one({"id": activity_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Activity not found")
    if any(p.get("user_id") == current_user["id"] for p in a.get("participants", [])):
        return {"already_joined": True}
    if a.get("max_participants") and len(a.get("participants", [])) >= a["max_participants"]:
        raise HTTPException(status_code=400, detail="Activity is full")
    entry = {
        "user_id": current_user["id"],
        "username": current_user["username"],
        "photo": current_user.get("photo", ""),
        "joined_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.activities.update_one({"id": activity_id}, {"$push": {"participants": entry}})
    try:
        await award_points(current_user["id"], "activity_joined", 25, source_id=activity_id, message="Joined an Activity")
    except Exception:
        pass
    return {"joined": True}


@api_router.post("/activities/{activity_id}/leave")
async def leave_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    await db.activities.update_one({"id": activity_id}, {"$pull": {"participants": {"user_id": current_user["id"]}}})
    return {"left": True}


@api_router.delete("/activities/{activity_id}")
async def delete_activity(activity_id: str, current_user: dict = Depends(get_current_user)):
    a = await db.activities.find_one({"id": activity_id}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Activity not found")
    if a["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can delete this Activity")
    await db.activities.delete_one({"id": activity_id})
    return {"deleted": True}


# ============== EXPLORE ==============

@api_router.get("/explore")
async def explore_feed(limit: int = 60, current_user: dict = Depends(get_current_user)):
    """Top recent posts ranked by likes + shares × 2 over the last 14 days. Visual content first."""
    since = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    posts = await db.posts.find(
        {"created_at": {"$gte": since}}, {"_id": 0}
    ).to_list(500)
    def score(p):
        likes = len(p.get("likes", []))
        shares = p.get("shares", 0)
        has_media = 1 if (p.get("image") or p.get("video")) else 0
        return likes + shares * 2 + has_media * 5
    posts.sort(key=score, reverse=True)
    return {"posts": posts[:limit]}


# ============== NOTIFICATIONS ==============

@api_router.get("/notifications")
async def list_notifications(limit: int = 50, current_user: dict = Depends(get_current_user)):
    rows = await db.notifications.find(
        {"user_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    unread = sum(1 for r in rows if not r.get("read"))
    return {"notifications": rows, "unread_count": unread}

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    return {"read": True}

@api_router.post("/notifications/read-all")
async def mark_all_read(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"all_read": True}


# ============== LIVE FX RATES ==============

@api_router.post("/admin/refresh-fx")
async def refresh_fx_rates(_: bool = Depends(verify_admin)):
    """Pulls live FX rates from exchangerate.host (no API key required) and overrides static rates in memory."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            symbols = ",".join(c for c in SUPPORTED_CURRENCIES if c != "USD")
            r = await client.get(f"https://api.exchangerate.host/latest?base=USD&symbols={symbols}")
            data = r.json()
        rates = data.get("rates", {})
        updated = 0
        for code, val in rates.items():
            if code in SUPPORTED_CURRENCIES and isinstance(val, (int, float)) and val > 0:
                SUPPORTED_CURRENCIES[code]["rate"] = round(float(val), 4)
                updated += 1
        return {"updated": updated, "rates": {k: v["rate"] for k, v in SUPPORTED_CURRENCIES.items()}}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"FX fetch failed: {e}")


# ============== HUB PULSE ==============

@api_router.get("/hubs/pulse")
async def hub_pulse(city: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Live activity stats for a city: new members this week, active stokvels, recent connections."""
    target_city = city or current_user.get("city")
    if not target_city:
        return {"city": None, "stats": None}

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    new_members_week = await db.users.count_documents({
        "city": target_city, "created_at": {"$gte": week_ago}
    })
    new_members_month = await db.users.count_documents({
        "city": target_city, "created_at": {"$gte": month_ago}
    })
    total_in_city = await db.users.count_documents({"city": target_city})

    # Active stokvels: ones with members from this city
    user_ids_in_city = [u["id"] async for u in db.users.find({"city": target_city}, {"_id": 0, "id": 1})]
    active_stokvels = 0
    if user_ids_in_city:
        active_stokvels = await db.stokvels.count_documents({
            "members.user_id": {"$in": user_ids_in_city}
        })

    # Connections this week (in or out, where one of the parties is in this city)
    connections_week = 0
    if user_ids_in_city:
        connections_week = await db.connections.count_documents({
            "$or": [
                {"from_user_id": {"$in": user_ids_in_city}},
                {"to_user_id": {"$in": user_ids_in_city}},
            ],
            "status": "accepted",
            "created_at": {"$gte": week_ago},
        })

    return {
        "city": target_city,
        "stats": {
            "total_members": total_in_city,
            "new_members_week": new_members_week,
            "new_members_month": new_members_month,
            "active_stokvels": active_stokvels,
            "connections_week": connections_week,
        }
    }


# ============== REGIONAL HUBS ==============

# African countries with curated province + city lists. Used for signup,
# Hub filtering, and profile location.
AFRICAN_REGIONS = {
    "south_africa": {
        "label": "South Africa",
        "provinces": {
            "gauteng": {"label": "Gauteng", "cities": ["johannesburg", "pretoria", "midrand", "soweto", "centurion"]},
            "western_cape": {"label": "Western Cape", "cities": ["cape_town", "stellenbosch", "paarl", "george"]},
            "kwazulu_natal": {"label": "KwaZulu-Natal", "cities": ["durban", "pietermaritzburg", "richards_bay"]},
            "eastern_cape": {"label": "Eastern Cape", "cities": ["port_elizabeth", "east_london", "mthatha"]},
            "free_state": {"label": "Free State", "cities": ["bloemfontein", "welkom", "bethlehem"]},
            "limpopo": {"label": "Limpopo", "cities": ["polokwane", "tzaneen", "thohoyandou"]},
            "mpumalanga": {"label": "Mpumalanga", "cities": ["nelspruit", "witbank", "secunda"]},
            "north_west": {"label": "North West", "cities": ["mahikeng", "rustenburg", "potchefstroom"]},
            "northern_cape": {"label": "Northern Cape", "cities": ["kimberley", "upington", "kuruman"]},
        },
    },
    "nigeria": {
        "label": "Nigeria",
        "provinces": {
            "lagos": {"label": "Lagos State", "cities": ["lagos", "ikeja", "ikorodu", "lekki"]},
            "fct": {"label": "Federal Capital Territory", "cities": ["abuja", "gwagwalada", "kuje"]},
            "rivers": {"label": "Rivers", "cities": ["port_harcourt", "obio_akpor"]},
            "oyo": {"label": "Oyo", "cities": ["ibadan", "ogbomosho"]},
            "kano": {"label": "Kano", "cities": ["kano", "wudil"]},
            "kaduna": {"label": "Kaduna", "cities": ["kaduna", "zaria"]},
        },
    },
    "kenya": {
        "label": "Kenya",
        "provinces": {
            "nairobi": {"label": "Nairobi County", "cities": ["nairobi", "westlands", "embakasi"]},
            "mombasa": {"label": "Mombasa County", "cities": ["mombasa", "nyali"]},
            "kisumu": {"label": "Kisumu County", "cities": ["kisumu", "ahero"]},
            "nakuru": {"label": "Nakuru County", "cities": ["nakuru", "naivasha"]},
            "kiambu": {"label": "Kiambu County", "cities": ["thika", "ruiru", "kiambu"]},
        },
    },
    "ghana": {
        "label": "Ghana",
        "provinces": {
            "greater_accra": {"label": "Greater Accra", "cities": ["accra", "tema", "madina"]},
            "ashanti": {"label": "Ashanti", "cities": ["kumasi", "obuasi"]},
            "western": {"label": "Western", "cities": ["takoradi", "sekondi"]},
            "northern": {"label": "Northern", "cities": ["tamale", "yendi"]},
        },
    },
    "zimbabwe": {
        "label": "Zimbabwe",
        "provinces": {
            "harare": {"label": "Harare Province", "cities": ["harare", "chitungwiza"]},
            "bulawayo": {"label": "Bulawayo", "cities": ["bulawayo"]},
            "manicaland": {"label": "Manicaland", "cities": ["mutare", "rusape"]},
            "midlands": {"label": "Midlands", "cities": ["gweru", "kwekwe"]},
        },
    },
    "tanzania": {
        "label": "Tanzania",
        "provinces": {
            "dar_es_salaam": {"label": "Dar es Salaam", "cities": ["dar_es_salaam", "kinondoni"]},
            "mwanza": {"label": "Mwanza", "cities": ["mwanza"]},
            "arusha": {"label": "Arusha", "cities": ["arusha"]},
            "dodoma": {"label": "Dodoma", "cities": ["dodoma"]},
        },
    },
    "uganda": {
        "label": "Uganda",
        "provinces": {
            "central": {"label": "Central", "cities": ["kampala", "wakiso", "entebbe"]},
            "eastern": {"label": "Eastern", "cities": ["jinja", "mbale"]},
            "western": {"label": "Western", "cities": ["mbarara", "fort_portal"]},
            "northern": {"label": "Northern", "cities": ["gulu", "lira"]},
        },
    },
    "senegal": {
        "label": "Senegal",
        "provinces": {
            "dakar": {"label": "Dakar Region", "cities": ["dakar", "pikine", "guediawaye"]},
            "thies": {"label": "Thiès Region", "cities": ["thies", "mbour"]},
            "saint_louis": {"label": "Saint-Louis", "cities": ["saint_louis"]},
        },
    },
    "egypt": {
        "label": "Egypt",
        "provinces": {
            "cairo": {"label": "Cairo Governorate", "cities": ["cairo", "helwan", "new_cairo"]},
            "alexandria": {"label": "Alexandria Governorate", "cities": ["alexandria"]},
            "giza": {"label": "Giza Governorate", "cities": ["giza", "6th_october"]},
        },
    },
    "morocco": {
        "label": "Morocco",
        "provinces": {
            "casablanca_settat": {"label": "Casablanca-Settat", "cities": ["casablanca", "mohammedia"]},
            "rabat_sale_kenitra": {"label": "Rabat-Salé-Kénitra", "cities": ["rabat", "sale", "kenitra"]},
            "marrakech_safi": {"label": "Marrakech-Safi", "cities": ["marrakech", "safi"]},
        },
    },
    "ethiopia": {
        "label": "Ethiopia",
        "provinces": {
            "addis_ababa": {"label": "Addis Ababa", "cities": ["addis_ababa"]},
            "oromia": {"label": "Oromia", "cities": ["adama", "jimma"]},
            "amhara": {"label": "Amhara", "cities": ["bahir_dar", "gondar"]},
        },
    },
    "rwanda": {
        "label": "Rwanda",
        "provinces": {
            "kigali": {"label": "Kigali", "cities": ["kigali", "nyarugenge", "gasabo"]},
            "northern": {"label": "Northern", "cities": ["musanze"]},
            "southern": {"label": "Southern", "cities": ["huye", "muhanga"]},
        },
    },
    "other": {"label": "Other African Country", "provinces": {"other": {"label": "Other", "cities": ["other"]}}},
}


def _humanize(slug: str) -> str:
    return slug.replace("_", " ").replace("6th october", "6th October").title()


@api_router.get("/hubs/regions")
async def list_regions():
    """Country → Province → City catalogue (Africa)."""
    out = []
    for country_slug, country in AFRICAN_REGIONS.items():
        provinces = []
        for prov_slug, prov in country["provinces"].items():
            provinces.append({
                "value": prov_slug,
                "label": prov["label"],
                "cities": [{"value": c, "label": _humanize(c)} for c in prov["cities"]],
            })
        out.append({"value": country_slug, "label": country["label"], "provinces": provinces})
    return {"countries": out}


@api_router.get("/hubs/cities")
async def list_cities():
    """Curated city list across all African regions + auto-discovered cities."""
    curated = []
    seen = set()
    for country_slug, country in AFRICAN_REGIONS.items():
        for prov_slug, prov in country["provinces"].items():
            for city in prov["cities"]:
                if city in seen:
                    continue
                seen.add(city)
                curated.append({
                    "value": city,
                    "label": _humanize(city),
                    "country": country_slug,
                    "country_label": country["label"],
                    "province": prov_slug,
                })
    # Stats per city (count of users)
    pipeline = [
        {"$match": {"city": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
    ]
    counts_raw = await db.users.aggregate(pipeline).to_list(500)
    counts = {c["_id"]: c["count"] for c in counts_raw if c["_id"]}
    for c in curated:
        c["user_count"] = counts.get(c["value"], 0)
    return {"cities": curated}

@api_router.get("/hubs/users")
async def list_hub_users(city: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """List users in a city (excluding self). If no city provided, uses caller's city."""
    target_city = city or current_user.get("city")
    if not target_city:
        return {"users": [], "city": None, "message": "Set your city to discover the hub"}
    users = await db.users.find(
        {"city": target_city, "id": {"$ne": current_user["id"]}},
        {"_id": 0, "password": 0, "photos": 0, "videos": 0, "articles": 0}
    ).limit(200).to_list(200)
    # Enrich with existing-connection status
    sent = await db.connections.find(
        {"from_user_id": current_user["id"]}, {"_id": 0, "to_user_id": 1, "type": 1, "status": 1}
    ).to_list(500)
    incoming = await db.connections.find(
        {"to_user_id": current_user["id"]}, {"_id": 0, "from_user_id": 1, "type": 1, "status": 1}
    ).to_list(500)
    sent_map = {(s["to_user_id"], s["type"]): s["status"] for s in sent}
    incoming_map = {(s["from_user_id"], s["type"]): s["status"] for s in incoming}
    for u in users:
        u["connection_status"] = {
            t: sent_map.get((u["id"], t)) or incoming_map.get((u["id"], t))
            for t in ["social", "financial", "professional"]
        }
    return {"users": users, "city": target_city, "total": len(users)}

# ============== CONNECTIONS ==============
# (Legacy POST /api/connections/request handler removed in iter 25 — the iter25
#  handler at the bottom of this file using {target_user_id, kind} is now the
#  single canonical entrypoint. The legacy inbox/respond endpoints below are
#  kept for back-compat — they continue to operate on the same `connections`
#  collection.)

@api_router.get("/connections/inbox")
async def connection_inbox(type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"to_user_id": current_user["id"], "status": "pending"}
    if type and type in ["social", "financial", "professional"]:
        query["type"] = type
    inbox = await db.connections.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"inbox": inbox, "total": len(inbox)}

@api_router.get("/connections/outbox")
async def connection_outbox(type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = {"from_user_id": current_user["id"]}
    if type and type in ["social", "financial", "professional"]:
        query["type"] = type
    outbox = await db.connections.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"outbox": outbox, "total": len(outbox)}

@api_router.get("/connections")
async def list_my_connections(type: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Accepted connections (both directions)."""
    user_id = current_user["id"]
    query = {
        "$or": [{"from_user_id": user_id}, {"to_user_id": user_id}],
        "status": "accepted",
    }
    if type and type in ["social", "financial", "professional"]:
        query["type"] = type
    rows = await db.connections.find(query, {"_id": 0}).sort("responded_at", -1).to_list(500)
    # Normalize the "other" user
    out = []
    for r in rows:
        is_outbound = r["from_user_id"] == user_id
        out.append({
            **r,
            "other_user_id": r["to_user_id"] if is_outbound else r["from_user_id"],
            "other_username": r["to_username"] if is_outbound else r["from_username"],
            "other_photo": "" if is_outbound else r.get("from_photo", ""),
        })
    return {"connections": out, "total": len(out)}

# Legacy /connections/{id}/accept and /connections/{id}/reject handlers removed
# in iter 25 — see new handlers near end of file (request_connection /
# accept_connection / reject_connection use {target_user_id, kind} schema and
# award +25 connection_made to both sides).


# ============== PROFILE MEDIA: Photos / Videos / Articles ==============
# ============== DIRECT MESSAGES ==============

BLOCKED_COMPLIANCE_WORDS = {
    "invest": "contribute",
    "invests": "contributes",
    "investing": "backing",
    "invested": "contributed",
    "investment": "contribution",
    "investments": "contributions",
    "investor": "supporter",
    "investors": "supporters",
    "profit": "support",
    "profits": "rewards",
    "profitable": "rewarding",
    "return": "reward",
    "returns": "rewards",
    "interest": "support",
    "guaranteed": "planned",
    "guarantee": "intention",
}

DM_MAX_MEDIA_BYTES = 3 * 1024 * 1024  # ~3MB base64


def compliance_scan(text: str) -> List[Dict[str, Any]]:
    """Return [{word, suggestion}, ...] for any blocked word (case-insensitive, word-boundary)."""
    if not text:
        return []
    import re as _re
    flags = []
    lower = text.lower()
    for word, suggestion in BLOCKED_COMPLIANCE_WORDS.items():
        if _re.search(rf"\b{_re.escape(word)}\b", lower):
            flags.append({"word": word, "suggestion": suggestion})
    # De-dup by word preserving order
    seen = set()
    out = []
    for f in flags:
        if f["word"] in seen:
            continue
        seen.add(f["word"])
        out.append(f)
    return out


def _thread_key(a: str, b: str) -> str:
    return ":".join(sorted([a, b]))


class DMSendRequest(BaseModel):
    recipient_id: str
    text: Optional[str] = ""
    image: Optional[str] = None     # base64 data URL
    audio: Optional[str] = None     # base64 audio data URL (voice note)
    shared_post_id: Optional[str] = None


class ComplianceCheckRequest(BaseModel):
    text: str


@api_router.post("/dm/compliance-check")
async def dm_compliance_check(payload: ComplianceCheckRequest, current_user: dict = Depends(get_current_user)):
    """Client calls this before sending to get a soft warning. Server still re-checks on send."""
    return {"flags": compliance_scan(payload.text or "")}


@api_router.post("/dm/send")
async def dm_send(payload: DMSendRequest, current_user: dict = Depends(get_current_user)):
    if payload.recipient_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")
    recipient = await db.users.find_one({"id": payload.recipient_id}, {"_id": 0})
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")

    text = (payload.text or "").strip()
    if not any([text, payload.image, payload.audio, payload.shared_post_id]):
        raise HTTPException(status_code=400, detail="Message is empty")

    # Size guards
    for field_name, field_val in (("image", payload.image), ("audio", payload.audio)):
        if field_val and len(field_val) > int(DM_MAX_MEDIA_BYTES * 1.4):
            raise HTTPException(status_code=413, detail=f"{field_name} too large (max ~3MB)")

    # Resolve shared_post preview (denormalized snapshot)
    shared_post_preview = None
    if payload.shared_post_id:
        p = await db.posts.find_one({"id": payload.shared_post_id}, {"_id": 0})
        if p:
            shared_post_preview = {
                "id": p["id"],
                "user_id": p.get("user_id"),
                "username": p.get("username"),
                "user_photo": p.get("user_photo", ""),
                "content": (p.get("content") or "")[:240],
                "image": p.get("image"),
                "video": p.get("video"),
                "is_auto_narrated": bool(p.get("is_auto_narrated")),
            }

    flags = compliance_scan(text)

    thread_key = _thread_key(current_user["id"], payload.recipient_id)
    now = datetime.now(timezone.utc).isoformat()
    msg = {
        "id": str(uuid.uuid4()),
        "thread_key": thread_key,
        "sender_id": current_user["id"],
        "sender_username": current_user["username"],
        "sender_photo": current_user.get("photo", ""),
        "recipient_id": payload.recipient_id,
        "text": text,
        "image": payload.image or None,
        "audio": payload.audio or None,
        "shared_post": shared_post_preview,
        "compliance_warnings": flags,
        "created_at": now,
    }
    await db.dm_messages.insert_one(msg)

    # Upsert thread cache (lightweight — used for list view)
    await db.dm_threads.update_one(
        {"thread_key": thread_key},
        {"$set": {
            "thread_key": thread_key,
            "participants": sorted([current_user["id"], payload.recipient_id]),
            "last_message_id": msg["id"],
            "last_text": text or ("📎 media" if (payload.image or payload.audio or payload.shared_post_id) else ""),
            "last_sender_id": current_user["id"],
            "last_at": now,
        }},
        upsert=True,
    )
    # strip Mongo _id before returning
    msg.pop("_id", None)
    return {"message": msg, "compliance_warnings": flags}


@api_router.get("/dm/threads")
async def dm_threads(current_user: dict = Depends(get_current_user)):
    """List all threads for current user, newest first."""
    uid = current_user["id"]
    rows = await db.dm_threads.find(
        {"participants": uid}, {"_id": 0}
    ).sort("last_at", -1).to_list(200)
    out = []
    for t in rows:
        other_id = next((p for p in t["participants"] if p != uid), None)
        if not other_id:
            continue
        other = await db.users.find_one({"id": other_id}, {"_id": 0, "username": 1, "photo": 1, "full_name": 1})
        if not other:
            continue
        out.append({
            "thread_key": t["thread_key"],
            "other_user_id": other_id,
            "other_username": other.get("username"),
            "other_full_name": other.get("full_name"),
            "other_photo": other.get("photo", ""),
            "last_text": t.get("last_text", ""),
            "last_at": t.get("last_at"),
            "last_sender_id": t.get("last_sender_id"),
        })
    return {"threads": out, "total": len(out)}


@api_router.get("/dm/threads/{other_user_id}")
async def dm_thread_messages(
    other_user_id: str,
    limit: int = 200,
    current_user: dict = Depends(get_current_user),
):
    """Get messages for the thread between current_user and other_user_id.
    Also returns the other user's public profile for headers."""
    if other_user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot DM yourself")
    other = await db.users.find_one({"id": other_user_id}, {"_id": 0, "password": 0})
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    thread_key = _thread_key(current_user["id"], other_user_id)
    msgs = await db.dm_messages.find(
        {"thread_key": thread_key}, {"_id": 0}
    ).sort("created_at", 1).to_list(limit)
    return {
        "thread_key": thread_key,
        "other_user": {
            "id": other["id"],
            "username": other.get("username"),
            "full_name": other.get("full_name"),
            "photo": other.get("photo", ""),
            "network_score": other.get("network_score", 0),
        },
        "messages": msgs,
    }



MAX_MEDIA_BYTES = 11 * 1024 * 1024  # 11MB raw cap. base64 ≈ 15MB; MongoDB BSON ceiling is 16MB per document — this is the practical maximum until we migrate to S3/R2.

def _validate_media_size(data_url: str):
    if not data_url or not isinstance(data_url, str):
        raise HTTPException(status_code=400, detail="data_url required")
    # Rough size guard (base64 length ~ 1.37x raw bytes)
    if len(data_url) > MAX_MEDIA_BYTES * 1.4:
        raise HTTPException(status_code=413, detail="File too large (max 11MB)")

@api_router.post("/users/me/photos")
async def upload_photo(payload: MediaUpload, current_user: dict = Depends(get_current_user)):
    _validate_media_size(payload.data_url)
    photo = {
        "id": str(uuid.uuid4()),
        "data_url": payload.data_url,
        "caption": payload.caption or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"photos": {"$each": [photo], "$position": 0, "$slice": 50}}}
    )
    return {"photo": photo}

@api_router.delete("/users/me/photos/{photo_id}")
async def delete_photo(photo_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"photos": {"id": photo_id}}}
    )
    return {"message": "Deleted"}

@api_router.get("/users/{user_id}/photos")
async def list_photos(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "photos": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"photos": user.get("photos", [])}

@api_router.post("/users/me/videos")
async def upload_video(payload: MediaUpload, current_user: dict = Depends(get_current_user)):
    _validate_media_size(payload.data_url)
    video = {
        "id": str(uuid.uuid4()),
        "data_url": payload.data_url,
        "caption": payload.caption or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"videos": {"$each": [video], "$position": 0, "$slice": 20}}}
    )
    return {"video": video}

@api_router.delete("/users/me/videos/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"videos": {"id": video_id}}}
    )
    return {"message": "Deleted"}

@api_router.get("/users/{user_id}/videos")
async def list_videos(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "videos": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"videos": user.get("videos", [])}

@api_router.post("/users/me/articles")
async def create_article(payload: ArticleCreate, current_user: dict = Depends(get_current_user)):
    if not payload.title.strip() or not payload.content.strip():
        raise HTTPException(status_code=400, detail="Title and content required")
    article = {
        "id": str(uuid.uuid4()),
        "title": payload.title.strip(),
        "content": payload.content.strip(),
        "cover_image": payload.cover_image or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$push": {"articles": {"$each": [article], "$position": 0, "$slice": 100}}}
    )
    return {"article": article}

@api_router.delete("/users/me/articles/{article_id}")
async def delete_article(article_id: str, current_user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$pull": {"articles": {"id": article_id}}}
    )
    return {"message": "Deleted"}

@api_router.get("/users/{user_id}/articles")
async def list_articles(user_id: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "articles": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"articles": user.get("articles", [])}

@api_router.post("/posts", response_model=Post)
async def create_post(request: CreatePostRequest, current_user: dict = Depends(get_current_user)):
    # Size guards — base64 inflates ~1.37x; cap at MAX_MEDIA_BYTES * 1.4 ≈ 15MB which is under
    # MongoDB's 16MB BSON document limit. Frontend enforces 11MB raw per file.
    if request.image and len(request.image) > MAX_MEDIA_BYTES * 1.4:
        raise HTTPException(status_code=413, detail="Image is too large. Maximum allowed size is 11MB.")
    if request.video and len(request.video) > MAX_MEDIA_BYTES * 1.4:
        raise HTTPException(status_code=413, detail="Video is too large. Maximum allowed size is 11MB.")
    # Only admins/moderators can flag a post as "official" (broadcasts to all users).
    is_official = bool(request.is_official) and current_user.get("role") in ("admin", "moderator")
    post_id = str(uuid.uuid4())
    post_data = {
        "id": post_id,
        "user_id": current_user["id"],
        "username": current_user.get("username") or "",
        "user_photo": current_user.get("photo") or "",
        "user_score": current_user.get("network_score") or 0,
        "content": request.content,
        "image": request.image,
        "video": request.video,
        "hashtags": extract_hashtags(request.content),
        "mentions": extract_mentions(request.content),
        "likes": [],
        "comments": [],
        "shares": 0,
        "is_official": is_official,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.posts.insert_one(post_data)
    await award_points(current_user["id"], "post_create", 0, source_id=post_data["id"], message="Posted new content")

    # Fire-and-forget broadcast email fan-out for official posts.
    if is_official:
        try:
            asyncio.create_task(_broadcast_official_post(post_data))
        except Exception:  # noqa: BLE001
            pass

    # Referral first-post bonus (+150) — fires once if invitee posts within their first 7 days
    try:
        attribution = current_user.get("referral_attribution") or {}
        referrer_id = attribution.get("referrer_id")
        if referrer_id:
            created_at_str = current_user.get("created_at")
            if created_at_str:
                created_at = datetime.fromisoformat(str(created_at_str).replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - created_at).days <= 7:
                    already = await db.score_events.find_one({
                        "user_id": referrer_id,
                        "action": "referral_first_post",
                        "source_id": current_user["id"],
                    })
                    if not already:
                        await award_points(
                            referrer_id, "referral_first_post", 0,
                            source_id=current_user["id"],
                            message=f"Bonus — @{current_user['username']} posted in their first 7 days",
                        )
    except Exception:
        pass

    return post_data


class EditPostRequest(BaseModel):
    content: str


def _extract_hashtags(text: str) -> List[str]:
    """Extract #hashtags from text (lowercase, no '#'). Mirrors create_post extraction."""
    import re as _re
    return list({m.lower() for m in _re.findall(r"#([\w]+)", text or "")})


@api_router.patch("/posts/{post_id}", response_model=Post)
async def edit_post(post_id: str, payload: EditPostRequest, current_user: dict = Depends(get_current_user)):
    """Author-only edit of a post's text. Re-extracts hashtags. Adds an `edited_at` timestamp.
    Score is NOT changed on edit (only on delete) to keep the cost of fixing a typo zero."""
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own posts")

    new_content = (payload.content or "").strip()
    if not new_content:
        raise HTTPException(status_code=400, detail="Post content cannot be empty")
    if len(new_content) > 5000:
        raise HTTPException(status_code=400, detail="Post is too long (max 5,000 characters)")

    update = {
        "content": new_content,
        "hashtags": _extract_hashtags(new_content),
        "edited_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.posts.update_one({"id": post_id}, {"$set": update})
    refreshed = await db.posts.find_one({"id": post_id}, {"_id": 0})
    return refreshed


@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Author-only delete. Cascades:
       • revokes the author's +50 post_create score
       • revokes every commenter's comment_quality score for this post
       • revokes every liker's post_like score for this post
       • removes the post (and its comments / likes) from the feed
    """
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    revoked_total = 0

    # 1) Revoke the author's post_create points
    revoked_total += await revoke_score_event(current_user["id"], "post_create", post_id)

    # 2) Revoke every commenter's comment_quality points
    for c in (post.get("comments") or []):
        if c.get("user_id"):
            revoked_total += await revoke_score_event(c["user_id"], "comment_quality", post_id)

    # 3) Revoke every liker's post_like points
    for liker_id in (post.get("likes") or []):
        revoked_total += await revoke_score_event(liker_id, "post_like", post_id)

    await db.posts.delete_one({"id": post_id})
    return {"deleted": True, "score_revoked": revoked_total}


@api_router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_comment(post_id: str, comment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a comment. Allowed by:
       • the comment's author (revokes their own comment_quality points)
       • OR the post owner (moderation — also revokes the commenter's points)
    """
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comments = post.get("comments") or []
    target = next((c for c in comments if c.get("id") == comment_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_comment_author = target.get("user_id") == current_user["id"]
    is_post_owner = post["user_id"] == current_user["id"]
    if not (is_comment_author or is_post_owner):
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    # Revoke comment_quality score from the comment author (if any was awarded)
    revoked = await revoke_score_event(target.get("user_id"), "comment_quality", post_id)

    new_comments = [c for c in comments if c.get("id") != comment_id]
    await db.posts.update_one({"id": post_id}, {"$set": {"comments": new_comments}})
    return {"deleted": True, "score_revoked": revoked}

@api_router.get("/posts", response_model=List[Post])
async def get_posts(skip: int = 0, limit: int = 20):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return await _enrich_posts_with_live_score(posts)


async def _enrich_posts_with_live_score(posts: List[dict]) -> List[dict]:
    """Replace the denormalised `user_score` on each post with the author's
    current `network_score`.  This fixes the Feed-vs-Profile drift where the
    chip on the post header would lag behind the user's actual score until they
    posted again.  Idempotent and safe on empty input."""
    if not posts:
        return posts
    author_ids = list({p.get("user_id") for p in posts if p.get("user_id")})
    if not author_ids:
        return posts
    rows = await db.users.find(
        {"id": {"$in": author_ids}},
        {"_id": 0, "id": 1, "network_score": 1, "username": 1, "photo": 1},
    ).to_list(length=None)
    by_id = {r["id"]: r for r in rows}
    for p in posts:
        live = by_id.get(p.get("user_id"))
        if live:
            p["user_score"] = int(live.get("network_score") or 0)
            # Also refresh the username/photo snapshots so renames propagate.
            if live.get("username"):
                p["username"] = live["username"]
            if live.get("photo"):
                p["user_photo"] = live["photo"]
    return posts

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    likes = post.get("likes", [])
    if current_user["id"] in likes:
        likes.remove(current_user["id"])
        await db.posts.update_one({"id": post_id}, {"$set": {"likes": likes}})
        # Un-liking revokes the +5 the user earned for this like (anti-abuse: like→unlike→relike loops)
        await revoke_score_event(current_user["id"], "post_like", post_id)
        return {"liked": False, "likes_count": len(likes)}
    else:
        likes.append(current_user["id"])
        await db.posts.update_one({"id": post_id}, {"$set": {"likes": likes}})

        # T3: liking a post earns 5 pts (cap 20/day, 24h cooldown on the same post)
        if post["user_id"] != current_user["id"]:
            await award_points(
                current_user["id"], "post_like", 0,
                source_id=post_id,
                message="You liked a post",
            )

        return {"liked": True, "likes_count": len(likes)}

@api_router.post("/posts/{post_id}/comment")
async def comment_post(post_id: str, request: CommentRequest, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    content = (request.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    # AI relevance scoring (mocked LLM gracefully fallbacks to heuristic if unavailable)
    relevance = await _score_comment_relevance(post.get("content", ""), content, current_user["id"])

    comment = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_photo": current_user["photo"],
        "content": content,
        "ai_relevance": relevance.get("score"),
        "quality": relevance.get("quality"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    comments = post.get("comments", [])
    comments.append(comment)
    await db.posts.update_one({"id": post_id}, {"$set": {"comments": comments}})

    # T3: quality comment earns 30 pts (cap 10/day) only if AI relevance ≥ 0.6
    awarded = 0
    if relevance.get("quality") == "quality" and post["user_id"] != current_user["id"]:
        awarded = await award_points(
            current_user["id"], "comment_quality", 0,
            source_id=post_id,
            message="Quality comment",
        )

    return {**comment, "awarded": awarded, "ai_score": relevance.get("score"), "ai_flag": relevance.get("flag")}

@api_router.post("/posts/{post_id}/share")
async def share_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    shares = post.get("shares", 0) + 1
    await db.posts.update_one({"id": post_id}, {"$set": {"shares": shares}})

    # T3: sharing another user's post earns 20 pts (cap 10/day; 24h cooldown on same post).
    # Self-shares don't earn points.
    awarded = 0
    if post["user_id"] != current_user["id"]:
        awarded = await award_points(
            current_user["id"], "post_share", 0,
            source_id=post_id,
            message="You shared a post",
        )

    return {"shares": shares, "awarded": awarded}

@api_router.get("/leaderboard", response_model=List[User])
async def get_leaderboard(skip: int = 0, limit: int = 50):
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("network_score", -1).skip(skip).limit(limit).to_list(limit)
    return users

@api_router.post("/referral/{referral_code}")
async def use_referral(referral_code: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("referred_by"):
        raise HTTPException(status_code=400, detail="Already used a referral code")
    
    referrer = await db.users.find_one({"referral_code": referral_code}, {"_id": 0})
    if not referrer or referrer["id"] == current_user["id"]:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"referred_by": referrer["id"]}})
    await update_user_score(referrer["id"], SCORE_TABLE["referral_joined"], f"{current_user['username']} joined using your referral", action="referral_joined")
    
    return {"message": "Referral applied successfully"}

@api_router.get("/notifications", response_model=List[NotificationModel])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": notification_id, "user_id": current_user["id"]}, {"$set": {"read": True}})
    return {"message": "Notification marked as read"}

@api_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(current_user: dict = Depends(get_current_user)):
    # Optimized: Only fetch required fields
    posts = await db.posts.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0, "likes": 1, "comments": 1, "shares": 1}
    ).to_list(1000)
    
    total_likes = sum(len(post.get("likes", [])) for post in posts)
    total_comments = sum(len(post.get("comments", [])) for post in posts)
    total_shares = sum(post.get("shares", 0) for post in posts)
    
    referrals_count = await db.users.count_documents({"referred_by": current_user["id"]})
    
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_notifications = await db.notifications.find({
        "user_id": current_user["id"],
        "created_at": {"$gte": one_week_ago.isoformat()}
    }, {"_id": 0}).to_list(1000)
    
    weekly_growth = sum(n.get("points", 0) for n in week_notifications)
    
    return {
        "current_score": current_user["network_score"],
        "weekly_growth": weekly_growth,
        "rank": current_user["rank"],
        "total_posts": len(posts),
        "total_likes": total_likes,
        "total_comments": total_comments,
        "total_shares": total_shares,
        "total_referrals": referrals_count
    }

# Wallet endpoints
@api_router.get("/wallet")
async def get_wallet(current_user: dict = Depends(get_current_user)):
    """Return the user's wallet snapshot. Hardened to NEVER 500 — coerces every field
    to a number and falls back to zeros if the user record can't be loaded for any
    reason. This endpoint blanking is what produced the iter36 production white-screen."""
    try:
        user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0}) or {}
    except Exception as e:
        logger.error(f"[wallet] mongo lookup failed for {current_user.get('id')}: {e}")
        user = {}
    def _num(v):
        try:
            return float(v or 0)
        except Exception:
            return 0.0
    return {
        "balance": _num(user.get("wallet_balance")),
        "total_earned": _num(user.get("total_earned")),
        "total_spent": _num(user.get("total_spent")),
        "pending": 0.0,
    }


# DEPRECATED — replaced by approved payment & admin credit-grant flows.
# Kept stub for back-compat; returns 410 GONE so any old client surfaces a clear error.
@api_router.post("/wallet/deposit")
async def deposit_funds_disabled(_: DepositRequest, current_user: dict = Depends(get_current_user)):
    """[REMOVED 2026-Q1] Self-credit endpoint disabled platform-wide.

    Per platform policy, users may no longer add credits to their own wallet.
    Wallet balances increase only via:
      • Approved payment transactions (Stripe / Paystack)
      • Approved system rewards (referrals, cashback, withdrawals)
      • Super-admin credit grants (POST /api/admin/credit-grants)
    """
    raise HTTPException(
        status_code=410,
        detail="Self-deposit is disabled. Wallet balances can only be adjusted by approved payments or the platform owner.",
    )

@api_router.get("/wallet/transactions")
async def get_transactions(current_user: dict = Depends(get_current_user)):
    """Return the user's recent wallet transactions.

    Hardened against legacy/malformed documents: any row that can't be coerced into the
    Transaction model is silently dropped rather than 500-ing the whole endpoint, which
    used to blank the entire WalletPage on production.
    """
    rows = await db.transactions.find(
        {"user_id": current_user["id"]},
        {"_id": 0},
    ).sort("created_at", -1).limit(50).to_list(50)
    out = []
    for r in rows:
        try:
            out.append(Transaction(**r).model_dump())
        except Exception:
            continue
    return out

async def deduct_wallet_balance(user_id: str, amount: float, description: str) -> bool:
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return False
    
    current_balance = user.get("wallet_balance", 0.0)
    if current_balance < amount:
        return False
    
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "user_id": user_id,
        "type": "deduction",
        "amount": -amount,
        "description": description,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    
    await db.users.update_one(
        {"id": user_id},
        {
            "$inc": {
                "wallet_balance": -amount,
                "total_spent": amount
            }
        }
    )
    
    return True

# Stokvel endpoints
STOKVEL_CREATOR_FEE = 10.0
STOKVEL_MEMBER_FEE = 2.0

@api_router.post("/stokvels", response_model=Stokvel)
async def create_stokvel(request: CreateStokvelRequest, current_user: dict = Depends(get_current_user)):
    # Stokvel+ gate — Coming Soon when the flag is off
    await _enforce_stokvel_plus_enabled()
    # Check if user has sufficient balance for creator fee
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    if user.get("wallet_balance", 0.0) < STOKVEL_CREATOR_FEE:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient balance. ${STOKVEL_CREATOR_FEE} required for Stokvel activation fee."
        )
    
    # Deduct creator fee
    fee_deducted = await deduct_wallet_balance(
        current_user["id"],
        STOKVEL_CREATOR_FEE,
        f"Stokvel+ activation fee - Creator"
    )
    
    if not fee_deducted:
        raise HTTPException(status_code=400, detail="Failed to process activation fee")
    
    stokvel_id = str(uuid.uuid4())

    ALLOWED_PURPOSES = {"savings", "holiday", "event", "gift", "group_trip", "wedding", "funeral", "other"}
    purpose = (request.purpose or "savings").strip().lower()
    if purpose not in ALLOWED_PURPOSES:
        purpose = "savings"

    stokvel_data = {
        "id": stokvel_id,
        "name": request.name,
        "description": request.description,
        "created_by": current_user["id"],
        "creator_name": current_user["username"],
        "purpose": purpose,
        "members": [{
            "user_id": current_user["id"],
            "username": current_user["username"],
            "photo": current_user["photo"],
            "joined_at": datetime.now(timezone.utc).isoformat(),
            "total_contributed": 0,
            "fee_paid": True
        }],
        "total_pool": 0,
        "target_amount": request.target_amount,
        "payout_cycle": request.payout_cycle,
        "next_payout_date": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "group_strength": 0,
        "activation_fee_paid": True,
        "members_fees_paid": {current_user["id"]: True}
    }
    
    await db.stokvels.insert_one(stokvel_data)
    await update_user_score(current_user["id"], 50, "Created a Stokvel+ group +50")
    
    return stokvel_data

@api_router.get("/stokvels", response_model=List[Stokvel])
async def get_stokvels(current_user: dict = Depends(get_current_user)):
    stokvels = await db.stokvels.find({
        "members.user_id": current_user["id"]
    }, {"_id": 0}).to_list(100)
    
    for stokvel in stokvels:
        stokvel["group_strength"] = await calculate_group_strength(stokvel["id"])
    
    return stokvels

@api_router.get("/stokvels/{stokvel_id}", response_model=Stokvel)
async def get_stokvel(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    is_member = any(m["user_id"] == current_user["id"] for m in stokvel["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    stokvel["group_strength"] = await calculate_group_strength(stokvel_id)
    return stokvel

@api_router.post("/stokvels/{stokvel_id}/invite")
async def invite_member(stokvel_id: str, request: InviteMemberRequest, current_user: dict = Depends(get_current_user)):
    await _enforce_stokvel_plus_enabled()
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    if stokvel["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only creator can invite members")
    
    # Accept user_id, username, OR friendly share_code (e.g., networkcapitalapp.maria.06.42)
    ref_in = (request.user_id or "").strip()
    if not ref_in:
        raise HTTPException(status_code=400, detail="user_id, username, or share code required")

    user = await db.users.find_one(
        {"$or": [
            {"id": ref_in},
            {"share_code": ref_in.lower()},
            {"share_code": ref_in},
            {"username": ref_in.lower()},
            {"username": ref_in},
        ]},
        {"_id": 0, "password": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    target_user_id = user["id"]

    is_already_member = any(m["user_id"] == target_user_id for m in stokvel["members"])
    if is_already_member:
        raise HTTPException(status_code=400, detail="User is already a member")

    # Check if invited user has sufficient balance for member fee
    if user.get("wallet_balance", 0.0) < STOKVEL_MEMBER_FEE:
        raise HTTPException(
            status_code=400,
            detail=f"Invited user has insufficient balance. ${STOKVEL_MEMBER_FEE} required for membership fee."
        )

    # Deduct member fee from invited user
    fee_deducted = await deduct_wallet_balance(
        target_user_id,
        STOKVEL_MEMBER_FEE,
        f"Stokvel+ membership fee - {stokvel['name']}"
    )
    
    if not fee_deducted:
        raise HTTPException(status_code=400, detail="Failed to process membership fee")
    
    new_member = {
        "user_id": user["id"],
        "username": user["username"],
        "photo": user["photo"],
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "total_contributed": 0,
        "fee_paid": True
    }
    
    await db.stokvels.update_one(
        {"id": stokvel_id},
        {
            "$push": {"members": new_member},
            "$set": {f"members_fees_paid.{user['id']}": True}
        }
    )
    
    # Award +250 once per user for first Stokvel join (idempotent via score_events)
    already_first = await db.score_events.find_one({"user_id": user["id"], "action": "stokvel_first_join"})
    if not already_first:
        await update_user_score(user["id"], SCORE_TABLE["stokvel_first_join"], f"First Stokvel joined: {stokvel['name']}", action="stokvel_first_join", source_id=stokvel_id)
    else:
        await update_user_score(user["id"], 20, f"Joined Stokvel+: {stokvel['name']}", action="stokvel_join")

    return {"message": "Member invited successfully", "fee_charged": STOKVEL_MEMBER_FEE}

@api_router.post("/stokvels/{stokvel_id}/contribute")
async def contribute_to_stokvel(stokvel_id: str, request: ContributionRequest, current_user: dict = Depends(get_current_user)):
    require_premium(current_user)
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    is_member = any(m["user_id"] == current_user["id"] for m in stokvel["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    contribution_id = str(uuid.uuid4())
    contribution_data = {
        "id": contribution_id,
        "stokvel_id": stokvel_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_photo": current_user["photo"],
        "amount": request.amount,
        "note": request.note or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.contributions.insert_one(contribution_data)
    
    # Remove MongoDB _id before returning
    contribution_data.pop("_id", None)
    
    new_total = stokvel["total_pool"] + request.amount
    await db.stokvels.update_one(
        {"id": stokvel_id},
        {"$set": {"total_pool": new_total}}
    )
    
    await db.stokvels.update_one(
        {"id": stokvel_id, "members.user_id": current_user["id"]},
        {"$inc": {"members.$.total_contributed": request.amount}}
    )
    
    await update_user_score(current_user["id"], 15, f"Contributed to Stokvel+ +15")
    
    # Auto-narrate if group just hit/crossed target
    target = stokvel.get("target_amount", 0)
    if target > 0 and new_total >= target > (new_total - request.amount):
        await _auto_post(
            current_user["id"],
            f"🎉 Our Stokvel \"{stokvel['name']}\" just reached its goal of {target:.0f}! Proud of the group. #stokvel #goalreached",
        )

    # Process rewards based on score
    await process_contribution_rewards(current_user["id"], stokvel_id, request.amount)
    
    return contribution_data

@api_router.get("/stokvels/{stokvel_id}/contributions", response_model=List[Contribution])
async def get_contributions(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    is_member = any(m["user_id"] == current_user["id"] for m in stokvel["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    contributions = await db.contributions.find(
        {"stokvel_id": stokvel_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    
    return contributions

async def calculate_group_strength(stokvel_id: str) -> int:
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        return 0
    
    score = 0
    
    # Member count (max 30 points)
    member_count = len(stokvel["members"])
    score += min(member_count * 5, 30)
    
    # Contribution activity (max 40 points) - Optimized: Use count instead of fetching all
    contribution_count = await db.contributions.count_documents({"stokvel_id": stokvel_id})
    if contribution_count > 0:
        score += min(contribution_count * 2, 40)
    
    # Pool progress (max 30 points)
    if stokvel["target_amount"] > 0:
        progress = (stokvel["total_pool"] / stokvel["target_amount"]) * 30
        score += min(int(progress), 30)
    
    return min(score, 100)

# Network Score Engine
async def calculate_contribution_consistency_score(user_id: str, stokvel_id: str) -> float:
    """Calculate consistency score (0-30 points) based on contribution regularity"""
    contributions = await db.contributions.find({
        "user_id": user_id,
        "stokvel_id": stokvel_id
    }).sort("created_at", 1).to_list(1000)
    
    if not contributions:
        return 0.0
    
    # Check for streaks and gaps
    contribution_dates = [datetime.fromisoformat(c["created_at"]) for c in contributions]
    
    # Calculate days since first contribution
    if len(contribution_dates) < 2:
        return 10.0  # New member baseline
    
    first_date = contribution_dates[0]
    last_date = contribution_dates[-1]
    days_active = (last_date - first_date).days + 1
    
    if days_active == 0:
        return 10.0
    
    # Expected contributions (assuming monthly)
    expected_contributions = max(1, days_active // 30)
    actual_contributions = len(contributions)
    
    consistency_ratio = min(actual_contributions / expected_contributions, 1.5)
    score = consistency_ratio * 20  # Max 30 points
    
    # Bonus for recent activity
    days_since_last = (datetime.now(timezone.utc) - last_date).days
    if days_since_last <= 7:
        score += 10
    elif days_since_last <= 30:
        score += 5
    
    return min(score, 30.0)

async def calculate_contribution_amount_score(user_id: str, stokvel_id: str) -> float:
    """Calculate amount score (0-20 points) based on contribution size"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        return 0.0
    
    member = next((m for m in stokvel["members"] if m["user_id"] == user_id), None)
    if not member:
        return 0.0
    
    total_contributed = member.get("total_contributed", 0)
    target_per_member = stokvel["target_amount"] / len(stokvel["members"]) if stokvel["members"] else 0
    
    if target_per_member == 0:
        return 5.0
    
    contribution_ratio = min(total_contributed / target_per_member, 2.0)
    return contribution_ratio * 10  # Max 20 points

async def calculate_engagement_score(user_id: str) -> float:
    """Calculate engagement score (0-15 points) based on platform activity"""
    # Posts, comments, likes in last 30 days
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    posts = await db.posts.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": thirty_days_ago}
    })
    
    # Optimized: Use aggregation to count user's comments
    comments_pipeline = [
        {"$unwind": "$comments"},
        {"$match": {
            "comments.user_id": user_id,
            "created_at": {"$gte": thirty_days_ago}
        }},
        {"$count": "total"}
    ]
    
    comments_result = await db.posts.aggregate(comments_pipeline).to_list(1)
    comments_made = comments_result[0]["total"] if comments_result else 0
    
    activity_score = min(posts * 2 + comments_made, 15)
    return float(activity_score)

async def calculate_referral_score(user_id: str) -> float:
    """Calculate referral score (0-15 points) based on successful referrals"""
    referrals = await db.users.count_documents({"referred_by": user_id})
    return min(referrals * 3, 15.0)

async def calculate_group_health_score(user_id: str, stokvel_id: str) -> float:
    """Calculate group health contribution (0-20 points)"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        return 0.0
    
    group_strength = await calculate_group_strength(stokvel_id)
    
    # User's contribution to group strength
    is_creator = stokvel["created_by"] == user_id
    member = next((m for m in stokvel["members"] if m["user_id"] == user_id), None)
    
    base_score = (group_strength / 100) * 15
    
    # Bonus for creator
    if is_creator:
        base_score += 5
    
    return min(base_score, 20.0)

async def calculate_user_network_score(user_id: str, stokvel_id: str) -> dict:
    """Calculate comprehensive user network score (0-100)"""
    consistency = await calculate_contribution_consistency_score(user_id, stokvel_id)
    amount = await calculate_contribution_amount_score(user_id, stokvel_id)
    engagement = await calculate_engagement_score(user_id)
    referrals = await calculate_referral_score(user_id)
    group_health = await calculate_group_health_score(user_id, stokvel_id)
    
    total_score = consistency + amount + engagement + referrals + group_health
    
    # Determine tier
    if total_score >= 86:
        tier = "premium"
    elif total_score >= 71:
        tier = "boosted"
    elif total_score >= 41:
        tier = "basic"
    else:
        tier = "none"
    
    # Calculate streak
    contributions = await db.contributions.find({
        "user_id": user_id,
        "stokvel_id": stokvel_id
    }).sort("created_at", -1).to_list(1000)
    
    streak_days = 0
    if contributions:
        last_contribution = datetime.fromisoformat(contributions[0]["created_at"])
        days_since = (datetime.now(timezone.utc) - last_contribution).days
        if days_since <= 7:  # Active streak
            streak_days = len(contributions) * 7  # Approximate weekly streaks
    
    return {
        "individual_score": round(total_score, 2),
        "contribution_consistency_score": round(consistency, 2),
        "contribution_amount_score": round(amount, 2),
        "engagement_score": round(engagement, 2),
        "referral_score": round(referrals, 2),
        "group_health_score": round(group_health, 2),
        "tier": tier,
        "streak_days": streak_days
    }

async def calculate_group_network_score(stokvel_id: str) -> dict:
    """Calculate group network score (weighted average of members)"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        return None
    
    member_scores = []
    for member in stokvel["members"]:
        score_data = await calculate_user_network_score(member["user_id"], stokvel_id)
        member_scores.append(score_data["individual_score"])
    
    if not member_scores:
        return None
    
    avg_score = sum(member_scores) / len(member_scores)
    
    # Determine tier
    if avg_score >= 86:
        tier = "premium"
    elif avg_score >= 71:
        tier = "boosted"
    elif avg_score >= 41:
        tier = "basic"
    else:
        tier = "none"
    
    # Calculate liquidity ratio
    liquidity_ratio = 1.0  # Simplified - in production, track actual liquidity vs commitments
    
    return {
        "group_score": round(avg_score, 2),
        "tier": tier,
        "member_count": len(stokvel["members"]),
        "avg_member_score": round(avg_score, 2),
        "liquidity_ratio": liquidity_ratio
    }

# Reward Engine
async def calculate_tier_rewards(user_score: float, contribution_amount: float) -> dict:
    """Calculate rewards based on tier"""
    if user_score >= 86:  # Premium
        bonus_percentage = 0.10  # 10% bonus
        cashback_percentage = 0.05  # 5% cashback
        fee_reduction = 0.50  # 50% fee reduction
        payout_boost = 1.20  # 20% boost
    elif user_score >= 71:  # Boosted
        bonus_percentage = 0.07
        cashback_percentage = 0.03
        fee_reduction = 0.30
        payout_boost = 1.15
    elif user_score >= 41:  # Basic
        bonus_percentage = 0.03
        cashback_percentage = 0.01
        fee_reduction = 0.10
        payout_boost = 1.05
    else:  # None
        bonus_percentage = 0.0
        cashback_percentage = 0.0
        fee_reduction = 0.0
        payout_boost = 1.0
    
    return {
        "bonus_contribution": round(contribution_amount * bonus_percentage, 2),
        "cashback": round(contribution_amount * cashback_percentage, 2),
        "fee_reduction_percent": fee_reduction,
        "payout_boost_multiplier": payout_boost
    }

async def allocate_reward(user_id: str, stokvel_id: str, reward_type: str, amount: float, tier: str, description: str):
    """Create reward allocation record"""
    reward_id = str(uuid.uuid4())
    reward = {
        "id": reward_id,
        "user_id": user_id,
        "stokvel_id": stokvel_id,
        "reward_type": reward_type,
        "amount": amount,
        "tier": tier,
        "description": description,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rewards.insert_one(reward)
    return reward

async def process_contribution_rewards(user_id: str, stokvel_id: str, contribution_amount: float):
    """Process rewards when user makes contribution"""
    # Calculate user score
    score_data = await calculate_user_network_score(user_id, stokvel_id)
    user_score = score_data["individual_score"]
    tier = score_data["tier"]
    
    if tier == "none":
        return  # No rewards
    
    # Calculate rewards
    rewards = await calculate_tier_rewards(user_score, contribution_amount)
    
    # Allocate bonus contribution to pool
    if rewards["bonus_contribution"] > 0:
        await db.stokvels.update_one(
            {"id": stokvel_id},
            {"$inc": {"total_pool": rewards["bonus_contribution"]}}
        )
        await allocate_reward(
            user_id, stokvel_id, "bonus_contribution",
            rewards["bonus_contribution"], tier,
            f"Bonus {int(rewards['bonus_contribution']/contribution_amount*100)}% added to pool"
        )
    
    # Allocate cashback to user wallet
    if rewards["cashback"] > 0:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"wallet_balance": rewards["cashback"]}}
        )
        await allocate_reward(
            user_id, stokvel_id, "cashback",
            rewards["cashback"], tier,
            f"Cashback {int(rewards['cashback']/contribution_amount*100)}%"
        )
        await _notify_wallet_credit(user_id, float(rewards["cashback"]), f"Stokvel cashback — {tier} tier")

@api_router.get("/stokvels/{stokvel_id}/strength")
async def get_group_strength(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    is_member = any(m["user_id"] == current_user["id"] for m in stokvel["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    strength_score = await calculate_group_strength(stokvel_id)
    
    if strength_score <= 25:
        level = "Low"
    elif strength_score <= 50:
        level = "Medium"
    elif strength_score <= 75:
        level = "High"
    else:
        level = "Strong"
    
    return {
        "score": strength_score,
        "level": level,
        "member_count": len(stokvel["members"]),
        "total_contributions": await db.contributions.count_documents({"stokvel_id": stokvel_id}),
        "pool_progress": int((stokvel["total_pool"] / stokvel["target_amount"]) * 100) if stokvel["target_amount"] > 0 else 0
    }

# Network Score & Rewards API
@api_router.get("/stokvels/{stokvel_id}/my-score", response_model=UserScore)
async def get_my_network_score(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's network score for a specific stokvel"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    is_member = any(m["user_id"] == current_user["id"] for m in stokvel["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    score_data = await calculate_user_network_score(current_user["id"], stokvel_id)
    
    member = next((m for m in stokvel["members"] if m["user_id"] == current_user["id"]), None)
    total_contributed = member.get("total_contributed", 0) if member else 0
    
    return {
        "user_id": current_user["id"],
        "username": current_user["username"],
        "individual_score": score_data["individual_score"],
        "contribution_consistency_score": score_data["contribution_consistency_score"],
        "contribution_amount_score": score_data["contribution_amount_score"],
        "engagement_score": score_data["engagement_score"],
        "referral_score": score_data["referral_score"],
        "group_health_score": score_data["group_health_score"],
        "tier": score_data["tier"],
        "streak_days": score_data["streak_days"],
        "total_contributions": total_contributed,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/stokvels/{stokvel_id}/group-score", response_model=GroupScore)
async def get_group_network_score(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    """Get group's network score"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    is_member = any(m["user_id"] == current_user["id"] for m in stokvel["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    group_data = await calculate_group_network_score(stokvel_id)
    
    return {
        "stokvel_id": stokvel_id,
        "group_score": group_data["group_score"],
        "tier": group_data["tier"],
        "total_pool": stokvel["total_pool"],
        "member_count": group_data["member_count"],
        "avg_member_score": group_data["avg_member_score"],
        "liquidity_ratio": group_data["liquidity_ratio"],
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

@api_router.get("/stokvels/{stokvel_id}/my-rewards")
async def get_my_rewards(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    """Get user's rewards for a stokvel"""
    rewards = await db.rewards.find({
        "user_id": current_user["id"],
        "stokvel_id": stokvel_id
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    total_bonus = sum(r["amount"] for r in rewards if r["reward_type"] == "bonus_contribution")
    total_cashback = sum(r["amount"] for r in rewards if r["reward_type"] == "cashback")
    
    return {
        "rewards": rewards,
        "summary": {
            "total_bonus": total_bonus,
            "total_cashback": total_cashback,
            "total_rewards": total_bonus + total_cashback,
            "reward_count": len(rewards)
        }
    }

# Smart Access API
@api_router.post("/stokvels/{stokvel_id}/smart-access")
async def request_smart_access(stokvel_id: str, request: RequestSmartAccess, current_user: dict = Depends(get_current_user)):
    require_premium(current_user)
    """Request early access to pooled funds"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    is_member = any(m["user_id"] == current_user["id"] for m in stokvel["members"])
    if not is_member:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    # Get user's score
    score_data = await calculate_user_network_score(current_user["id"], stokvel_id)
    user_score = score_data["individual_score"]
    
    # Check eligibility (score > 70)
    if user_score < 70:
        raise HTTPException(
            status_code=400,
            detail=f"Smart Access requires score of 70+. Your score: {user_score:.1f}"
        )
    
    # Get user's total contributions
    member = next((m for m in stokvel["members"] if m["user_id"] == current_user["id"]), None)
    total_contributed = member.get("total_contributed", 0) if member else 0
    
    # Calculate access limit (30-60% based on tier)
    tier = score_data["tier"]
    if tier == "premium":
        access_percentage = 0.60
    elif tier == "boosted":
        access_percentage = 0.50
    else:
        access_percentage = 0.30
    
    max_access = total_contributed * access_percentage
    
    if request.requested_amount > max_access:
        raise HTTPException(
            status_code=400,
            detail=f"Requested ${request.requested_amount:.2f} exceeds your limit of ${max_access:.2f} ({int(access_percentage*100)}% of contributions)"
        )
    
    # Check pool liquidity (simplified - 50% of pool must remain)
    available_liquidity = stokvel["total_pool"] * 0.5
    if request.requested_amount > available_liquidity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient pool liquidity. Available: ${available_liquidity:.2f}"
        )
    
    # Create smart access request
    access_id = str(uuid.uuid4())
    smart_access = {
        "id": access_id,
        "user_id": current_user["id"],
        "stokvel_id": stokvel_id,
        "requested_amount": request.requested_amount,
        "approved_amount": request.requested_amount,
        "user_score": user_score,
        "access_percentage": access_percentage * 100,
        "status": "approved",
        "cost_method": "reduce_future_rewards",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.smart_access.insert_one(smart_access)
    
    # Transfer funds to user wallet
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"wallet_balance": request.requested_amount}}
    )
    await _notify_wallet_credit(current_user["id"], float(request.requested_amount), "Smart Access fund release")
    
    # Reduce pool
    await db.stokvels.update_one(
        {"id": stokvel_id},
        {"$inc": {"total_pool": -request.requested_amount}}
    )
    
    # Create transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "smart_access",
        "amount": request.requested_amount,
        "description": f"Smart Access from {stokvel['name']}",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "message": "Smart Access approved",
        "access_id": access_id,
        "amount": request.requested_amount,
        "cost_method": "Future rewards reduced by 30% until replenished",
        "note": "This is NOT a loan. You accessed your own pooled savings early."
    }

@api_router.get("/stokvels/{stokvel_id}/smart-access-eligibility")
async def check_smart_access_eligibility(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    """Check if user is eligible for smart access"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    member = next((m for m in stokvel["members"] if m["user_id"] == current_user["id"]), None)
    if not member:
        raise HTTPException(status_code=403, detail="Not a member")
    
    score_data = await calculate_user_network_score(current_user["id"], stokvel_id)
    user_score = score_data["individual_score"]
    tier = score_data["tier"]
    total_contributed = member.get("total_contributed", 0)
    
    # Determine access percentage
    if tier == "premium":
        access_percentage = 0.60
    elif tier == "boosted":
        access_percentage = 0.50
    elif tier == "basic":
        access_percentage = 0.30
    else:
        access_percentage = 0.0
    
    max_access = total_contributed * access_percentage
    available_liquidity = stokvel["total_pool"] * 0.5
    
    eligible = user_score >= 70 and total_contributed > 0
    
    return {
        "eligible": eligible,
        "user_score": user_score,
        "tier": tier,
        "total_contributed": total_contributed,
        "access_percentage": int(access_percentage * 100),
        "max_access_amount": max_access,
        "pool_liquidity": available_liquidity,
        "reason": "Eligible for Smart Access" if eligible else f"Score must be 70+ (current: {user_score:.1f})"
    }

# ============== MULTI-SIGNATURE WALLET WITHDRAWALS ==============

def _required_approvals(signatory_count: int) -> int:
    """2-of-3 rule. With 1 signatory, 1 approval. With 2, both. With 3+, any 2."""
    if signatory_count <= 1:
        return 1
    if signatory_count == 2:
        return 2
    return 2  # 2 of 3 (or more)

@api_router.put("/stokvels/{stokvel_id}/signatories")
async def set_signatories(stokvel_id: str, payload: SetSignatoriesRequest, current_user: dict = Depends(get_current_user)):
    """Creator sets up to 3 signatories who can approve pool withdrawals."""
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    if stokvel["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can set signatories")
    if len(payload.signatory_ids) < 1 or len(payload.signatory_ids) > 3:
        raise HTTPException(status_code=400, detail="Pick 1–3 signatories")
    member_ids = {m["user_id"] for m in stokvel.get("members", [])}
    bad = [s for s in payload.signatory_ids if s not in member_ids]
    if bad:
        raise HTTPException(status_code=400, detail="All signatories must be group members")
    await db.stokvels.update_one(
        {"id": stokvel_id},
        {"$set": {"signatories": payload.signatory_ids}}
    )
    return {
        "signatory_ids": payload.signatory_ids,
        "required_approvals": _required_approvals(len(payload.signatory_ids)),
    }

@api_router.post("/stokvels/{stokvel_id}/withdrawals")
async def create_withdrawal(stokvel_id: str, payload: WithdrawalRequest, current_user: dict = Depends(get_current_user)):
    """Member proposes a withdrawal from the group pool."""
    require_premium(current_user)
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    member_ids = {m["user_id"] for m in stokvel.get("members", [])}
    if current_user["id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if payload.amount > stokvel.get("total_pool", 0):
        raise HTTPException(status_code=400, detail="Amount exceeds group pool")
    recipient_id = payload.recipient_user_id or current_user["id"]
    if recipient_id not in member_ids:
        raise HTTPException(status_code=400, detail="Recipient must be a group member")

    signatories = stokvel.get("signatories") or [stokvel["created_by"]]
    required = _required_approvals(len(signatories))

    wid = str(uuid.uuid4())
    withdrawal = {
        "id": wid,
        "stokvel_id": stokvel_id,
        "stokvel_name": stokvel["name"],
        "requested_by": current_user["id"],
        "requester_username": current_user["username"],
        "recipient_id": recipient_id,
        "amount": payload.amount,
        "purpose": payload.purpose or "",
        "signatories": signatories,
        "approvals": [],   # list of user_ids who approved
        "rejections": [],  # list of user_ids who rejected
        "required_approvals": required,
        "status": "pending",  # pending | approved | rejected | executed
        "created_at": datetime.now(timezone.utc).isoformat(),
        "executed_at": None,
    }
    await db.withdrawals.insert_one(withdrawal)
    if "_id" in withdrawal:
        del withdrawal["_id"]
    return {"withdrawal": withdrawal}

@api_router.get("/stokvels/{stokvel_id}/withdrawals")
async def list_withdrawals(stokvel_id: str, current_user: dict = Depends(get_current_user)):
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0, "members": 1, "signatories": 1, "created_by": 1})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    member_ids = {m["user_id"] for m in stokvel.get("members", [])}
    if current_user["id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member")
    rows = await db.withdrawals.find({"stokvel_id": stokvel_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {
        "withdrawals": rows,
        "signatories": stokvel.get("signatories") or [stokvel["created_by"]],
    }

async def _vote_withdrawal(stokvel_id: str, withdrawal_id: str, user_id: str, vote: str):
    if vote not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Invalid vote")
    w = await db.withdrawals.find_one({"id": withdrawal_id, "stokvel_id": stokvel_id})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if w["status"] not in ("pending",):
        raise HTTPException(status_code=400, detail=f"Already {w['status']}")
    if user_id not in w.get("signatories", []):
        raise HTTPException(status_code=403, detail="Not a signatory")
    if user_id in w.get("approvals", []) or user_id in w.get("rejections", []):
        raise HTTPException(status_code=400, detail="Already voted")
    field = "approvals" if vote == "approve" else "rejections"
    await db.withdrawals.update_one({"id": withdrawal_id}, {"$push": {field: user_id}})
    w = await db.withdrawals.find_one({"id": withdrawal_id})
    # Decide outcome
    sig_count = len(w["signatories"])
    needed = w["required_approvals"]
    if len(w["approvals"]) >= needed:
        # Execute
        stokvel = await db.stokvels.find_one({"id": stokvel_id})
        if stokvel.get("total_pool", 0) < w["amount"]:
            await db.withdrawals.update_one({"id": withdrawal_id}, {"$set": {"status": "rejected"}})
            raise HTTPException(status_code=400, detail="Pool no longer has enough funds")
        await db.stokvels.update_one({"id": stokvel_id}, {"$inc": {"total_pool": -w["amount"]}})
        await db.users.update_one({"id": w["recipient_id"]}, {"$inc": {"wallet_balance": w["amount"]}})
        await _notify_wallet_credit(w["recipient_id"], float(w["amount"]), f"Stokvel withdrawal — {w.get('stokvel_name','')}")
        await db.withdrawals.update_one(
            {"id": withdrawal_id},
            {"$set": {"status": "executed", "executed_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": w["recipient_id"],
            "type": "stokvel_withdrawal",
            "amount": w["amount"],
            "description": f"Withdrawal from {w['stokvel_name']}: {w.get('purpose','')}",
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"status": "executed", "approvals": len(w["approvals"]), "required": needed}
    if len(w["rejections"]) > sig_count - needed:
        # Cannot reach threshold any more
        await db.withdrawals.update_one({"id": withdrawal_id}, {"$set": {"status": "rejected"}})
        return {"status": "rejected", "approvals": len(w["approvals"]), "required": needed}
    return {"status": "pending", "approvals": len(w["approvals"]), "required": needed}

@api_router.post("/stokvels/{stokvel_id}/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(stokvel_id: str, withdrawal_id: str, current_user: dict = Depends(get_current_user)):
    return await _vote_withdrawal(stokvel_id, withdrawal_id, current_user["id"], "approve")

@api_router.post("/stokvels/{stokvel_id}/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(stokvel_id: str, withdrawal_id: str, current_user: dict = Depends(get_current_user)):
    return await _vote_withdrawal(stokvel_id, withdrawal_id, current_user["id"], "reject")

# Leaderboards API
@api_router.get("/leaderboard/users")
async def get_user_leaderboard(stokvel_id: Optional[str] = None, limit: int = 50):
    """Get user leaderboard by network score"""
    # For now, return based on network score (simplified)
    # In production, calculate actual scores for all users
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("network_score", -1).limit(limit).to_list(limit)
    
    leaderboard = []
    for idx, user in enumerate(users):
        leaderboard.append({
            "rank": idx + 1,
            "user_id": user["id"],
            "username": user["username"],
            "photo": user.get("photo", ""),
            "score": user.get("network_score", 0),
            "tier": user.get("rank", "Rising Star"),
            "total_contributions": 0  # Would calculate from contributions
        })
    
    return leaderboard

@api_router.get("/leaderboard/groups")
async def get_group_leaderboard(limit: int = 50):
    """Get group leaderboard by group score"""
    stokvels = await db.stokvels.find({}, {"_id": 0}).to_list(limit)
    
    leaderboard = []
    for stokvel in stokvels:
        group_data = await calculate_group_network_score(stokvel["id"])
        if group_data:
            leaderboard.append({
                "rank": 0,  # Will sort below
                "stokvel_id": stokvel["id"],
                "name": stokvel["name"],
                "group_score": group_data["group_score"],
                "tier": group_data["tier"],
                "total_pool": stokvel["total_pool"],
                "member_count": len(stokvel["members"])
            })
    
    # Sort by score
    leaderboard.sort(key=lambda x: x["group_score"], reverse=True)
    for idx, entry in enumerate(leaderboard):
        entry["rank"] = idx + 1
    
    return leaderboard[:limit]

# Badges API
@api_router.get("/badges/available")
async def get_available_badges():
    """Get all available badges"""
    badges = [
        {"id": "consistency_king", "name": "Consistency King", "description": "Maintain 12-week contribution streak", "icon": "👑", "requirement": "12_week_streak"},
        {"id": "network_builder", "name": "Network Builder", "description": "Refer 5+ members", "icon": "🌐", "requirement": "5_referrals"},
        {"id": "top_contributor", "name": "Top Contributor", "description": "Highest contributor in group", "icon": "💎", "requirement": "top_in_group"},
        {"id": "premium_member", "name": "Premium Member", "description": "Achieve Premium tier (86+ score)", "icon": "⭐", "requirement": "premium_tier"},
        {"id": "pool_champion", "name": "Pool Champion", "description": "Help reach R50,000 pool", "icon": "🏆", "requirement": "50k_pool"},
        {"id": "early_adopter", "name": "Early Adopter", "description": "Join in first month", "icon": "🚀", "requirement": "early_join"},
    ]
    return badges

@api_router.get("/badges/my-badges")
async def get_my_badges(current_user: dict = Depends(get_current_user)):
    """Get user's earned badges"""
    # Check and award badges based on achievements
    earned_badges = []
    
    # Check for referral badge
    referral_count = await db.users.count_documents({"referred_by": current_user["id"]})
    if referral_count >= 5:
        earned_badges.append({
            "badge_id": "network_builder",
            "name": "Network Builder",
            "icon": "🌐",
            "earned_at": current_user.get("created_at")
        })
    
    # Check network score for premium
    if current_user.get("network_score", 0) >= 86:
        earned_badges.append({
            "badge_id": "premium_member",
            "name": "Premium Member",
            "icon": "⭐",
            "earned_at": datetime.now(timezone.utc).isoformat()
        })
    
    return earned_badges

# ============== CREATOR/PRODUCT ENDPOINTS ==============

@api_router.post("/products")
async def create_product(request: CreateProductRequest, current_user: dict = Depends(get_current_user)):
    """Create a new product (goes to pending review)"""
    product_id = str(uuid.uuid4())

    # Auto-default currency to creator's country if not provided
    COUNTRY_CURRENCY = {
        "south_africa": "ZAR", "nigeria": "NGN", "kenya": "KES", "ghana": "GHS",
        "zimbabwe": "USD", "tanzania": "USD", "uganda": "USD", "senegal": "USD",
        "egypt": "USD", "morocco": "USD", "ethiopia": "USD", "rwanda": "USD",
    }
    creator_country = (current_user.get("country") or "").lower()
    auto_currency = COUNTRY_CURRENCY.get(creator_country, "USD")
    currency = (request.currency or auto_currency or "USD").upper()
    if currency not in SUPPORTED_CURRENCIES:
        currency = auto_currency

    # Validate type + availability
    p_type = (request.type or "product").strip().lower()
    if p_type not in ("product", "service"):
        p_type = "product"
    availability = (request.availability or "available_now").strip().lower()
    if availability not in ("available_now", "available_in_days", "preorder", "on_request"):
        availability = "available_now"
    avail_days = None
    if availability == "available_in_days":
        try:
            avail_days = max(1, int(request.availability_days or 7))
        except (TypeError, ValueError):
            avail_days = 7

    product_data = {
        "id": product_id,
        "creator_id": current_user["id"],
        "creator_name": current_user.get("full_name") or current_user["username"],
        "name": request.name,
        "problem_solved": request.problem_solved,
        "description": request.description or "",
        "estimated_cost": request.estimated_cost,
        "timeline": request.timeline,
        "interest_level": request.interest_level,
        "category": request.category or "general",
        "release_date": request.release_date,
        "min_support": request.min_support or 10.0,
        "max_support": request.max_support or 1000.0,
        "images": request.images or [],
        "status": "pending_review",  # Moderation required
        "total_supporters": 0,
        "total_support_amount": 0.0,
        "followers": [],
        "supports": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "approved_at": None,
        "type": p_type,
        "currency": currency,
        "availability": availability,
        "availability_days": avail_days,
    }
    
    await db.products.insert_one(product_data)
    
    # Update user as creator
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"is_creator": True, "user_type": "creator"}}
    )
    
    if "_id" in product_data:
        del product_data["_id"]
    return {"message": "Product submitted for review", "product": product_data}

@api_router.get("/products")
async def get_products(status: str = "approved", category: str = None):
    """Get all approved products (public)"""
    query = {"status": status}
    if category:
        query["category"] = category
    
    products = await db.products.find(query, {"_id": 0, "followers": 0}).sort("created_at", -1).to_list(100)
    return {"products": products}

@api_router.get("/products/my")
async def get_my_products(current_user: dict = Depends(get_current_user)):
    """Get creator's own products"""
    products = await db.products.find(
        {"creator_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"products": products}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    """Get single product details"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0, "followers": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Get creator info
    creator = await db.users.find_one(
        {"id": product["creator_id"]},
        {"_id": 0, "password": 0}
    )
    
    return {"product": product, "creator": creator}

@api_router.post("/products/{product_id}/follow")
async def follow_product(product_id: str, request: FollowProductRequest):
    """Register as a follower/supporter for a product"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    follower_id = str(uuid.uuid4())
    follower_data = {
        "id": follower_id,
        "product_id": product_id,
        "name": request.name,
        "email": request.email,
        "phone": request.phone,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.products.update_one(
        {"id": product_id},
        {
            "$push": {"followers": follower_data},
            "$inc": {"total_supporters": 1}
        }
    )
    
    return {"message": "Successfully registered as supporter", "follower_id": follower_id}

@api_router.post("/products/{product_id}/support")
async def support_product(product_id: str, request: ProductSupportRequest, current_user: dict = Depends(get_current_user)):
    require_premium(current_user)
    """Contribute support to a product"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["status"] != "approved":
        raise HTTPException(status_code=400, detail="Product is not yet approved for support")
    
    # Validate support amount
    if request.amount < product["min_support"] or request.amount > product["max_support"]:
        raise HTTPException(
            status_code=400, 
            detail=f"Support amount must be between ${product['min_support']} and ${product['max_support']}"
        )
    
    # Check wallet balance
    if current_user.get("wallet_balance", 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    support_id = str(uuid.uuid4())
    support_data = {
        "id": support_id,
        "product_id": product_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "stokvel_id": None,
        "amount": request.amount,
        "note": request.note or "",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Deduct from wallet
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"wallet_balance": -request.amount}}
    )
    
    # Add support to product
    await db.products.update_one(
        {"id": product_id},
        {
            "$push": {"supports": support_data},
            "$inc": {"total_support_amount": request.amount}
        }
    )
    
    # Record transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "product_support",
        "amount": -request.amount,
        "description": f"Support for: {product['name']}",
        "product_id": product_id,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    return {"message": "Support contribution recorded", "support_id": support_id}

@api_router.get("/products/{product_id}/insights")
async def get_product_insights(product_id: str, tier: str = "free", current_user: dict = Depends(get_current_user)):
    """Get audience insights for creator (tiered access)"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can view insights")
    
    followers = product.get("followers", [])
    total_followers = len(followers)
    
    if tier == "free":
        # Free tier: count only
        return {
            "tier": "free",
            "total_followers": total_followers,
            "total_support": product.get("total_support_amount", 0),
            "followers": None,
            "unlock_message": "Unlock Basic ($5) to see 25% of your audience"
        }
    elif tier == "basic":
        # Basic tier ($5): 25% of followers
        limit = max(1, total_followers // 4)
        return {
            "tier": "basic",
            "total_followers": total_followers,
            "total_support": product.get("total_support_amount", 0),
            "followers": followers[:limit],
            "showing": limit,
            "unlock_message": "Unlock Pro ($15) to see all your audience"
        }
    elif tier == "pro":
        # Pro tier ($15): full list
        return {
            "tier": "pro",
            "total_followers": total_followers,
            "total_support": product.get("total_support_amount", 0),
            "followers": followers,
            "showing": total_followers
        }
    
    return {"tier": "free", "total_followers": total_followers}

@api_router.post("/products/{product_id}/unlock-insights")
async def unlock_insights(product_id: str, tier: str, current_user: dict = Depends(get_current_user)):
    """Pay to unlock audience insights tier"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product["creator_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the creator can unlock insights")
    
    tier_prices = {"basic": 5.0, "pro": 15.0}
    if tier not in tier_prices:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    price = tier_prices[tier]
    if current_user.get("wallet_balance", 0) < price:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    # Deduct from wallet
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$inc": {"wallet_balance": -price}}
    )
    
    # Record unlock
    await db.products.update_one(
        {"id": product_id},
        {"$set": {f"insights_unlocked_{tier}": True}}
    )
    
    # Record transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "insights_unlock",
        "amount": -price,
        "description": f"Unlocked {tier} analytics for: {product['name']}",
        "product_id": product_id,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    return {"message": f"{tier.capitalize()} insights unlocked", "tier": tier}

# Stokvel product support
@api_router.post("/stokvels/{stokvel_id}/support-product/{product_id}")
async def stokvel_support_product(stokvel_id: str, product_id: str, request: ProductSupportRequest, current_user: dict = Depends(get_current_user)):
    """Group support for a product from stokvel pool"""
    stokvel = await db.stokvels.find_one({"id": stokvel_id})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if user is member
    member_ids = [m["user_id"] for m in stokvel.get("members", [])]
    if current_user["id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member of this stokvel")
    
    # Validate amount
    if request.amount < product["min_support"] or request.amount > product["max_support"]:
        raise HTTPException(
            status_code=400,
            detail=f"Support amount must be between ${product['min_support']} and ${product['max_support']}"
        )
    
    # Check stokvel pool
    if stokvel.get("total_pool", 0) < request.amount:
        raise HTTPException(status_code=400, detail="Insufficient group pool")
    
    support_id = str(uuid.uuid4())
    support_data = {
        "id": support_id,
        "product_id": product_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "stokvel_id": stokvel_id,
        "stokvel_name": stokvel["name"],
        "amount": request.amount,
        "note": request.note or f"Group support from {stokvel['name']}",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Deduct from stokvel pool
    await db.stokvels.update_one(
        {"id": stokvel_id},
        {"$inc": {"total_pool": -request.amount}}
    )
    
    # Add support to product
    await db.products.update_one(
        {"id": product_id},
        {
            "$push": {"supports": support_data},
            "$inc": {"total_support_amount": request.amount}
        }
    )
    
    return {"message": "Group support contribution recorded", "support_id": support_id}

# Admin: Approve/reject products
@api_router.post("/admin/products/{product_id}/moderate")
async def moderate_product(product_id: str, action: str, _: bool = Depends(verify_admin)):
    """Admin: Approve or reject a product"""
    if action not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    new_status = "approved" if action == "approve" else "rejected"
    update_data = {"status": new_status}
    
    if action == "approve":
        update_data["approved_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.products.update_one(
        {"id": product_id},
        {"$set": update_data}
    )
    
    return {"message": f"Product {action}d", "status": new_status}

@api_router.get("/admin/products/pending")
async def get_pending_products(_: bool = Depends(verify_admin)):
    """Admin: Get products awaiting moderation"""
    products = await db.products.find(
        {"status": "pending_review"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    return {"products": products, "total": len(products)}

# Dashboard Net Worth endpoint
@api_router.get("/dashboard/net-worth")
async def get_net_worth(current_user: dict = Depends(get_current_user)):
    """Get user's net worth and network value"""
    user_id = current_user["id"]
    
    # Wallet balance
    wallet_balance = current_user.get("wallet_balance", 0)
    
    # Stokvel participation (sum of user's contributions)
    stokvels = await db.stokvels.find(
        {"members.user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    stokvel_value = 0
    active_stokvels = 0
    for s in stokvels:
        active_stokvels += 1
        # Calculate user's share in each stokvel
        for m in s.get("members", []):
            if m["user_id"] == user_id:
                stokvel_value += m.get("total_contributed", 0)
    
    # Products supported
    products_supported = await db.products.find(
        {"supports.user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    total_product_support = 0
    for p in products_supported:
        for s in p.get("supports", []):
            if s["user_id"] == user_id:
                total_product_support += s["amount"]
    
    # Calculate Network Value (activity-based score)
    posts_count = await db.posts.count_documents({"user_id": user_id})
    network_score = current_user.get("network_score", 0)
    referrals = await db.users.count_documents({"referred_by": user_id})
    
    # Network Value formula: engagement + participation + network score
    network_value = (
        (posts_count * 5) +  # Posts
        (active_stokvels * 20) +  # Stokvel memberships
        (len(products_supported) * 10) +  # Products supported
        (referrals * 50) +  # Referrals
        (network_score * 2)  # Network score
    )
    
    return {
        "net_worth": {
            "total": wallet_balance + stokvel_value,
            "wallet_balance": wallet_balance,
            "stokvel_participation": stokvel_value,
            "products_supported": total_product_support,
            "active_stokvels": active_stokvels
        },
        "network_value": {
            "score": network_value,
            "breakdown": {
                "posts": posts_count,
                "stokvels": active_stokvels,
                "products_supported": len(products_supported),
                "referrals": referrals,
                "network_score": network_score
            }
        }
    }

# Progressive signup
@api_router.post("/auth/progressive-signup")
async def progressive_signup(request: ProgressiveSignupRequest):
    """Step 1: Create account with minimal info"""
    # Check if email/phone already exists
    query = {}
    if request.email:
        query["email"] = request.email
    elif request.phone:
        query["phone"] = request.phone
    else:
        raise HTTPException(status_code=400, detail="Email or phone required")

    existing = await db.users.find_one(query)
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists")

    user_id = str(uuid.uuid4())
    hashed_password = hash_password(request.password)

    # Founder-member tracking — first 1,000 users get a 30-day 2× score multiplier
    FOUNDER_LIMIT = 1000
    FOUNDER_MULTIPLIER_DAYS = 30
    existing_count = await db.users.count_documents({})
    is_founder = existing_count < FOUNDER_LIMIT
    founder_until = None
    if is_founder:
        founder_until = (datetime.now(timezone.utc) + timedelta(days=FOUNDER_MULTIPLIER_DAYS)).isoformat()

    # Initial share code uses placeholder username + month=00 — refreshed at complete-profile
    placeholder_username = f"user_{user_id[:8]}"
    initial_share_code = build_share_code(placeholder_username, None, user_id)

    user_data = {
        "id": user_id,
        "email": request.email or f"{request.phone}@phone.networkcapital.app",
        "phone": request.phone,
        "password": hashed_password,
        "username": f"user_{user_id[:8]}",
        "full_name": None,
        "bio": "",
        "photo": "",
        "network_score": 0,
        "rank": "Rising Star",
        "user_type": "member",  # "member" or "creator"
        "is_creator": False,
        "profile_completed": False,
        "onboarding_step": 2,  # Next step
        "wallet_balance": 0.0,
        "total_earned": 0.0,
        "total_spent": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "referral_code": user_id[:8].upper(),  # legacy hex code (kept for back-compat)
        "share_code": initial_share_code,  # new friendly format: networkcapitalapp.user_XXX.00.NN
        "referred_by": None,
        "achievements": [],
        "terms_accepted": False,
        "terms_accepted_at": None,
        # Email verification (mock OTP)
        "email_verified": False,
        # Founder-member 2× multiplier window
        "is_founder": is_founder,
        "founder_signup_rank": existing_count + 1 if is_founder else None,
        "founder_multiplier_until": founder_until,
    }

    await db.users.insert_one(user_data)

    token = create_access_token({"sub": user_id})

    del user_data["password"]
    if "_id" in user_data:
        del user_data["_id"]

    return {
        "token": token,
        "user": user_data,
        "next_step": 2,
        "founder": {
            "is_founder": is_founder,
            "rank": user_data.get("founder_signup_rank"),
            "multiplier_until": founder_until,
        },
        "message": "Account created. Please verify your email to continue."
    }


@api_router.get("/founders/status")
async def founders_status():
    """Public — returns how many of the first 1,000 founder spots remain.
    Drives the landing-page urgency counter."""
    FOUNDER_LIMIT = 1000
    claimed = await db.users.count_documents({})
    claimed_capped = min(claimed, FOUNDER_LIMIT)
    return {
        "limit": FOUNDER_LIMIT,
        "claimed": claimed_capped,
        "available": max(0, FOUNDER_LIMIT - claimed_capped),
        "active": claimed_capped < FOUNDER_LIMIT,
        "multiplier": 2,
        "duration_days": 30,
    }


# ============== EMAIL OTP (Brevo) ==============
# Sends a 6-digit OTP via Brevo. Falls back to logging the code if Brevo is
# not configured (no BREVO_API_KEY), so QA / pre-DNS-setup environments still work.
import logging as _otp_logging
import secrets as _otp_secrets
from services.email_service import send_transactional_email as _brevo_send, is_configured as _brevo_configured


def _generate_otp() -> str:
    return f"{_otp_secrets.randbelow(1_000_000):06d}"


def _otp_email_html(code: str) -> str:
    """Inline-styled HTML email template for the OTP code."""
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <tr><td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#0f1d35;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
          <tr><td style="text-align:center;padding-bottom:16px;">
            <span style="font-size:14px;color:#f5d76e;letter-spacing:2px;text-transform:uppercase;">Network Capital</span>
          </td></tr>
          <tr><td style="text-align:center;padding-bottom:8px;">
            <h1 style="margin:0;font-size:22px;color:#ffffff;">Verify your email</h1>
          </td></tr>
          <tr><td style="text-align:center;color:#cbd5e1;font-size:14px;line-height:22px;padding-bottom:24px;">
            Use the code below to finish setting up your account. It expires in 10 minutes.
          </td></tr>
          <tr><td align="center" style="padding-bottom:24px;">
            <div style="display:inline-block;padding:16px 28px;background:#f5d76e;color:#0a1628;font-size:32px;font-weight:bold;letter-spacing:8px;border-radius:12px;">{code}</div>
          </td></tr>
          <tr><td style="text-align:center;color:#94a3b8;font-size:11px;line-height:18px;">
            If you didn't request this code, you can safely ignore this email.<br/>
            © Network Capital · Powered by Mici Business pty ltd
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


async def _send_otp_email(email: str, code: str) -> bool:
    """Send OTP via Brevo. Returns True on real send, False on fallback (logged only)."""
    if not _brevo_configured():
        _otp_logging.warning(f"[OTP-FALLBACK] No BREVO_API_KEY — code for {email}: {code}")
        return False
    ok = await _brevo_send(
        to_email=email,
        subject="Your Network Capital verification code",
        html_content=_otp_email_html(code),
        text_content=f"Your Network Capital verification code is {code}. It expires in 10 minutes.",
        tags=["otp", "verification"],
    )
    if not ok:
        _otp_logging.warning(f"[OTP-FALLBACK] Brevo send failed for {email} — code: {code}")
    return ok


# ─── Generic branded transactional email helper ────────────────────────────
def _branded_email_html(*, headline: str, body_html: str, cta_label: Optional[str] = None,
                        cta_url: Optional[str] = None, kicker: str = "Network Capital") -> str:
    """Reusable inline-styled branded template. Body is raw HTML (trusted, server-built)."""
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
          <tr><td align="center" style="padding:24px 0 8px;">
            <a href="{cta_url}" style="display:inline-block;padding:12px 24px;background:#f5d76e;color:#0a1628;font-weight:bold;border-radius:999px;text-decoration:none;font-size:14px;">{cta_label}</a>
          </td></tr>
        """
    return f"""
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;padding:32px 0;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
      <tr><td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#0f1d35;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:32px;">
          <tr><td style="text-align:center;padding-bottom:16px;">
            <span style="font-size:14px;color:#f5d76e;letter-spacing:2px;text-transform:uppercase;">{kicker}</span>
          </td></tr>
          <tr><td style="text-align:center;padding-bottom:8px;">
            <h1 style="margin:0;font-size:22px;color:#ffffff;line-height:28px;">{headline}</h1>
          </td></tr>
          <tr><td style="color:#cbd5e1;font-size:14px;line-height:22px;padding:12px 0 0;">
            {body_html}
          </td></tr>
          {cta_block}
          <tr><td style="text-align:center;color:#94a3b8;font-size:11px;line-height:18px;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;">
            You're receiving this because you have a Network Capital account.<br/>
            <a href="https://networkcapitalapp.co.za/settings" style="color:#94a3b8;text-decoration:underline;">Manage notifications</a> · © Network Capital · Powered by Mici Business pty ltd
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


async def _send_branded_email(*, to: str, subject: str, html: str, kind: str = "transactional") -> bool:
    """Fire-and-forget Brevo send. Never raises; logs success/failure with kind tag."""
    if not to:
        _otp_logging.info(f"[MAIL-SKIP:{kind}] No recipient")
        return False
    if not _brevo_configured():
        _otp_logging.info(f"[MAIL-SKIP:{kind}] BREVO_API_KEY missing — to={to}")
        return False
    return await _brevo_send(
        to_email=to,
        subject=subject,
        html_content=html,
        tags=[kind],
    )


# ─── Specific transactional templates ──────────────────────────────────────
def _welcome_email_html(name: str) -> str:
    return _branded_email_html(
        headline=f"Welcome, {name}!",
        body_html=(
            "<p>You're officially part of the Network Capital community. Here's what to do next to start building your Network Score:</p>"
            "<ul style='padding-left:18px;margin:8px 0;'>"
            "<li>Write your first post and earn <strong style='color:#f5d76e;'>+50 pts</strong></li>"
            "<li>Connect with 3 people (social, professional, financial) — <strong style='color:#f5d76e;'>+25</strong> each</li>"
            "<li>Discover or review a place — <strong style='color:#f5d76e;'>+40 pts</strong> per review</li>"
            "<li>Join a Stokvel — <strong style='color:#f5d76e;'>+250 pts</strong> on first join</li>"
            "</ul>"
            "<p style='font-size:13px;color:#94a3b8;'>Monthly cap is 10,000 pts. Founder members earn 2× until day 30.</p>"
        ),
        cta_label="Open the app",
        cta_url="https://networkcapitalapp.co.za/",
    )


def _connection_request_email_html(*, requester_name: str, kind: str) -> str:
    return _branded_email_html(
        headline=f"{requester_name} wants to connect",
        body_html=(
            f"<p>You have a new <strong>{kind}</strong> connection request waiting for your response.</p>"
            "<p>Accepting earns <strong style='color:#f5d76e;'>+25 Network Score</strong> for both of you.</p>"
        ),
        cta_label="Review request",
        cta_url="https://networkcapitalapp.co.za/network",
    )


def _connection_accepted_email_html(*, acceptor_name: str, kind: str) -> str:
    return _branded_email_html(
        headline=f"{acceptor_name} accepted your request",
        body_html=(
            f"<p>You're now connected on Network Capital — <strong>{kind}</strong>.</p>"
            "<p>You both earned <strong style='color:#f5d76e;'>+25 Network Score</strong>. Say hello via Messages.</p>"
        ),
        cta_label="Open My Network",
        cta_url="https://networkcapitalapp.co.za/network",
    )


def _job_application_received_email_html(*, applicant_name: str, job_title: str, job_id: str) -> str:
    return _branded_email_html(
        headline=f"New application: {job_title}",
        body_html=(
            f"<p><strong>{applicant_name}</strong> just applied for your role.</p>"
            "<p>Review their CV and cover note, then shortlist, schedule an interview, or send a rejection — all from the applicants tab.</p>"
        ),
        cta_label="Review applicant",
        cta_url=f"https://networkcapitalapp.co.za/jobs/{job_id}",
    )


def _job_application_status_email_html(*, job_title: str, new_status: str, job_id: str) -> str:
    label_map = {
        "new": "received",
        "shortlisted": "shortlisted",
        "interview": "moved to interview stage",
        "rejected": "not progressing further at this time",
        "hired": "hired — congratulations!",
    }
    pretty = label_map.get(new_status, new_status)
    return _branded_email_html(
        headline=f"Update on your application — {job_title}",
        body_html=(
            f"<p>Your application status has been updated to: <strong>{pretty}</strong>.</p>"
            "<p>Open the job page for next steps from the employer.</p>"
        ),
        cta_label="View job",
        cta_url=f"https://networkcapitalapp.co.za/jobs/{job_id}",
    )


# ─── Rewards / Wallet / Broadcast templates ────────────────────────────────
def _daily_rewards_digest_html(*, name: str, total_points: int, breakdown: list) -> str:
    """Daily summary of Network Score points earned. ``breakdown`` is a list of
    {action, points, count} dicts already prettified server-side."""
    rows = "".join(
        f"<tr><td style='padding:6px 0;color:#cbd5e1;font-size:13px;'>{item['label']}"
        f"{' × ' + str(item['count']) if item['count'] > 1 else ''}</td>"
        f"<td align='right' style='padding:6px 0;color:#f5d76e;font-size:13px;font-weight:bold;'>+{item['points']}</td></tr>"
        for item in breakdown
    )
    return _branded_email_html(
        headline=f"You earned +{total_points} pts today",
        body_html=(
            f"<p>Nice work, {name}. Here's your Network Score recap for today:</p>"
            f"<table width='100%' cellpadding='0' cellspacing='0' style='margin-top:8px;'>{rows}"
            f"<tr><td style='padding:12px 0 0;border-top:1px solid rgba(255,255,255,0.08);color:#ffffff;font-size:14px;font-weight:bold;'>Total</td>"
            f"<td align='right' style='padding:12px 0 0;border-top:1px solid rgba(255,255,255,0.08);color:#f5d76e;font-size:14px;font-weight:bold;'>+{total_points}</td></tr>"
            f"</table>"
            f"<p style='font-size:12px;color:#94a3b8;margin-top:16px;'>Monthly cap is 10,000 pts. Keep showing up — tomorrow's another chance to climb.</p>"
        ),
        cta_label="See your score",
        cta_url="https://networkcapitalapp.co.za/profile",
    )


# Friendly labels for score actions used in the rewards digest.
_SCORE_ACTION_LABELS = {
    "post_create": "Post published",
    "post_like": "Like received / given",
    "post_share": "Post shared",
    "comment_quality": "Comment posted",
    "video_watched": "Video watched",
    "ad_watch_engage": "Ad engagement",
    "ad_watch_share": "Ad share",
    "place_review_create": "Place review",
    "connection_made": "New connection",
    "job_share": "Job shared",
    "daily_checkin": "Daily check-in",
    "weekly_resource_drop": "Weekly resource drop",
    "referral_qualified": "Referral milestone (1k)",
    "referral_first_post": "Referral first post bonus",
    "referral_feature_unlock": "Referral feature unlock",
    "stokvel_first_join": "First Stokvel join",
    "profile_completed": "Profile completed",
    "post_create_official": "Official post published",
}


def _wallet_credit_html(*, name: str, amount_usd: float, reason: str, new_balance: float) -> str:
    return _branded_email_html(
        headline=f"+${amount_usd:.2f} added to your Network Capital wallet",
        body_html=(
            f"<p>Hi {name},</p>"
            f"<p>Your wallet was just credited:</p>"
            f"<table width='100%' cellpadding='0' cellspacing='0' style='margin:12px 0;'>"
            f"<tr><td style='padding:6px 0;color:#cbd5e1;font-size:13px;'>Amount</td>"
            f"<td align='right' style='padding:6px 0;color:#f5d76e;font-size:14px;font-weight:bold;'>+${amount_usd:.2f} USD</td></tr>"
            f"<tr><td style='padding:6px 0;color:#cbd5e1;font-size:13px;'>Reason</td>"
            f"<td align='right' style='padding:6px 0;color:#ffffff;font-size:13px;'>{reason}</td></tr>"
            f"<tr><td style='padding:6px 0;color:#cbd5e1;font-size:13px;border-top:1px solid rgba(255,255,255,0.08);'>New balance</td>"
            f"<td align='right' style='padding:6px 0;color:#ffffff;font-size:14px;font-weight:bold;border-top:1px solid rgba(255,255,255,0.08);'>${new_balance:.2f} USD</td></tr>"
            f"</table>"
            f"<p style='font-size:12px;color:#94a3b8;'>Withdrawals unlock at 3,500 pts. Funds reflect in your wallet immediately.</p>"
        ),
        cta_label="View wallet",
        cta_url="https://networkcapitalapp.co.za/wallet",
    )


def _official_broadcast_html(*, recipient_name: str, headline: str, content_preview: str, post_id: str) -> str:    return _branded_email_html(
        headline=headline,
        body_html=(
            f"<p>Hi {recipient_name},</p>"
            f"<p>The Network Capital team just shared an update with the community:</p>"
            f"<blockquote style='margin:12px 0;padding:12px 16px;border-left:3px solid #f5d76e;background:rgba(245,215,110,0.06);"
            f"color:#e2e8f0;font-size:14px;line-height:22px;border-radius:0 8px 8px 0;'>{content_preview}</blockquote>"
            f"<p style='font-size:12px;color:#94a3b8;'>Read the full post and react in the app.</p>"
        ),
        cta_label="Open in app",
        cta_url=f"https://networkcapitalapp.co.za/feed?post={post_id}",
        kicker="Network Capital · Official",
    )


# ─── Hook helpers — fire-and-forget, never raise ─────────────────────────────
async def _notify_wallet_credit(user_id: str, amount_usd: float, reason: str) -> None:
    """Email the user when their wallet is credited. Skips on debit / no email."""
    try:
        if amount_usd <= 0:
            return
        user = await db.users.find_one(
            {"id": user_id},
            {"_id": 0, "email": 1, "full_name": 1, "username": 1, "wallet_balance": 1, "email_verified": 1},
        )
        if not user or not user.get("email") or not user.get("email_verified"):
            return
        await _send_branded_email(
            to=str(user["email"]).strip().lower(),
            subject=f"+${amount_usd:.2f} added to your Network Capital wallet",
            html=_wallet_credit_html(
                name=(user.get("full_name") or user.get("username") or "there"),
                amount_usd=float(amount_usd),
                reason=reason,
                new_balance=float(user.get("wallet_balance", 0.0)),
            ),
            kind="wallet_credit",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[MAIL-FAIL:wallet_credit] user={user_id} err={exc}")


def _role_change_html(*, name: str, previous_role: str, new_role: str, granted: bool) -> str:
    """Friendly explainer for each role — keeps the email actionable."""
    role_blurbs = {
        "admin": "You now have admin privileges — manage users, content, and platform-wide settings.",
        "moderator": "You're now a moderator — help keep the community healthy by reviewing flagged content.",
        "ambassador": "Welcome to the Ambassador programme — invite members, build influence, unlock exclusive rewards.",
        "super_admin": "You're the platform owner. Wallet adjustments and system-wide controls are now available to you.",
        "user": "Your access has been updated to a standard member.",
    }
    pretty_new = (new_role or "user").replace("_", " ").title()
    pretty_prev = (previous_role or "user").replace("_", " ").title()
    headline = (
        f"You've been granted the {pretty_new} role"
        if granted else
        f"Your {pretty_prev} role has been revoked"
    )
    body = (
        f"<p>Hi {name},</p>"
        f"<p>{('You have been promoted to' if granted else 'Your role has been changed from')} "
        f"<strong style='color:#f5d76e;'>{pretty_prev}</strong> "
        f"<span style='color:#94a3b8;'>→</span> "
        f"<strong style='color:#f5d76e;'>{pretty_new}</strong>.</p>"
        f"<p>{role_blurbs.get(new_role if granted else 'user', '')}</p>"
        f"<p style='font-size:12px;color:#94a3b8;'>If you didn't expect this change, contact support immediately.</p>"
    )
    return _branded_email_html(
        headline=headline,
        body_html=body,
        cta_label="Open Network Capital",
        cta_url="https://networkcapitalapp.co.za/",
    )


async def _notify_role_change(*, user: dict, previous_role: str, new_role: str, actor_username: str) -> None:
    """Fire-and-forget email + in-app notification for any role change."""
    try:
        email = (user.get("email") or "").strip().lower()
        # Define which transitions count as "grant" (everything except → user/default).
        granted = (new_role not in ("user",))
        # In-app notification (always)
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "type": "role_change",
            "title": f"Role updated — {new_role.replace('_',' ').title()}",
            "message": f"Your role changed from {previous_role} to {new_role}",
            "points": 0,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        if not email or not user.get("email_verified"):
            return
        await _send_branded_email(
            to=email,
            subject=f"Your Network Capital role is now: {new_role.replace('_',' ').title()}",
            html=_role_change_html(
                name=(user.get("full_name") or user.get("username") or "there"),
                previous_role=previous_role,
                new_role=new_role,
                granted=granted,
            ),
            kind="role_change",
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[MAIL-FAIL:role_change] user={user.get('id')} err={exc}")


OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 30


@api_router.post("/auth/send-otp")
async def send_otp(request: SendOtpRequest, current_user: dict = Depends(get_current_user)):
    """Send a 6-digit verification code to the user's email. MOCK — logs to backend."""
    if current_user.get("email_verified"):
        return {"sent": True, "already_verified": True, "message": "Email already verified."}

    # Rate-limit resends per user
    last = await db.otps.find_one(
        {"user_id": current_user["id"]},
        sort=[("created_at", -1)],
    )
    if last:
        try:
            last_dt = datetime.fromisoformat(last["created_at"].replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - last_dt).total_seconds()
            if elapsed < OTP_RESEND_COOLDOWN_SECONDS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Please wait {int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)}s before requesting another code.",
                )
        except (ValueError, TypeError):
            pass

    code = _generate_otp()
    now = datetime.now(timezone.utc)
    await db.otps.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "email": (request.email or current_user.get("email") or "").lower(),
        "code_hash": hash_password(code),  # never store plaintext
        "attempts": 0,
        "verified": False,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(minutes=OTP_TTL_MINUTES)).isoformat(),
    })

    target_email = (request.email or current_user.get("email") or "").strip().lower()
    delivered = await _send_otp_email(target_email, code)

    response = {
        "sent": True,
        "delivered": delivered,
        "ttl_minutes": OTP_TTL_MINUTES,
        "message": "Verification code sent. Check your inbox." if delivered else "Verification code generated (fallback mode — see backend logs).",
    }
    # Only expose the code when the real email provider could not deliver it,
    # so QA / non-verified domains still complete the flow during development.
    if not delivered:
        response["_mock_code"] = code
    return response


@api_router.post("/auth/verify-otp")
async def verify_otp(request: VerifyOtpRequest, current_user: dict = Depends(get_current_user)):
    """Verify a 6-digit code emailed to the user."""
    if current_user.get("email_verified"):
        return {"verified": True, "already_verified": True}

    record = await db.otps.find_one(
        {"user_id": current_user["id"], "verified": False},
        sort=[("created_at", -1)],
    )
    if not record:
        raise HTTPException(status_code=400, detail="No active verification code. Request a new one.")

    # Expiry
    try:
        expires_dt = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > expires_dt:
            raise HTTPException(status_code=400, detail="Code expired. Request a new one.")
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid code record. Request a new one.")

    # Attempts
    if int(record.get("attempts", 0)) >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new code.")

    code_clean = (request.code or "").strip()
    if not code_clean or not verify_password(code_clean, record["code_hash"]):
        await db.otps.update_one({"id": record["id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Incorrect code.")

    await db.otps.update_one({"id": record["id"]}, {"$set": {"verified": True}})
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"email_verified": True, "email_verified_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"verified": True}


# ============== REFERRAL ATTRIBUTION (anti-abuse) ==============
class CaptureReferrerRequest(BaseModel):
    ref: str  # canonical referral_code OR username (case-insensitive)
    joined: Optional[str] = None
    bm: Optional[str] = None


@api_router.post("/referrals/capture")
async def capture_referrer(payload: CaptureReferrerRequest, current_user: dict = Depends(get_current_user)):
    """Called by frontend when an authed user opens the app via a /join?ref=… link.
    Attribution is *pending* — referrer is rewarded only when this user verifies email
    AND completes their profile (see _maybe_reward_referrer)."""
    if not payload.ref:
        raise HTTPException(status_code=400, detail="ref required")

    # Already attributed? skip
    if current_user.get("referred_by"):
        return {"already_attributed": True}

    ref = payload.ref.strip()
    # Resolution order:
    #   1) New friendly share_code  (e.g., networkcapitalapp.maria.06.42)
    #   2) Legacy uppercase referral_code (e.g., 00EC4A27)
    #   3) Username
    referrer = await db.users.find_one(
        {"$or": [
            {"share_code": ref.lower()},
            {"share_code": ref},
            {"referral_code": ref.upper()},
            {"referral_code": ref},
            {"username": ref.lower()},
            {"username": ref},
        ]},
        {"_id": 0, "id": 1, "username": 1, "referral_code": 1, "share_code": 1, "email": 1},
    )
    if not referrer:
        raise HTTPException(status_code=404, detail="Referrer not found")
    if referrer["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="Self-referral not allowed")

    # Same-email collusion check — referrer email and invitee email must differ
    if (referrer.get("email") or "").lower() == (current_user.get("email") or "").lower():
        raise HTTPException(status_code=400, detail="Referrer and invitee email cannot match")

    # Attach pending attribution to invitee user
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "referred_by": referrer["id"],
            "referrer_id": referrer["id"],
            "referral_attribution": {
                "referrer_id": referrer["id"],
                "referrer_username": referrer.get("username"),
                "ref_used": ref,
                "joined": payload.joined,
                "birth_month_hint": payload.bm,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "status": "pending",  # pending | rewarded | rejected
            },
        }},
    )

    # Idempotent: rewarded only after both checks pass (handled in _maybe_reward_referrer)
    return {"attributed": True, "referrer_username": referrer.get("username")}


REFERRAL_DAILY_REWARD_CAP = 10  # max referral rewards a single user can receive per day


async def _maybe_reward_referrer(user: dict) -> None:
    """Per the iter-22 refactor, the referrer is rewarded ONLY when the invitee actually
    crosses 1,000 monthly_score (handled inside award_points()). This function now only
    transitions referral_attribution.status from 'pending' → 'verified' once the invitee
    has email_verified + profile_completed — proving the account is real."""
    attribution = user.get("referral_attribution") or {}
    if not attribution or attribution.get("status") != "pending":
        return
    if not user.get("email_verified") or not user.get("profile_completed"):
        return
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"referral_attribution.status": "verified"}},
    )




@api_router.post("/auth/complete-profile")
async def complete_profile(request: CompleteProfileRequest, current_user: dict = Depends(get_current_user)):
    """Step 2: Complete profile and select intent"""
    # Email must be verified before profile can be completed (mock OTP)
    if not current_user.get("email_verified"):
        raise HTTPException(status_code=403, detail="Email not verified. Please verify your email first.")

    # Check username availability
    existing = await db.users.find_one({"username": request.username, "id": {"$ne": current_user["id"]}})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Validate region cascade if provided
    if request.country and request.country not in AFRICAN_REGIONS:
        raise HTTPException(status_code=400, detail="Unknown country")
    if request.country and request.province:
        provs = AFRICAN_REGIONS[request.country]["provinces"]
        if request.province not in provs:
            raise HTTPException(status_code=400, detail="Unknown province for country")

    update_data = {
        "full_name": request.full_name,
        "username": request.username,
        "bio": request.bio or "",
        "user_type": request.intent,
        "is_creator": request.intent == "creator",
        "profile_completed": True,
        "onboarding_step": 3 if request.intent == "creator" else 0,
        "terms_accepted": request.terms_accepted,
        "terms_accepted_at": datetime.now(timezone.utc).isoformat() if request.terms_accepted else None,
    }
    if request.country:
        update_data["country"] = request.country
    if request.province:
        update_data["province"] = request.province
    if request.city:
        update_data["city"] = request.city
    if request.birth_month is not None:
        if not (1 <= int(request.birth_month) <= 12):
            raise HTTPException(status_code=400, detail="birth_month must be 1-12")
        update_data["birth_month"] = int(request.birth_month)
    if request.user_kind:
        if request.user_kind not in ("social", "professional"):
            raise HTTPException(status_code=400, detail="user_kind must be 'social' or 'professional'")
        update_data["user_kind"] = request.user_kind
    if request.bank_name and request.account_number and request.swift_code and request.branch_number:
        update_data["banking"] = {
            "bank_name": request.bank_name.strip(),
            "account_number": request.account_number.strip(),
            "swift_code": request.swift_code.strip().upper(),
            "branch_number": request.branch_number.strip(),
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }

    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )

    # Refresh share_code now that username + birth_month are committed
    await _refresh_share_code(current_user["id"])

    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})

    # +250 once for completing the profile
    if not current_user.get("profile_completed"):
        await award_points(current_user["id"], "profile_completed", 0, source_id=current_user["id"], message="Profile completed — welcome bonus")
        # Welcome email (fire-and-forget)
        try:
            await _send_branded_email(
                to=(current_user.get("email") or "").strip().lower(),
                subject="Welcome to Network Capital",
                html=_welcome_email_html(name=(request.full_name or current_user.get("username") or "there")),
                kind="welcome",
            )
        except Exception:  # noqa: BLE001
            pass

    # Anti-abuse referral payout — only fires if invitee has BOTH verified email AND completed profile
    await _maybe_reward_referrer(updated_user)
    # Re-fetch user so the response reflects any score change
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})

    return {
        "user": updated_user,
        "next_step": 3 if request.intent == "creator" else 0,
        "message": "Profile completed" if request.intent != "creator" else "Profile completed. Create your first product."
    }


@api_router.post("/users/me/banking")
async def update_banking(payload: BankingDetailsRequest, current_user: dict = Depends(get_current_user)):
    """Save / update banking details. Required for Stokvel participation."""
    banking = {
        "bank_name": payload.bank_name.strip(),
        "account_number": payload.account_number.strip(),
        "swift_code": payload.swift_code.strip().upper(),
        "branch_number": payload.branch_number.strip(),
        "saved_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"banking": banking}})
    return {"banking_saved": True, "message": "Banking details saved securely."}


@api_router.get("/users/me/banking")
async def get_banking(current_user: dict = Depends(get_current_user)):
    """Returns whether banking is on file (and a masked summary). Never returns full account number."""
    b = current_user.get("banking") or {}
    if not b:
        return {"on_file": False}
    acc = b.get("account_number", "")
    masked = ("•" * max(0, len(acc) - 4)) + acc[-4:] if acc else ""
    return {
        "on_file": True,
        "bank_name": b.get("bank_name"),
        "account_last4": acc[-4:] if acc else "",
        "account_masked": masked,
        "swift_code": b.get("swift_code"),
        "branch_number": b.get("branch_number"),
    }

# ============== ADMIN ENDPOINTS ==============

@api_router.get("/admin/users")
async def get_all_users(_: bool = Depends(verify_admin)):
    """Get all users for admin dashboard"""
    users = await db.users.find(
        {},
        {
            "_id": 0,
            "password": 0  # Exclude password
        }
    ).sort("created_at", -1).to_list(1000)
    
    return {"users": users, "total": len(users)}

@api_router.get("/admin/stats")
async def get_admin_stats(_: bool = Depends(verify_admin)):
    """Get overall platform statistics"""
    total_users = await db.users.count_documents({})
    
    # Get today's signups
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    new_users_today = await db.users.count_documents({
        "created_at": {"$gte": today_start.isoformat()}
    })
    
    # Aggregate stats
    pipeline = [
        {
            "$group": {
                "_id": None,
                "total_wallet_balance": {"$sum": "$wallet_balance"},
                "avg_network_score": {"$avg": "$network_score"},
                "total_referrals": {
                    "$sum": {"$cond": [{"$ne": ["$referred_by_code", None]}, 1, 0]}
                }
            }
        }
    ]
    
    stats_result = await db.users.aggregate(pipeline).to_list(1)
    stats = stats_result[0] if stats_result else {}
    
    return {
        "total_users": total_users,
        "new_users_today": new_users_today,
        "total_wallet_balance": stats.get("total_wallet_balance", 0),
        "avg_network_score": stats.get("avg_network_score", 0),
        "total_referrals": stats.get("total_referrals", 0)
    }

@api_router.get("/admin/users/{user_id}/details")
async def get_user_details(user_id: str, _: bool = Depends(verify_admin)):
    """Get detailed user info including their stokvels"""
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's stokvels
    stokvels = await db.stokvels.find(
        {"members.user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"user": user, "stokvels": stokvels}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)



logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# AI COMMENT RELEVANCE — Tier 3 anti-spam gate for comment_quality awards
# ============================================================================

def _heuristic_relevance(post_text: str, comment_text: str, prior_comments: List[str]) -> Dict[str, Any]:
    """Cheap deterministic fallback when the LLM isn't reachable. Mirrors the spec rules:
       • ≥5 meaningful words • not a duplicate • not gibberish/emoji-only."""
    import re as _re
    txt = (comment_text or "").strip()
    if not txt:
        return {"score": 0.0, "quality": "low", "flag": "empty"}
    # gibberish / emoji-only
    letters = _re.findall(r"[A-Za-zÀ-ÖØ-öø-ÿ]", txt)
    if len(letters) < len(txt) * 0.4:
        return {"score": 0.1, "quality": "low", "flag": "gibberish_or_emoji"}
    words = [w for w in _re.split(r"\s+", txt) if len(w) >= 2]
    if len(words) < 5:
        return {"score": 0.2, "quality": "low", "flag": "too_short"}
    # duplicate of any prior comment by same user
    norm = txt.lower()
    if any(norm == (p or "").lower().strip() for p in prior_comments):
        return {"score": 0.0, "quality": "low", "flag": "duplicate"}
    # Lexical overlap with post text — naive proxy for semantic relevance
    post_terms = set(_re.findall(r"[a-zA-ZÀ-ÖØ-öø-ÿ]{3,}", (post_text or "").lower()))
    com_terms = set(_re.findall(r"[a-zA-ZÀ-ÖØ-öø-ÿ]{3,}", txt.lower()))
    overlap = len(post_terms & com_terms)
    score = 0.5 + min(0.4, overlap * 0.1)
    return {"score": round(score, 2), "quality": "quality" if score >= 0.6 else "low", "flag": None}


async def _score_comment_relevance(post_text: str, comment_text: str, user_id: str) -> Dict[str, Any]:
    """Scores comment relevance 0–1.0 against the post. Uses an LLM if EMERGENT_LLM_KEY is
    configured; otherwise falls back to a deterministic heuristic. Always returns a dict
    {score, quality, flag} where quality ∈ {'quality','low'}."""
    # Prior comments by this user — for duplicate detection
    prior_cursor = db.posts.aggregate([
        {"$unwind": "$comments"},
        {"$match": {"comments.user_id": user_id}},
        {"$project": {"_id": 0, "content": "$comments.content"}},
        {"$limit": 50},
    ])
    prior_comments = [doc.get("content", "") async for doc in prior_cursor]

    # Run heuristic first — cheap, fast, catches obvious abuse
    heur = _heuristic_relevance(post_text, comment_text, prior_comments)
    # Don't bother with LLM if heuristic already disqualifies (duplicate/gibberish/empty/short)
    if heur["flag"] in {"duplicate", "gibberish_or_emoji", "too_short", "empty"}:
        return heur

    # Otherwise call the LLM for nuanced semantic scoring
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        return heur
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=api_key,
            session_id=f"comment-rel-{user_id}",
            system_message=(
                "You score how relevant a comment is to a post. "
                "Return ONLY a single number between 0.0 and 1.0 (no words, no JSON). "
                "0.0 = irrelevant, off-topic, spam, or gibberish. "
                "1.0 = highly relevant and meaningful."
            ),
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        prompt = f"POST:\n{(post_text or '')[:600]}\n\nCOMMENT:\n{comment_text[:400]}\n\nScore (0.0–1.0):"
        raw = await chat.send_message(UserMessage(text=prompt))
        import re as _re
        m = _re.search(r"\b(?:0?\.\d{1,3}|1(?:\.0+)?|0|1)\b", str(raw))
        if not m:
            return heur
        score = max(0.0, min(1.0, float(m.group(0))))
        return {
            "score": round(score, 2),
            "quality": "quality" if score >= 0.6 else "low",
            "flag": None if score >= 0.6 else "low_relevance",
        }
    except Exception as e:
        logger.warning(f"LLM relevance scorer fell back to heuristic: {e}")
        return heur


# ============================================================================
# AD & VIDEO COMPLETION — T1 / T3 score endpoints
# ============================================================================

class AdEventRequest(BaseModel):
    ad_id: str
    action: str  # "engage" or "share"


@api_router.post("/score/ad-event")
async def ad_event(payload: AdEventRequest, current_user: dict = Depends(get_current_user)):
    """T1 ad engagement scoring.
       action='engage' → +500 (cap 5/day, 24h cooldown on same ad)
       action='share'  → diminishing 300/150/50/50/50 per unique ad (max 5 shares)"""
    if not payload.ad_id:
        raise HTTPException(status_code=400, detail="ad_id required")
    act = (payload.action or "").lower().strip()
    if act not in ("engage", "share"):
        raise HTTPException(status_code=400, detail="action must be 'engage' or 'share'")
    score_action = "ad_watch_engage" if act == "engage" else "ad_watch_share"
    awarded = await award_points(
        current_user["id"], score_action, 0,
        source_id=payload.ad_id,
        message=f"Ad {act} on {payload.ad_id}",
    )
    return {"awarded": awarded, "action": score_action, "ad_id": payload.ad_id}


class VideoWatchRequest(BaseModel):
    video_id: str


@api_router.post("/score/video-watched")
async def video_watched(payload: VideoWatchRequest, current_user: dict = Depends(get_current_user)):
    """T3 — non-ad video watched to completion. +10 (cap 10/day, 24h cooldown)."""
    if not payload.video_id:
        raise HTTPException(status_code=400, detail="video_id required")
    awarded = await award_points(
        current_user["id"], "video_watched", 0,
        source_id=payload.video_id,
        message="Watched a video to completion",
    )
    return {"awarded": awarded, "video_id": payload.video_id}


# ============================================================================
# ACCOUNT MANAGEMENT — Deactivate (reversible) + Delete (30-day grace)
# ============================================================================

class DeactivateAccountRequest(BaseModel):
    reason: Optional[str] = None


class DeleteAccountRequest(BaseModel):
    confirm: str  # must equal exactly the user's username
    reason: Optional[str] = None


@api_router.post("/account/deactivate")
async def deactivate_account(payload: DeactivateAccountRequest, current_user: dict = Depends(get_current_user)):
    """Temporarily deactivate the account. Profile hidden, can't post, but reactivates
    automatically the next time the user logs in. All data preserved."""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "deactivated": True,
            "deactivated_at": datetime.now(timezone.utc).isoformat(),
            "deactivation_reason": (payload.reason or "")[:300] or None,
        }},
    )
    return {"deactivated": True, "message": "Account deactivated. Log in again any time to reactivate."}


@api_router.post("/account/reactivate")
async def reactivate_account(current_user: dict = Depends(get_current_user)):
    """Cancel a pending deactivation."""
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"deactivated": False}, "$unset": {"deactivated_at": "", "deactivation_reason": ""}},
    )
    return {"reactivated": True}


@api_router.post("/account/delete")
async def delete_account(payload: DeleteAccountRequest, current_user: dict = Depends(get_current_user)):
    """Soft-delete with a 30-day grace period. After 30 days the user document is
    hard-deleted. Premium subscriptions auto-cancel at Stripe (best-effort).
    Confirmation: payload.confirm must equal the user's exact username."""
    expected = (current_user.get("username") or "").strip()
    if not payload.confirm or payload.confirm.strip() != expected:
        raise HTTPException(status_code=400, detail=f"Type your username '{expected}' to confirm deletion.")

    # Best-effort: cancel Stripe subscription if any
    try:
        if current_user.get("stripe_subscription_id"):
            import stripe as _stripe
            api_key = os.environ.get("STRIPE_API_KEY")
            if api_key:
                _stripe.api_key = api_key
                _stripe.Subscription.delete(current_user["stripe_subscription_id"])
    except Exception as e:
        logger.warning(f"Stripe sub cancel skipped for {current_user['id']}: {e}")

    purge_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {
            "pending_deletion": True,
            "deletion_requested_at": datetime.now(timezone.utc).isoformat(),
            "deletion_purge_at": purge_at,
            "deactivated": True,  # also hide immediately
            "deletion_reason": (payload.reason or "")[:300] or None,
        }},
    )
    return {
        "deletion_scheduled": True,
        "purge_at": purge_at,
        "message": "Your account is scheduled for deletion in 30 days. Log in any time within 30 days to cancel.",
    }


@api_router.post("/account/cancel-deletion")
async def cancel_deletion(current_user: dict = Depends(get_current_user)):
    """Cancel a pending account deletion (works any time within the 30-day grace)."""
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$set": {"pending_deletion": False, "deactivated": False},
            "$unset": {"deletion_purge_at": "", "deletion_requested_at": "", "deletion_reason": ""},
        },
    )
    return {"cancelled": True, "message": "Deletion cancelled. Welcome back."}


@app.on_event("startup")
async def ensure_indexes():
    """Idempotent index creation for security-critical collections.

    ``ad_reward_claims.key`` MUST be unique to atomically prevent duplicate ad-reward
    claims (race-condition proof).  Also indexes the wallet adjustment audit log."""
    try:
        await db.ad_reward_claims.create_index("key", unique=True, background=True)
    except Exception as e:
        logger.warning(f"ad_reward_claims index ensure failed: {e}")
    try:
        await db.wallet_adjustments_audit.create_index("created_at", background=True)
        await db.wallet_adjustments_audit.create_index("target_user_id", background=True)
    except Exception as e:
        logger.warning(f"wallet_adjustments_audit index ensure failed: {e}")



@app.on_event("startup")
async def bootstrap_super_admin():
    """Ensure the Platform Owner has the `super_admin` role — and that they are the
    ONLY user with that role. Any other accounts holding super_admin are demoted
    to plain ``admin`` automatically on each boot. Idempotent."""
    try:
        target_email = (SUPER_ADMIN_EMAIL or "").strip().lower()
        if not target_email:
            return
        owner = await db.users.find_one(
            {"email": target_email},
            {"_id": 0, "id": 1, "role": 1},
        )
        if owner and owner.get("role") != "super_admin":
            await db.users.update_one(
                {"id": owner["id"]},
                {"$set": {"role": "super_admin", "is_ambassador": False}},
            )
            logger.info(f"[BOOTSTRAP] Promoted {target_email} to super_admin")

        # Enforce SOLE super_admin — demote any other super_admins to plain admin.
        # Compares by id (not by email) so we don't accidentally demote the owner
        # because of email casing differences in the DB.
        owner_id = (owner or {}).get("id")
        demote_query: Dict[str, Any] = {"role": "super_admin"}
        if owner_id:
            demote_query["id"] = {"$ne": owner_id}
        demoted = await db.users.update_many(
            demote_query,
            {"$set": {"role": "admin"}},
        )
        if demoted.modified_count:
            logger.warning(
                f"[BOOTSTRAP] Demoted {demoted.modified_count} non-owner super_admin(s) → admin"
            )
    except Exception as e:
        logger.warning(f"bootstrap_super_admin skipped: {e}")


# ============== JUNE 2026 PAYOUT BLOCK ==============
# Hard server-side gate: no withdrawals (creation or admin approval) before
# the cutoff. After cutoff, normal flow resumes. The window is configurable
# via env if the policy shifts.
JUNE_PAYOUT_RELEASE_AT = datetime(2026, 6, 30, 21, 59, 59, tzinfo=timezone.utc)  # 23:59:59 SAST


def _is_june_payout_locked() -> bool:
    return datetime.now(timezone.utc) < JUNE_PAYOUT_RELEASE_AT


def _june_payout_message() -> str:
    return ("All June withdrawals are processed from 30 June 2026 (23:59 SAST). "
            "Requests submitted earlier remain pending until the release date.")


@app.on_event("startup")
async def purge_overdue_deletions():
    """Hard-delete user docs whose 30-day deletion grace has elapsed."""
    try:
        cutoff = datetime.now(timezone.utc).isoformat()
        async for u in db.users.find(
            {"pending_deletion": True, "deletion_purge_at": {"$lte": cutoff}},
            {"_id": 0, "id": 1},
        ):
            uid = u["id"]
            try:
                await db.users.delete_one({"id": uid})
                # Sweep direct-PII collections; community content (posts/comments) intentionally
                # left in place but anonymised by removing ownership reference.
                await db.dm_messages.delete_many({"$or": [{"sender_id": uid}, {"recipient_id": uid}]})
                await db.notifications.delete_many({"user_id": uid})
                await db.otps.delete_many({"user_id": uid})
                await db.score_events.delete_many({"user_id": uid})
                logger.info(f"Hard-deleted user {uid} after 30-day grace")
            except Exception as e:
                logger.warning(f"purge failed for {uid}: {e}")
    except Exception as e:
        logger.warning(f"purge_overdue_deletions skipped: {e}")


@app.on_event("startup")
async def backfill_share_codes():
    """Idempotently backfill share_code for any existing users missing it."""
    try:
        async for u in db.users.find({"share_code": {"$exists": False}}, {"_id": 0, "id": 1, "username": 1, "birth_month": 1}):
            code = build_share_code(u.get("username"), u.get("birth_month"), u["id"])
            await db.users.update_one({"id": u["id"]}, {"$set": {"share_code": code}})
    except Exception as e:
        logger.warning(f"share_code backfill skipped: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ============================================================================
# JOBS FEATURE — iter 24
# ============================================================================
# Two roles: employer (post jobs, requires $50 once-off Stripe unlock) and
# employee (browse + apply with CV). Network Capital seed Business Developer
# Agent listing is created at startup (idempotent).

JOB_POST_FEE_USD = 50.00


class CreateJobRequest(BaseModel):
    title: str
    company: Optional[str] = None
    location: Optional[str] = "Remote"
    employment_type: Optional[str] = "Full-time"  # Full-time | Part-time | Contract | Performance & Growth Focused | etc.
    salary: Optional[str] = ""  # free-form: e.g., "R8,500 CTC + Performance Commission"
    description: str
    responsibilities: Optional[List[str]] = []
    requirements: Optional[List[str]] = []
    skills: Optional[List[str]] = []
    application_steps: Optional[List[str]] = []
    contact_email: Optional[str] = None
    min_network_score: Optional[int] = 0


class UpdateJobRequest(BaseModel):
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None
    salary: Optional[str] = None
    description: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    requirements: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    application_steps: Optional[List[str]] = None
    contact_email: Optional[str] = None
    min_network_score: Optional[int] = None
    status: Optional[str] = None  # "open" | "closed"


class ApplyJobRequest(BaseModel):
    # CV file is uploaded as base64 (small files only — full migration to S3/R2 is on the P2 backlog)
    cv_filename: str
    cv_data_url: str  # data:application/pdf;base64,... or word
    cover_note: Optional[str] = ""


class UpdateApplicationRequest(BaseModel):
    status: str  # "new" | "shortlisted" | "interview" | "rejected" | "hired"
    note: Optional[str] = None


@api_router.post("/jobs/checkout")
async def jobs_checkout(req: Request, current_user: dict = Depends(get_current_user)):
    """Generate a Stripe Checkout session for the $50 once-off employer unlock.
    Idempotent: if already unlocked, returns 400 to prevent double-charging."""
    if current_user.get("job_post_unlocked"):
        raise HTTPException(status_code=400, detail="Job posting is already unlocked for your account.")

    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Payments are not configured.")

    origin = req.headers.get("origin") or req.headers.get("referer", "").rstrip("/") or "https://networkcapitalapp.co.za"
    success_url = f"{origin}/jobs?checkout_status=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/jobs?checkout_status=cancel"

    webhook_url = f"{(os.environ.get('REACT_APP_BACKEND_URL') or origin).rstrip('/')}/api/webhook/stripe"
    checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    metadata = {
        "user_id": current_user["id"],
        "purpose": "jobs_employer_unlock",
        "fee_usd": str(JOB_POST_FEE_USD),
    }
    session_request = CheckoutSessionRequest(
        amount=JOB_POST_FEE_USD,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session: CheckoutSessionResponse = await checkout.create_checkout_session(session_request)

    await db.transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "type": "jobs_employer_unlock",
        "amount": JOB_POST_FEE_USD,
        "currency": "USD",
        "status": "pending",
        "stripe_session_id": session.session_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id}


@api_router.get("/jobs/checkout/status/{session_id}")
async def jobs_checkout_status(session_id: str, current_user: dict = Depends(get_current_user)):
    """Polled by frontend after redirect. Marks job_post_unlocked=true on success."""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Payments are not configured.")

    webhook_url = (os.environ.get("REACT_APP_BACKEND_URL") or "https://networkcapitalapp.co.za").rstrip("/") + "/api/webhook/stripe"
    checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    status: CheckoutStatusResponse = await checkout.get_checkout_status(session_id)

    if status.payment_status == "paid":
        # Idempotent unlock + transaction-status update
        await db.users.update_one(
            {"id": current_user["id"]},
            {"$set": {"job_post_unlocked": True, "job_post_unlocked_at": datetime.now(timezone.utc).isoformat()}},
        )
        await db.transactions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}},
        )

    return {
        "payment_status": status.payment_status,
        "status": status.status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }


@api_router.post("/jobs", response_model=Dict[str, Any])
async def create_job(req: CreateJobRequest, current_user: dict = Depends(get_current_user)):
    """Create a job posting. Requires $50 once-off employer unlock OR seeded Network Capital admin."""
    if not current_user.get("job_post_unlocked") and not current_user.get("is_admin"):
        raise HTTPException(
            status_code=402,
            detail=f"Posting jobs requires a one-time ${int(JOB_POST_FEE_USD)} unlock. Tap 'Unlock Job Posting' on the Jobs page.",
        )
    if not (req.title or "").strip() or not (req.description or "").strip():
        raise HTTPException(status_code=400, detail="Title and description are required.")

    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "employer_id": current_user["id"],
        "employer_username": current_user.get("username"),
        "company": (req.company or current_user.get("full_name") or current_user.get("username") or "").strip(),
        "title": req.title.strip()[:140],
        "location": (req.location or "Remote").strip()[:80],
        "employment_type": (req.employment_type or "Full-time").strip()[:50],
        "salary": (req.salary or "").strip()[:80],
        "description": req.description.strip()[:6000],
        "responsibilities": [s.strip() for s in (req.responsibilities or []) if s.strip()][:30],
        "requirements": [s.strip() for s in (req.requirements or []) if s.strip()][:30],
        "skills": [s.strip() for s in (req.skills or []) if s.strip()][:20],
        "application_steps": [s.strip() for s in (req.application_steps or []) if s.strip()][:10],
        "contact_email": (req.contact_email or "").strip().lower() or None,
        "min_network_score": max(0, int(req.min_network_score or 0)),
        "status": "open",
        "applications_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.jobs.insert_one(job)
    job.pop("_id", None)
    return job


@api_router.get("/jobs")
async def list_jobs(q: Optional[str] = None, location: Optional[str] = None, limit: int = 30, skip: int = 0):
    """Public list of open jobs, paginated. Supports text search on title/company/skills."""
    query: Dict[str, Any] = {"status": "open"}
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [{"title": rx}, {"company": rx}, {"skills": rx}, {"description": rx}]
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    cursor = db.jobs.find(query, {"_id": 0}).sort("created_at", -1).skip(max(0, skip)).limit(min(50, max(1, limit)))
    return await cursor.to_list(length=limit)


@api_router.get("/jobs/me/posted")
async def my_posted_jobs(current_user: dict = Depends(get_current_user)):
    cursor = db.jobs.find({"employer_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)


@api_router.get("/jobs/me/applied")
async def my_applications(current_user: dict = Depends(get_current_user)):
    """Applications the current user has submitted, joined with job summary."""
    apps = await db.job_applications.find(
        {"applicant_id": current_user["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=200)
    # Hydrate each application with its job (title/company/status)
    job_ids = list({a["job_id"] for a in apps})
    if job_ids:
        jobs = await db.jobs.find({"id": {"$in": job_ids}}, {"_id": 0, "id": 1, "title": 1, "company": 1, "status": 1, "location": 1}).to_list(length=200)
        job_map = {j["id"]: j for j in jobs}
        for a in apps:
            a["job"] = job_map.get(a["job_id"])
    return apps


@api_router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@api_router.patch("/jobs/{job_id}")
async def update_job(job_id: str, req: UpdateJobRequest, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["employer_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only edit your own jobs")
    update = {k: v for k, v in req.dict(exclude_unset=True).items() if v is not None}
    if "status" in update and update["status"] not in ("open", "closed"):
        raise HTTPException(status_code=400, detail="status must be 'open' or 'closed'")
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.jobs.update_one({"id": job_id}, {"$set": update})
    return await db.jobs.find_one({"id": job_id}, {"_id": 0})


@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["employer_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own jobs")
    await db.jobs.delete_one({"id": job_id})
    await db.job_applications.delete_many({"job_id": job_id})
    return {"deleted": True}


@api_router.post("/jobs/{job_id}/apply")
async def apply_to_job(job_id: str, req: ApplyJobRequest, current_user: dict = Depends(get_current_user)):
    """Submit an application. CV file (PDF or Word) uploaded as a data URL.
    Anti-abuse: one application per user per job."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "open":
        raise HTTPException(status_code=400, detail="This job is no longer accepting applications.")
    if job["employer_id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="You can't apply to your own job posting.")

    # Network Score gate (e.g., Network Capital BD agent requires ≥2,000)
    min_score = int(job.get("min_network_score") or 0)
    if min_score > 0 and int(current_user.get("network_score") or 0) < min_score:
        raise HTTPException(
            status_code=403,
            detail=f"This role requires a minimum Network Score of {min_score:,}. You currently have {int(current_user.get('network_score') or 0):,}.",
        )

    # CV format validation
    fname = (req.cv_filename or "").strip().lower()
    if not (fname.endswith(".pdf") or fname.endswith(".doc") or fname.endswith(".docx")):
        raise HTTPException(status_code=400, detail="CV must be a PDF or Word document (.pdf, .doc, .docx).")
    data_url = req.cv_data_url or ""
    if not data_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="CV upload must be a base64 data URL.")
    # Approximate size check on the b64 payload — keep CVs ≤ 5MB to avoid Mongo doc bloat
    try:
        b64part = data_url.split(",", 1)[1]
        approx_bytes = (len(b64part) * 3) // 4
        if approx_bytes > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="CV is too large. Max 5MB.")
    except (IndexError, ValueError):
        raise HTTPException(status_code=400, detail="Could not read CV data.")

    # One application per (job, user)
    existing = await db.job_applications.find_one({"job_id": job_id, "applicant_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="You've already applied to this job.")

    app_id = str(uuid.uuid4())
    application = {
        "id": app_id,
        "job_id": job_id,
        "applicant_id": current_user["id"],
        "applicant_username": current_user.get("username"),
        "applicant_full_name": current_user.get("full_name"),
        "applicant_photo": current_user.get("photo"),
        "applicant_network_score": int(current_user.get("network_score") or 0),
        "cv_filename": req.cv_filename.strip(),
        "cv_data_url": data_url,
        "cover_note": (req.cover_note or "").strip()[:2000],
        "status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.job_applications.insert_one(application)
    await db.jobs.update_one({"id": job_id}, {"$inc": {"applications_count": 1}})

    # Notify employer
    try:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": job["employer_id"],
            "type": "job_application",
            "title": "New job application",
            "message": f"@{current_user.get('username')} applied for {job.get('title')}",
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "link": f"/jobs/{job_id}/applications",
        })
    except Exception:
        pass

    # Email the employer
    try:
        employer = await db.users.find_one({"id": job["employer_id"]}, {"_id": 0, "email": 1})
        if employer and employer.get("email"):
            await _send_branded_email(
                to=employer["email"].strip().lower(),
                subject=f"New application: {job.get('title','your job')}",
                html=_job_application_received_email_html(
                    applicant_name=current_user.get("full_name") or current_user.get("username") or "An applicant",
                    job_title=job.get("title") or "your role",
                    job_id=job_id,
                ),
                kind="job_application_received",
            )
    except Exception:  # noqa: BLE001
        pass

    application.pop("_id", None)
    return {"applied": True, "application_id": app_id}


@api_router.get("/jobs/{job_id}/applications")
async def list_job_applications(job_id: str, current_user: dict = Depends(get_current_user)):
    """Employer-only: list all applicants for one of their jobs."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["employer_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only the employer can view applications.")
    cursor = db.job_applications.find({"job_id": job_id}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=500)


@api_router.patch("/jobs/{job_id}/applications/{app_id}")
async def update_application(job_id: str, app_id: str, req: UpdateApplicationRequest, current_user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["employer_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only the employer can update applications.")
    if req.status not in ("new", "shortlisted", "interview", "rejected", "hired"):
        raise HTTPException(status_code=400, detail="Invalid status.")
    upd = {"status": req.status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if req.note is not None:
        upd["employer_note"] = req.note[:1000]
    res = await db.job_applications.update_one({"id": app_id, "job_id": job_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Application not found")
    updated = await db.job_applications.find_one({"id": app_id}, {"_id": 0})

    # Email the applicant about their status change
    try:
        applicant = await db.users.find_one({"id": updated["applicant_id"]}, {"_id": 0, "email": 1})
        if applicant and applicant.get("email"):
            await _send_branded_email(
                to=applicant["email"].strip().lower(),
                subject=f"Application update — {job.get('title','your application')}",
                html=_job_application_status_email_html(
                    job_title=job.get("title") or "your application",
                    new_status=req.status,
                    job_id=job_id,
                ),
                kind="job_application_status",
            )
    except Exception:  # noqa: BLE001
        pass

    return updated


@app.on_event("startup")
async def seed_network_capital_job():
    """Idempotent: ensure the Network Capital Business Developer Agent listing exists."""
    try:
        existing = await db.jobs.find_one({"_seed_key": "nc_bd_agent_v1"})
        if existing:
            return
        seed_id = str(uuid.uuid4())
        await db.jobs.insert_one({
            "id": seed_id,
            "_seed_key": "nc_bd_agent_v1",
            "employer_id": "_network_capital_official",
            "employer_username": "networkcapital",
            "company": "Network Capital App",
            "title": "Business Developer Agent",
            "location": "Remote / Hybrid",
            "employment_type": "Performance & Growth Focused",
            "salary": "R8,500 CTC + Performance Commission",
            "description": (
                "Network Capital is building a community-driven participation ecosystem focused on "
                "connecting people to opportunities, shared experiences, group participation, and digital engagement. "
                "We are looking for ambitious, energetic, and socially active individuals to join our growth team "
                "as Business Developer Agents.\n\n"
                "This role is ideal for someone who understands digital culture, enjoys engaging with people, "
                "and wants to be part of building a fast-growing platform from the ground up.\n\n"
                "As a Business Developer Agent, your main responsibility will be to help expand the Network Capital "
                "user base, drive engagement, promote platform features, and onboard new users and communities onto the ecosystem."
            ),
            "responsibilities": [
                "Promote and grow the Network Capital platform",
                "Onboard new users and communities",
                "Increase user engagement and participation",
                "Assist users with registration and onboarding",
                "Market platform features (Community Participation, Stokvel Groups, Activities, Jobs, Network Score system)",
                "Build and maintain relationships with users and community groups",
                "Drive referrals and user growth campaigns",
                "Encourage consistent platform participation and activity",
                "Represent the Network Capital brand professionally online and offline",
            ],
            "requirements": [
                "Must be 18 years or older",
                "Excellent communication skills (written and verbal)",
                "Tech savvy and comfortable using digital platforms",
                "Computer literate",
                "Must own or have access to a smartphone or laptop",
                "Strong social and networking ability",
                "Active on social media platforms",
                "Self-motivated and goal-driven",
                "No previous work experience required",
                "Students are welcome to apply",
                "Minimum Network Score of 2,000 points before final consideration",
            ],
            "skills": ["Communication", "Sales", "Networking", "Social media", "Onboarding"],
            "application_steps": [
                "Submit your CV (PDF or Word)",
                "Brief cover note explaining why you're a fit",
                "Initial screening by the Network Capital team",
                "Interview with the growth lead",
            ],
            "contact_email": "recruitment@networkcapitalapp.co.za",
            "min_network_score": 2000,
            "status": "open",
            "applications_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded Network Capital BD Agent job ({seed_id}).")
    except Exception as e:
        logger.warning(f"seed_network_capital_job skipped: {e}")



# ============================================================================
# ITER 25 — My Places, My Network, Job reactions, Role-based admin dashboard
# ============================================================================

# ---- ROLE-BASED ADMIN ------------------------------------------------------
# Role hierarchy: user → moderator → admin → super_admin
# - moderator: content moderation only
# - admin: user management, role changes (except super_admin grant), withdrawals, ads
# - super_admin: PLATFORM OWNER — wallet balance adjustments, system-wide ops
SUPER_ADMIN_EMAIL = "rmleetang@gmail.com"  # Platform owner — single tenant


async def require_admin_user(current_user: dict = Depends(get_current_user)):
    """JWT-based admin check (role ∈ {admin, moderator, super_admin})."""
    role = current_user.get("role") or "user"
    if role not in ("admin", "moderator", "super_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


async def require_super_admin(current_user: dict = Depends(get_current_user)):
    """Platform owner only. Standard admins are explicitly denied."""
    role = current_user.get("role") or "user"
    if role != "super_admin":
        raise HTTPException(status_code=403, detail="Super-admin (platform owner) access required")
    return current_user


async def require_admin_or_password(
    current_user: Optional[dict] = None,
    x_admin_password: Optional[str] = Header(None),
):
    """Compat: either role-based admin OR the legacy X-Admin-Password header."""
    expected = os.environ.get('ADMIN_PASSWORD')
    if x_admin_password and expected and x_admin_password == expected:
        return True
    if current_user and (current_user.get("role") in ("admin", "moderator")):
        return True
    raise HTTPException(status_code=403, detail="Admin access required")


class PromoteUserRequest(BaseModel):
    role: str  # admin | moderator | user


@api_router.post("/admin/bootstrap")
async def admin_bootstrap(
    current_user: dict = Depends(get_current_user),
    x_admin_password: str = Header(None),
):
    """One-time bootstrap: any user can promote THEMSELVES to admin by providing
    the legacy ADMIN_PASSWORD header. Idempotent."""
    expected = os.environ.get('ADMIN_PASSWORD')
    if not expected or x_admin_password != expected:
        raise HTTPException(status_code=403, detail="Invalid admin password")
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"role": "admin"}})
    return {"ok": True, "user_id": current_user["id"], "role": "admin"}


@api_router.patch("/admin/users/{user_id}/role")
async def admin_set_user_role(
    user_id: str,
    payload: PromoteUserRequest,
    admin: dict = Depends(require_admin_user),
):
    # Only admin / super_admin (not moderator) can change roles.
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can change user roles")
    if payload.role not in ("admin", "moderator", "user", "ambassador", "super_admin"):
        raise HTTPException(status_code=400, detail="Invalid role")
    # Only super_admin can grant/revoke super_admin.
    if payload.role == "super_admin" and admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Only the platform owner can grant super-admin role")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "email": 1, "role": 1, "is_ambassador": 1, "full_name": 1, "username": 1, "email_verified": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # The platform-owner email is the SOLE allowed super_admin holder. Any attempt
    # to grant super_admin to a different account is denied (would be auto-demoted
    # on next boot anyway — this just surfaces it immediately to the actor).
    if payload.role == "super_admin" and (target.get("email") or "").strip().lower() != (SUPER_ADMIN_EMAIL or "").strip().lower():
        raise HTTPException(
            status_code=403,
            detail=f"super_admin is reserved exclusively for {SUPER_ADMIN_EMAIL}",
        )
    # Block standard admins from demoting / changing the platform owner.
    if target.get("role") == "super_admin" and admin.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Cannot modify the platform owner's role")

    prev_role = target.get("role") or "user"
    prev_is_ambassador = bool(target.get("is_ambassador"))

    # "ambassador" is a flag-driven pseudo-role: store role='user' but flip is_ambassador on.
    if payload.role == "ambassador":
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"role": "user", "is_ambassador": True,
                      "ambassador_rank": target.get("ambassador_rank") or "Rising Star"}},
        )
        new_role_label = "ambassador"
        new_role_actual = "user"
        new_is_ambassador = True
    else:
        await db.users.update_one({"id": user_id}, {"$set": {"role": payload.role, "is_ambassador": False}})
        new_role_label = payload.role
        new_role_actual = payload.role
        new_is_ambassador = False

    # Email notification — fire on both grant AND revoke, per product spec.
    try:
        prev_label = "ambassador" if prev_is_ambassador else prev_role
        if prev_label != new_role_label:
            await _notify_role_change(
                user=target,
                previous_role=prev_label,
                new_role=new_role_label,
                actor_username=admin.get("username") or "admin",
            )
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"[ROLE-EMAIL-FAIL] user={user_id} err={exc}")

    # Audit log
    try:
        await AuditLog.write(
            actor_id=admin["id"], actor_username=admin.get("username") or "admin",
            action="role.change", target_type="user", target_id=user_id,
            reason=f"role {prev_label} → {new_role_label}",
            metadata={"previous": prev_label, "new": new_role_label},
        )
    except Exception:
        pass

    return {"ok": True, "user_id": user_id, "role": new_role_actual, "is_ambassador": new_is_ambassador, "role_label": new_role_label}


@api_router.get("/admin/users-list")
async def admin_list_users(
    q: Optional[str] = None,
    role: Optional[str] = None,
    limit: int = 100,
    admin: dict = Depends(require_admin_user),
):
    """Paginated user list for the admin User-Management page."""
    query: Dict[str, Any] = {}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
            {"full_name": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.users.find(query, {
        "_id": 0, "password": 0,
    }).limit(min(limit, 500))
    return await cursor.to_list(length=None)


# ---- ADMIN: User filter by Network-Score bracket --------------------------
@api_router.get("/admin/users/by-score")
async def admin_users_by_score(
    min_score: int = 0,
    max_score: int = 1_000_000,
    bracket: Optional[str] = None,   # convenience: "0-1000", "1000-2000", ...
    role: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 200,
    admin: dict = Depends(require_admin_user),
):
    """Returns users whose network_score is within [min_score, max_score).

    Supports preset thousand-step brackets via ``bracket="N-M"`` query.  Used by
    the Super-Admin "balance ops" tools and the admin user-bracket selector
    described in the platform-enhancement spec."""
    lo, hi = int(min_score), int(max_score)
    if bracket:
        try:
            a, b = bracket.split("-", 1)
            lo, hi = int(a), int(b)
        except ValueError:
            raise HTTPException(status_code=400, detail="bracket must be 'min-max', e.g. '0-1000'")
    if lo < 0 or hi <= lo:
        raise HTTPException(status_code=400, detail="min must be >= 0 and max must be > min")

    query: Dict[str, Any] = {"network_score": {"$gte": lo, "$lt": hi}}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [
            {"email": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}},
            {"full_name": {"$regex": q, "$options": "i"}},
        ]
    proj = {
        "_id": 0, "password": 0,
        # Trim heavy fields the list view doesn't need
        "photo": 0, "banking": 0, "places_owned": 0,
    }
    rows = await db.users.find(query, proj).sort("network_score", -1).limit(min(limit, 1000)).to_list(length=None)
    return {"bracket": [lo, hi], "count": len(rows), "users": rows}


# ---- ADMIN: detailed Network-Score breakdown for a single user ------------
@api_router.get("/admin/users/{user_id}/score-breakdown")
async def admin_user_score_breakdown(
    user_id: str,
    days: int = 90,
    limit: int = 500,
    admin: dict = Depends(require_admin_user),
):
    """Audit-grade view: per-event listing with action, points, multiplier,
    source_id, and totals by action.  Used by the AdminProfileDetailPage
    drawer for compliance / score-audit visibility."""
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "username": 1, "full_name": 1, "email": 1,
         "network_score": 1, "monthly_score": 1, "rank": 1, "cap_reached_at": 1,
         "is_premium": 1, "founder_multiplier_until": 1},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).isoformat()
    events = await db.score_events.find(
        {"user_id": user_id, "created_at": {"$gte": cutoff}},
        {"_id": 0},
    ).sort("created_at", -1).limit(min(limit, 2000)).to_list(length=None)

    # Per-action totals across the window
    pipeline = [
        {"$match": {"user_id": user_id, "created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": "$action",
            "points": {"$sum": "$points"},
            "count": {"$sum": 1},
            "last_at": {"$max": "$created_at"},
        }},
        {"$sort": {"points": -1}},
    ]
    by_action = await db.score_events.aggregate(pipeline).to_list(length=None)
    totals = {
        "events": len(events),
        "points": sum(int(e.get("points", 0)) for e in events),
    }
    return {
        "user": user,
        "window_days": days,
        "totals": totals,
        "by_action": [
            {"action": r["_id"], "points": int(r["points"]),
             "count": int(r["count"]), "last_at": r["last_at"]}
            for r in by_action
        ],
        "events": events,
    }


# ---- Public payout-window state — surfaced to frontend banner -------------
@api_router.get("/payouts/status")
async def payouts_status():
    """Returns whether the June 2026 payout block is active.
    Public — no auth — so the wallet page can render the banner client-side."""
    locked = _is_june_payout_locked()
    return {
        "locked": locked,
        "release_at": JUNE_PAYOUT_RELEASE_AT.isoformat(),
        "message": _june_payout_message() if locked else "Withdrawals are currently being processed.",
    }


# ---- ADMIN DASHBOARD METRICS ----------------------------------------------
@api_router.get("/admin/dashboard/metrics")
async def admin_dashboard_metrics(
    current_user: dict = Depends(get_current_user),
    x_admin_password: Optional[str] = Header(None),
):
    """Single-payload metrics for the admin dashboard.
    Access: role=admin/moderator OR valid X-Admin-Password header."""
    role = current_user.get("role") or "user"
    expected = os.environ.get('ADMIN_PASSWORD')
    pw_ok = bool(expected) and (x_admin_password == expected)
    if role not in ("admin", "moderator") and not pw_ok:
        raise HTTPException(status_code=403, detail="Admin access required")
    # If admin password matches, also auto-promote the current user to admin
    if pw_ok and role == "user":
        await db.users.update_one({"id": current_user["id"]}, {"$set": {"role": "admin"}})
    now = datetime.now(timezone.utc)
    seven_d = (now - timedelta(days=7)).isoformat()
    thirty_d = (now - timedelta(days=30)).isoformat()

    async def _count(coll, **q):
        return await db[coll].count_documents(q) if q else await db[coll].count_documents({})

    total_users = await db.users.count_documents({})
    new_users_7d = await db.users.count_documents({"created_at": {"$gte": seven_d}})
    new_users_30d = await db.users.count_documents({"created_at": {"$gte": thirty_d}})
    premium_users = await db.users.count_documents({"is_premium": True})

    total_stokvels = await db.stokvels.count_documents({})
    new_stokvels_30d = await db.stokvels.count_documents({"created_at": {"$gte": thirty_d}})

    total_posts = await db.posts.count_documents({})
    posts_7d = await db.posts.count_documents({"created_at": {"$gte": seven_d}})

    total_jobs = await db.jobs.count_documents({})
    total_applications = await db.job_applications.count_documents({})

    total_places = await db.places.count_documents({})
    total_reviews = await db.place_reviews.count_documents({})
    reviews_30d = await db.place_reviews.count_documents({"created_at": {"$gte": thirty_d}})

    total_connections = await db.connections.count_documents({"status": "accepted"})
    connections_30d = await db.connections.count_documents({"status": "accepted", "accepted_at": {"$gte": thirty_d}})

    # Top contributors this month
    month_key = _month_key()
    top_contrib = await db.users.find(
        {},
        {"_id": 0, "id": 1, "username": 1, "full_name": 1, "photo": 1, "monthly_score": 1}
    ).sort("monthly_score", -1).limit(5).to_list(length=None)

    return {
        "generated_at": now.isoformat(),
        "users": {
            "total": total_users,
            "new_7d": new_users_7d,
            "new_30d": new_users_30d,
            "premium": premium_users,
            "growth_30d_pct": round((new_users_30d / max(total_users - new_users_30d, 1)) * 100, 1),
        },
        "stokvels": {"total": total_stokvels, "new_30d": new_stokvels_30d},
        "feed":     {"total_posts": total_posts, "posts_7d": posts_7d},
        "jobs":     {"total": total_jobs, "applications": total_applications},
        "places":   {"total": total_places, "reviews": total_reviews, "reviews_30d": reviews_30d},
        "network":  {"connections": total_connections, "connections_30d": connections_30d},
        "top_contributors": top_contrib,
        "month_key": month_key,
    }


# ---- MY PLACES -------------------------------------------------------------
class PlaceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str  # restaurant | store | guesthouse | salon | service | other
    description: Optional[str] = ""
    address: Optional[str] = ""
    city: Optional[str] = ""
    country: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    photo: Optional[str] = ""   # base64 or URL
    phone: Optional[str] = ""
    website: Optional[str] = ""


class PlaceReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = ""
    body: str = Field(min_length=4, max_length=2000)
    photos: Optional[List[str]] = []   # base64 strings or URLs


class PlaceClaimRequest(BaseModel):
    proof: Optional[str] = ""           # short description / link to proof
    contact_email: Optional[str] = ""


PLACE_CATEGORIES = ["restaurant", "store", "guesthouse", "salon", "service", "other"]


def _place_public(place: dict) -> dict:
    """Strip private fields and add computed values."""
    place.pop("_id", None)
    return place


@api_router.post("/places")
async def create_place(payload: PlaceCreate, current_user: dict = Depends(get_current_user)):
    if payload.category not in PLACE_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Category must be one of {PLACE_CATEGORIES}")
    place = {
        "id": str(uuid.uuid4()),
        "name": payload.name.strip(),
        "category": payload.category,
        "description": (payload.description or "").strip(),
        "address": (payload.address or "").strip(),
        "city": (payload.city or "").strip(),
        "country": (payload.country or "").strip(),
        "lat": payload.lat,
        "lng": payload.lng,
        "photo": payload.photo or "",
        "phone": payload.phone or "",
        "website": payload.website or "",
        "created_by": current_user["id"],
        "owner_id": None,           # populated when an owner claim is approved
        "claim_status": "unclaimed",  # unclaimed | pending | claimed
        "review_count": 0,
        "average_rating": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.places.insert_one(place)
    return _place_public(place)


@api_router.get("/places")
async def list_places(
    q: Optional[str] = None,
    category: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = 50,
):
    query: Dict[str, Any] = {}
    if category and category in PLACE_CATEGORIES:
        query["category"] = category
    if city:
        query["city"] = {"$regex": f"^{city}", "$options": "i"}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"address": {"$regex": q, "$options": "i"}},
        ]
    cur = db.places.find(query, {"_id": 0}).sort("average_rating", -1).limit(min(limit, 200))
    return await cur.to_list(length=None)


@api_router.get("/places/{place_id}")
async def get_place(place_id: str):
    place = await db.places.find_one({"id": place_id}, {"_id": 0})
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    return place


@api_router.post("/places/{place_id}/reviews")
async def review_place(
    place_id: str,
    payload: PlaceReviewCreate,
    current_user: dict = Depends(get_current_user),
):
    place = await db.places.find_one({"id": place_id}, {"_id": 0})
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    # One review per user per place
    existing = await db.place_reviews.find_one({"place_id": place_id, "user_id": current_user["id"]})
    if existing:
        raise HTTPException(status_code=409, detail="You already reviewed this place. Edit your review instead.")

    review = {
        "id": str(uuid.uuid4()),
        "place_id": place_id,
        "user_id": current_user["id"],
        "username": current_user.get("username") or "member",
        "photo": current_user.get("photo") or "",
        "rating": int(payload.rating),
        "title": (payload.title or "").strip(),
        "body": payload.body.strip(),
        "photos": payload.photos or [],
        "owner_reply": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.place_reviews.insert_one(review)

    # Refresh aggregates
    cur = db.place_reviews.find({"place_id": place_id}, {"_id": 0, "rating": 1})
    ratings = [r["rating"] async for r in cur]
    avg = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
    await db.places.update_one(
        {"id": place_id},
        {"$set": {"average_rating": avg, "review_count": len(ratings)}},
    )

    await award_points(
        current_user["id"], "place_review_create", 0,
        source_id=f"place_review:{review['id']}",
        message=f"Reviewed {place['name']}",
    )
    review.pop("_id", None)
    return review


@api_router.get("/places/{place_id}/reviews")
async def list_place_reviews(place_id: str, limit: int = 100):
    cur = db.place_reviews.find({"place_id": place_id}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    return await cur.to_list(length=None)


@api_router.delete("/places/{place_id}/reviews/{review_id}")
async def delete_place_review(
    place_id: str, review_id: str,
    current_user: dict = Depends(get_current_user),
):
    review = await db.place_reviews.find_one({"id": review_id, "place_id": place_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if review["user_id"] != current_user["id"] and current_user.get("role") not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="You can only delete your own review")
    await db.place_reviews.delete_one({"id": review_id})
    # Revoke the +40 score event (clamps monthly_score at 0)
    await revoke_score_event(review["user_id"], "place_review_create", f"place_review:{review_id}")
    cur = db.place_reviews.find({"place_id": place_id}, {"_id": 0, "rating": 1})
    ratings = [r["rating"] async for r in cur]
    avg = round(sum(ratings) / len(ratings), 2) if ratings else 0.0
    await db.places.update_one(
        {"id": place_id},
        {"$set": {"average_rating": avg, "review_count": len(ratings)}},
    )
    return {"ok": True}


@api_router.post("/places/{place_id}/claim")
async def claim_place(
    place_id: str,
    payload: PlaceClaimRequest,
    current_user: dict = Depends(get_current_user),
):
    place = await db.places.find_one({"id": place_id}, {"_id": 0})
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    if place.get("claim_status") == "claimed":
        raise HTTPException(status_code=409, detail="This place is already claimed")
    claim = {
        "id": str(uuid.uuid4()),
        "place_id": place_id,
        "user_id": current_user["id"],
        "proof": (payload.proof or "").strip(),
        "contact_email": (payload.contact_email or current_user.get("email") or "").strip(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.place_claims.insert_one(claim)
    await db.places.update_one({"id": place_id}, {"$set": {"claim_status": "pending"}})
    claim.pop("_id", None)
    return claim


@api_router.post("/admin/places/claims/{claim_id}/approve")
async def admin_approve_claim(claim_id: str, admin: dict = Depends(require_admin_user)):
    claim = await db.place_claims.find_one({"id": claim_id}, {"_id": 0})
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    await db.place_claims.update_one({"id": claim_id}, {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}})
    await db.places.update_one(
        {"id": claim["place_id"]},
        {"$set": {"owner_id": claim["user_id"], "claim_status": "claimed"}},
    )
    return {"ok": True}


class OwnerReplyRequest(BaseModel):
    reply: str = Field(min_length=2, max_length=1000)


@api_router.post("/places/{place_id}/reviews/{review_id}/reply")
async def owner_reply_review(
    place_id: str, review_id: str,
    payload: OwnerReplyRequest,
    current_user: dict = Depends(get_current_user),
):
    place = await db.places.find_one({"id": place_id}, {"_id": 0})
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")
    if place.get("owner_id") != current_user["id"] and current_user.get("role") not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Only the claimed owner can reply to reviews")
    review = await db.place_reviews.find_one({"id": review_id, "place_id": place_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    reply = {
        "body": payload.reply.strip(),
        "by_user_id": current_user["id"],
        "by_username": current_user.get("username") or "owner",
        "at": datetime.now(timezone.utc).isoformat(),
    }
    await db.place_reviews.update_one({"id": review_id}, {"$set": {"owner_reply": reply}})
    return {"ok": True, "owner_reply": reply}


# ---- MY NETWORK ------------------------------------------------------------
CONNECTION_KINDS = ("social", "professional", "financial")


class ConnectionRequestBody(BaseModel):
    target_user_id: str
    kind: str  # social | professional | financial
    note: Optional[str] = ""


def _conn_id(user_a: str, user_b: str, kind: str) -> str:
    """Deterministic connection ID so dupe-requests collide."""
    a, b = sorted([user_a, user_b])
    return f"{a}__{b}__{kind}"


@api_router.post("/connections/request")
async def request_connection(payload: ConnectionRequestBody, current_user: dict = Depends(get_current_user)):
    if payload.kind not in CONNECTION_KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {CONNECTION_KINDS}")
    if payload.target_user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")
    target = await db.users.find_one({"id": payload.target_user_id}, {"_id": 0, "id": 1, "username": 1, "full_name": 1, "photo": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    conn_id = _conn_id(current_user["id"], payload.target_user_id, payload.kind)
    existing = await db.connections.find_one({"id": conn_id}, {"_id": 0})
    if existing:
        if existing["status"] == "accepted":
            return {"ok": True, "status": "accepted", "id": conn_id}
        if existing["status"] == "pending":
            return {"ok": True, "status": "pending", "id": conn_id}
        # rejected or cancelled — allow re-request by resetting
    record = {
        "id": conn_id,
        "kind": payload.kind,
        "from_user_id": current_user["id"],
        "to_user_id": payload.target_user_id,
        "status": "pending",
        "note": (payload.note or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "accepted_at": None,
    }
    await db.connections.update_one({"id": conn_id}, {"$set": record}, upsert=True)
    # Notify recipient by email (fire-and-forget)
    try:
        recipient = await db.users.find_one({"id": payload.target_user_id}, {"_id": 0, "email": 1})
        if recipient and recipient.get("email"):
            requester_name = current_user.get("full_name") or current_user.get("username") or "Someone"
            await _send_branded_email(
                to=recipient["email"].strip().lower(),
                subject=f"New {payload.kind} connection request",
                html=_connection_request_email_html(requester_name=requester_name, kind=payload.kind),
                kind="connection_request",
            )
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True, "status": "pending", "id": conn_id}


@api_router.post("/connections/{conn_id}/accept")
async def accept_connection(conn_id: str, current_user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id}, {"_id": 0})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found")
    if conn["to_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the recipient can accept this request")
    if conn["status"] == "accepted":
        return {"ok": True, "id": conn_id, "status": "accepted"}
    now = datetime.now(timezone.utc).isoformat()
    await db.connections.update_one({"id": conn_id}, {"$set": {"status": "accepted", "accepted_at": now}})
    # Award both sides
    for uid in (conn["from_user_id"], conn["to_user_id"]):
        await award_points(
            uid, "connection_made", 0,
            source_id=f"connection:{conn_id}",
            message=f"New {conn['kind']} connection",
        )
    # Email the original requester that their request was accepted
    try:
        requester = await db.users.find_one({"id": conn["from_user_id"]}, {"_id": 0, "email": 1})
        if requester and requester.get("email"):
            acceptor_name = current_user.get("full_name") or current_user.get("username") or "Someone"
            await _send_branded_email(
                to=requester["email"].strip().lower(),
                subject="Your connection request was accepted",
                html=_connection_accepted_email_html(acceptor_name=acceptor_name, kind=conn["kind"]),
                kind="connection_accepted",
            )
    except Exception:  # noqa: BLE001
        pass
    return {"ok": True, "id": conn_id, "status": "accepted"}


@api_router.post("/connections/{conn_id}/reject")
async def reject_connection(conn_id: str, current_user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id}, {"_id": 0})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection request not found")
    if conn["to_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only the recipient can reject this request")
    await db.connections.update_one({"id": conn_id}, {"$set": {"status": "rejected"}})
    return {"ok": True, "id": conn_id, "status": "rejected"}


@api_router.delete("/connections/{conn_id}")
async def remove_connection(conn_id: str, current_user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": conn_id}, {"_id": 0})
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if current_user["id"] not in (conn["from_user_id"], conn["to_user_id"]):
        raise HTTPException(status_code=403, detail="Not your connection")
    await db.connections.delete_one({"id": conn_id})
    return {"ok": True}


async def _network_summary_for(user_id: str) -> Dict[str, Any]:
    """Return social/professional/financial accepted-counts + pending-incoming-count."""
    counts = {k: 0 for k in CONNECTION_KINDS}
    pending_incoming = 0
    cur = db.connections.find(
        {"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]},
        {"_id": 0, "kind": 1, "status": 1, "to_user_id": 1, "from_user_id": 1},
    )
    async for c in cur:
        if c["status"] == "accepted":
            counts[c["kind"]] = counts.get(c["kind"], 0) + 1
        elif c["status"] == "pending" and c["to_user_id"] == user_id:
            pending_incoming += 1
    return {
        "user_id": user_id,
        "counts": counts,
        "total": sum(counts.values()),
        "pending_incoming": pending_incoming,
    }


@api_router.get("/connections/me/summary")
async def my_network_summary(current_user: dict = Depends(get_current_user)):
    return await _network_summary_for(current_user["id"])


@api_router.get("/users/{user_id}/network-summary")
async def user_network_summary(user_id: str, current_user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return await _network_summary_for(user_id)


@api_router.get("/connections/me")
async def list_my_connections(
    kind: Optional[str] = None,
    status_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """List my connections (and pending requests). `status_filter` ∈ {accepted, pending, incoming}."""
    query: Dict[str, Any] = {
        "$or": [{"from_user_id": current_user["id"]}, {"to_user_id": current_user["id"]}],
    }
    if kind and kind in CONNECTION_KINDS:
        query["kind"] = kind
    if status_filter == "accepted":
        query["status"] = "accepted"
    elif status_filter == "pending":
        query["status"] = "pending"
    elif status_filter == "incoming":
        query["status"] = "pending"
        query.pop("$or", None)
        query["to_user_id"] = current_user["id"]
    cur = db.connections.find(query, {"_id": 0}).sort("created_at", -1).limit(500)
    rows = await cur.to_list(length=None)
    # Enrich with the OTHER user's basic info
    other_ids = list({
        c["to_user_id"] if c["from_user_id"] == current_user["id"] else c["from_user_id"]
        for c in rows
    })
    users = {}
    if other_ids:
        async for u in db.users.find(
            {"id": {"$in": other_ids}},
            {"_id": 0, "id": 1, "username": 1, "full_name": 1, "photo": 1, "monthly_score": 1, "user_kind": 1, "city": 1},
        ):
            users[u["id"]] = u
    for c in rows:
        other_id = c["to_user_id"] if c["from_user_id"] == current_user["id"] else c["from_user_id"]
        c["other_user"] = users.get(other_id, {"id": other_id})
        c["direction"] = "outgoing" if c["from_user_id"] == current_user["id"] else "incoming"
    return rows


# ---- JOB LIKE / DISLIKE / SHARE -------------------------------------------
class JobReactionBody(BaseModel):
    reaction: str  # like | dislike


# Public production base URL — used for share links so they NEVER include preview/emergent hosts.
SHARE_BASE_URL = "https://networkcapitalapp.co.za"


@api_router.post("/jobs/{job_id}/react")
async def react_job(
    job_id: str,
    payload: JobReactionBody,
    current_user: dict = Depends(get_current_user),
):
    if payload.reaction not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="reaction must be 'like' or 'dislike'")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "id": 1, "title": 1})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    rid = f"{current_user['id']}__{job_id}"
    existing = await db.job_reactions.find_one({"id": rid}, {"_id": 0})
    if existing and existing.get("reaction") == payload.reaction:
        # Toggle off
        await db.job_reactions.delete_one({"id": rid})
        return await _job_reaction_counts(job_id, mine=None)
    await db.job_reactions.update_one(
        {"id": rid},
        {"$set": {
            "id": rid,
            "job_id": job_id,
            "user_id": current_user["id"],
            "reaction": payload.reaction,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return await _job_reaction_counts(job_id, mine=payload.reaction)


async def _job_reaction_counts(job_id: str, mine: Optional[str]) -> Dict[str, Any]:
    likes = await db.job_reactions.count_documents({"job_id": job_id, "reaction": "like"})
    dislikes = await db.job_reactions.count_documents({"job_id": job_id, "reaction": "dislike"})
    return {"job_id": job_id, "likes": likes, "dislikes": dislikes, "mine": mine}


@api_router.get("/jobs/{job_id}/reactions")
async def get_job_reactions(job_id: str, current_user: dict = Depends(get_current_user)):
    rid = f"{current_user['id']}__{job_id}"
    mine_row = await db.job_reactions.find_one({"id": rid}, {"_id": 0, "reaction": 1})
    return await _job_reaction_counts(job_id, mine=(mine_row or {}).get("reaction"))


@api_router.post("/jobs/{job_id}/share")
async def share_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Log a job-share and return a clean public URL (no preview/emergent hosts)."""
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "id": 1, "title": 1})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.job_shares.insert_one({
        "id": str(uuid.uuid4()),
        "job_id": job_id,
        "user_id": current_user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await award_points(
        current_user["id"], "job_share", 0,
        source_id=f"job_share:{job_id}",
        message=f"Shared job: {job.get('title','a job')}",
    )
    return {
        "ok": True,
        "url": f"{SHARE_BASE_URL}/jobs/{job_id}",
        "title": job.get("title"),
    }


# ─── Referral tracking (iter 26) ────────────────────────────────────────────
@api_router.post("/referrals/track-click")
async def track_referral_click(payload: Dict[str, Any]):
    """Public endpoint — called by the JoinHandler when someone visits /join/<code>.
    Stores one row per visit so the owner can see real reach."""
    ref = (payload.get("ref") or "").strip()
    if not ref:
        raise HTTPException(status_code=400, detail="ref is required")
    # Find the referring user by either share_code or legacy referral_code
    owner = await db.users.find_one(
        {"$or": [{"share_code": ref}, {"referral_code": ref}]},
        {"_id": 0, "id": 1},
    )
    await db.referral_clicks.insert_one({
        "id": str(uuid.uuid4()),
        "ref": ref,
        "owner_id": owner["id"] if owner else None,
        "user_agent": (payload.get("user_agent") or "")[:200],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"ok": True, "tracked": True}


@api_router.get("/referrals/me")
async def my_referrals(current_user: dict = Depends(get_current_user)):
    """Returns {clicks_count, joined_count, joined_users:[]} for the current user.
    Counts BOTH new friendly share_code and legacy referral_code visits."""
    my_codes = [c for c in (current_user.get("share_code"), current_user.get("referral_code")) if c]
    clicks_count = 0
    if my_codes:
        clicks_count = await db.referral_clicks.count_documents({"ref": {"$in": my_codes}})

    # People who joined via this user
    cursor = db.users.find(
        {"referred_by": current_user["id"]},
        {"_id": 0, "id": 1, "username": 1, "full_name": 1, "photo": 1,
         "created_at": 1, "profile_completed": 1, "monthly_score": 1, "city": 1},
    ).sort("created_at", -1).limit(500)
    joined_raw = await cursor.to_list(length=None)
    # Normalise so all fields are present (frontend uses optional chaining either way)
    joined = [{
        "id": u.get("id"),
        "username": u.get("username"),
        "full_name": u.get("full_name"),
        "photo": u.get("photo") or "",
        "city": u.get("city") or "",
        "created_at": u.get("created_at"),
        "profile_completed": bool(u.get("profile_completed")),
        "monthly_score": int(u.get("monthly_score") or 0),
    } for u in joined_raw]

    # Mark each invitee as completed (profile_completed=True) or still pending
    now = datetime.now(timezone.utc)
    seven_d = (now - timedelta(days=7)).isoformat()
    joined_7d = sum(1 for u in joined if u.get("created_at", "") >= seven_d)

    return {
        "clicks_count": clicks_count,
        "joined_count": len(joined),
        "joined_7d": joined_7d,
        "completed_count": sum(1 for u in joined if u.get("profile_completed")),
        "joined_users": joined,
        "share_code": current_user.get("share_code"),
        "share_url": f"{SHARE_BASE_URL}/join/{current_user.get('share_code')}" if current_user.get("share_code") else None,
    }


# ============================================================================
# ITER 27 — Admin Moderation + Credit Grants + Audit Log
# ============================================================================

CREDIT_GRANT_HARD_CAP_USD = 5000.0   # > requires co-approval

class AuditLog:
    """Helper to append a structured audit-log row."""
    @staticmethod
    async def write(*, actor_id: str, actor_username: str, action: str,
                    target_type: str, target_id: str,
                    reason: Optional[str] = None,
                    metadata: Optional[Dict[str, Any]] = None) -> None:
        try:
            await db.audit_log.insert_one({
                "id": str(uuid.uuid4()),
                "actor_id": actor_id,
                "actor_username": actor_username or "admin",
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "reason": (reason or "")[:500],
                "metadata": metadata or {},
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"audit_log write failed: {exc}")


# ---- DELETION: USER (soft / hard) + CONTENT --------------------------------
async def _hard_delete_user_content(user_id: str) -> Dict[str, int]:
    """Remove every artefact owned by user_id. Returns per-collection counts."""
    counts = {}
    for coll in (
        "posts", "comments", "messages", "stories", "activities",
        "place_reviews", "place_claims", "jobs", "job_applications",
        "job_reactions", "job_shares", "score_events", "connections",
        "stokvel_members", "products", "notifications", "follows",
        "referral_clicks", "otps", "deposits",
    ):
        try:
            if coll in ("messages",):
                r = await db[coll].delete_many({"$or": [{"sender_id": user_id}, {"recipient_id": user_id}]})
            elif coll in ("connections",):
                r = await db[coll].delete_many({"$or": [{"from_user_id": user_id}, {"to_user_id": user_id}]})
            elif coll in ("follows",):
                r = await db[coll].delete_many({"$or": [{"follower_id": user_id}, {"followed_id": user_id}]})
            elif coll in ("notifications",):
                r = await db[coll].delete_many({"user_id": user_id})
            elif coll in ("job_applications",):
                r = await db[coll].delete_many({"applicant_id": user_id})
            elif coll in ("place_reviews", "place_claims", "stokvel_members"):
                r = await db[coll].delete_many({"user_id": user_id})
            elif coll in ("jobs",):
                r = await db[coll].delete_many({"employer_id": user_id})
            elif coll in ("referral_clicks",):
                r = await db[coll].delete_many({"owner_id": user_id})
            elif coll in ("otps",):
                r = await db[coll].delete_many({"user_id": user_id})
            else:
                r = await db[coll].delete_many({"$or": [{"user_id": user_id}, {"author_id": user_id}, {"creator_id": user_id}]})
            counts[coll] = r.deleted_count
        except Exception as exc:  # noqa: BLE001
            counts[coll] = 0
            logger.warning(f"hard_delete {coll} failed for {user_id}: {exc}")
    return counts


class AdminDeleteRequest(BaseModel):
    mode: str = "soft"   # soft | hard
    reason: Optional[str] = ""
    purge_content: Optional[bool] = False   # for soft-delete: also blank posts/messages


@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    mode: str = "soft",
    reason: Optional[str] = "",
    purge_content: bool = False,
    admin: dict = Depends(require_admin_user),
):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete your own account from here. Use Account Settings.")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "username": 1, "email": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    if mode == "hard":
        counts = await _hard_delete_user_content(user_id)
        await db.users.delete_one({"id": user_id})
        await AuditLog.write(
            actor_id=admin["id"], actor_username=admin.get("username") or "admin",
            action="user.hard_delete", target_type="user", target_id=user_id,
            reason=reason, metadata={"counts": counts, "email": target.get("email")},
        )
        return {"ok": True, "mode": "hard", "deleted_counts": counts}

    # Soft-delete (reversible 30d)
    purge_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    update = {
        "deactivated": True,
        "deletion_pending_at": datetime.now(timezone.utc).isoformat(),
        "deletion_purge_at": purge_at,
        "deletion_reason": reason or "admin",
    }
    await db.users.update_one({"id": user_id}, {"$set": update})
    if purge_content:
        # Blank posts and messages so they show as "[deleted]" in feed/threads
        await db.posts.update_many({"user_id": user_id}, {"$set": {"deleted": True, "content": "[deleted]"}})
        await db.messages.update_many({"sender_id": user_id}, {"$set": {"deleted": True, "content": "[deleted]"}})
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="user.soft_delete", target_type="user", target_id=user_id,
        reason=reason, metadata={"purge_at": purge_at, "purge_content": purge_content},
    )
    return {"ok": True, "mode": "soft", "purge_at": purge_at}


@api_router.post("/admin/users/{user_id}/suspend")
async def admin_suspend_user(
    user_id: str,
    payload: Dict[str, Any] = None,
    admin: dict = Depends(require_admin_user),
):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "suspended": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    new_state = not bool(target.get("suspended"))
    await db.users.update_one({"id": user_id}, {"$set": {"suspended": new_state}})
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="user.suspend" if new_state else "user.unsuspend",
        target_type="user", target_id=user_id,
        reason=(payload or {}).get("reason"),
    )
    return {"ok": True, "suspended": new_state}


# ---- BULK USER DELETE ------------------------------------------------------
class BulkUserDeleteRequest(BaseModel):
    score_min: Optional[int] = None
    score_max: Optional[int] = None
    inactive_days: Optional[int] = None
    profile_incomplete: Optional[bool] = None
    email_unverified: Optional[bool] = None
    country: Optional[str] = None
    city: Optional[str] = None
    signup_after: Optional[str] = None
    signup_before: Optional[str] = None
    flagged_for_review: Optional[bool] = None
    search: Optional[str] = None
    mode: str = "preview"    # preview | hard | soft
    confirm_token: Optional[str] = None
    reason: Optional[str] = ""


def _build_bulk_filter(p: BulkUserDeleteRequest) -> Dict[str, Any]:
    q: Dict[str, Any] = {}
    if p.score_min is not None or p.score_max is not None:
        rng: Dict[str, Any] = {}
        if p.score_min is not None: rng["$gte"] = int(p.score_min)
        if p.score_max is not None: rng["$lte"] = int(p.score_max)
        q["monthly_score"] = rng
    if p.profile_incomplete is True:
        q["profile_completed"] = {"$ne": True}
    if p.email_unverified is True:
        q["email_verified"] = {"$ne": True}
    if p.country:
        q["country"] = {"$regex": f"^{p.country}", "$options": "i"}
    if p.city:
        q["city"] = {"$regex": f"^{p.city}", "$options": "i"}
    if p.signup_after:
        q.setdefault("created_at", {})["$gte"] = p.signup_after
    if p.signup_before:
        q.setdefault("created_at", {})["$lte"] = p.signup_before
    if p.flagged_for_review is True:
        q["flagged_for_review"] = True
    if p.inactive_days and p.inactive_days > 0:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=p.inactive_days)).isoformat()
        q["last_active_at"] = {"$lt": cutoff}
    if p.search:
        q["$or"] = [
            {"email": {"$regex": p.search, "$options": "i"}},
            {"username": {"$regex": p.search, "$options": "i"}},
            {"full_name": {"$regex": p.search, "$options": "i"}},
        ]
    # Never sweep admins / moderators in a bulk action
    q["role"] = {"$nin": ["admin", "moderator"]}
    return q


@api_router.post("/admin/users/bulk-delete")
async def admin_bulk_delete_users(
    payload: BulkUserDeleteRequest,
    admin: dict = Depends(require_admin_user),
):
    q = _build_bulk_filter(payload)
    count = await db.users.count_documents(q)

    if payload.mode == "preview":
        sample_cursor = db.users.find(q, {"_id": 0, "id": 1, "username": 1, "email": 1, "monthly_score": 1, "created_at": 1}).limit(20)
        sample = await sample_cursor.to_list(length=None)
        return {"would_delete": count, "sample": sample, "confirm_token_required": f"DELETE {count}"}

    expected_token = f"DELETE {count}"
    if payload.confirm_token != expected_token:
        raise HTTPException(
            status_code=400,
            detail=f"User count changed since preview — required confirm_token is now '{expected_token}'",
        )

    # Execute
    ids_cursor = db.users.find(q, {"_id": 0, "id": 1}).limit(2000)
    ids = [u["id"] async for u in ids_cursor]
    deleted = {"users": 0, "content_counts": {}}
    for uid in ids:
        if payload.mode == "hard":
            counts = await _hard_delete_user_content(uid)
            await db.users.delete_one({"id": uid})
            deleted["users"] += 1
            for k, v in counts.items():
                deleted["content_counts"][k] = deleted["content_counts"].get(k, 0) + v
        else:  # soft
            await db.users.update_one({"id": uid}, {"$set": {
                "deactivated": True,
                "deletion_pending_at": datetime.now(timezone.utc).isoformat(),
                "deletion_purge_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                "deletion_reason": payload.reason or "admin_bulk",
            }})
            deleted["users"] += 1

    # Strip confirm_token before logging so it isn't leaked to long-lived audit storage
    filter_dump = payload.model_dump()
    filter_dump.pop("confirm_token", None)
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action=f"user.bulk_{payload.mode}_delete", target_type="user_group", target_id="bulk",
        reason=payload.reason, metadata={"filter": filter_dump, "deleted": deleted},
    )
    return {"ok": True, "deleted": deleted}


# ---- CONTENT DELETE (admin overrides) -------------------------------------
@api_router.delete("/admin/posts/{post_id}")
async def admin_delete_post(post_id: str, reason: str = "", admin: dict = Depends(require_admin_user)):
    res = await db.posts.delete_one({"id": post_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Post not found")
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="post.delete", target_type="post", target_id=post_id, reason=reason,
    )
    return {"ok": True}


@api_router.delete("/admin/messages/{message_id}")
async def admin_delete_message(message_id: str, reason: str = "", admin: dict = Depends(require_admin_user)):
    res = await db.messages.delete_one({"id": message_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Message not found")
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="message.delete", target_type="message", target_id=message_id, reason=reason,
    )
    return {"ok": True}


class BulkContentRequest(BaseModel):
    kind: str            # posts | messages
    older_than_days: Optional[int] = None
    user_id: Optional[str] = None
    after: Optional[str] = None
    before: Optional[str] = None
    mode: str = "preview"  # preview | execute
    reason: Optional[str] = ""


@api_router.post("/admin/content/bulk-delete")
async def admin_bulk_delete_content(payload: BulkContentRequest, admin: dict = Depends(require_admin_user)):
    if payload.kind not in ("posts", "messages"):
        raise HTTPException(status_code=400, detail="kind must be 'posts' or 'messages'")
    q: Dict[str, Any] = {}
    if payload.older_than_days and payload.older_than_days > 0:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=payload.older_than_days)).isoformat()
        q["created_at"] = {"$lt": cutoff}
    if payload.after:  q.setdefault("created_at", {})["$gte"] = payload.after
    if payload.before: q.setdefault("created_at", {})["$lte"] = payload.before
    if payload.user_id:
        if payload.kind == "messages":
            q["$or"] = [{"sender_id": payload.user_id}, {"recipient_id": payload.user_id}]
        else:
            q["user_id"] = payload.user_id

    coll = db[payload.kind]
    count = await coll.count_documents(q)
    if payload.mode == "preview":
        return {"would_delete": count}
    r = await coll.delete_many(q)
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action=f"{payload.kind}.bulk_delete", target_type=payload.kind, target_id="bulk",
        reason=payload.reason, metadata={"filter": payload.model_dump(), "deleted": r.deleted_count},
    )
    return {"ok": True, "deleted": r.deleted_count}


# ---- CREDIT GRANTS (user wallet + stokvel pool) ---------------------------
class CreditGrantRequest(BaseModel):
    amount: float
    currency: str = "USD"
    reason: str
    target_type: str       # user | stokvel
    target_id: str


def _to_usd(amount: float, currency: str) -> float:
    """Convert an arbitrary currency amount to USD using the in-memory FX table."""
    info = SUPPORTED_CURRENCIES.get(currency.upper())
    if not info:
        raise HTTPException(status_code=400, detail=f"Unsupported currency {currency}")
    rate = info["rate"] or 1.0  # USD→cur rate (1 USD = `rate` units of cur)
    return amount / rate if rate else amount


@api_router.post("/admin/credit-grants")
async def admin_create_credit_grant(payload: CreditGrantRequest, admin: dict = Depends(require_super_admin)):
    # Credit grants move real money — restricted to the Platform Owner (super_admin) only.
    # Standard admins cannot adjust user balances. This is enforced by require_super_admin.
    if not payload.reason or len(payload.reason.strip()) < 10:
        raise HTTPException(status_code=400, detail="Reason must be at least 10 characters.")
    if payload.target_type not in ("user", "stokvel"):
        raise HTTPException(status_code=400, detail="target_type must be 'user' or 'stokvel'")
    amount = float(payload.amount or 0)
    if amount == 0:
        raise HTTPException(status_code=400, detail="Amount must be non-zero")
    currency = payload.currency.upper()
    usd_equiv = _to_usd(abs(amount), currency)
    requires_co_approve = usd_equiv > CREDIT_GRANT_HARD_CAP_USD

    grant_id = str(uuid.uuid4())
    record = {
        "id": grant_id,
        "amount": amount,            # signed: + credit, - deduct
        "currency": currency,
        "usd_equiv": round(usd_equiv * (1 if amount >= 0 else -1), 2),
        "reason": payload.reason.strip(),
        "target_type": payload.target_type,
        "target_id": payload.target_id,
        "created_by": admin["id"],
        "created_by_username": admin.get("username"),
        "co_approver_id": None,
        "status": "pending_co_approval" if requires_co_approve else "applied",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "applied_at": None,
    }
    await db.credit_grants.insert_one(record)

    if not requires_co_approve:
        await _apply_credit_grant(record, admin)

    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="credit.grant_created", target_type=payload.target_type, target_id=payload.target_id,
        reason=payload.reason, metadata={"grant_id": grant_id, "amount": amount, "currency": currency, "usd_equiv": record["usd_equiv"]},
    )
    record.pop("_id", None)
    return record


@api_router.post("/admin/credit-grants/{grant_id}/co-approve")
async def admin_co_approve_grant(grant_id: str, admin: dict = Depends(require_super_admin)):
    # Co-approval also restricted to super_admin per platform policy:
    # only the Platform Owner can move money.
    grant = await db.credit_grants.find_one({"id": grant_id}, {"_id": 0})
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    if grant["status"] != "pending_co_approval":
        raise HTTPException(status_code=400, detail="Grant is not pending")
    if grant["created_by"] == admin["id"]:
        raise HTTPException(status_code=403, detail="Co-approver must be a different admin")
    await _apply_credit_grant(grant, admin)
    return {"ok": True, "id": grant_id, "status": "applied"}


async def _apply_credit_grant(grant: dict, admin: dict) -> None:
    """Apply the signed delta to user.wallet_balance or stokvel.total_pool.
    Writes a full audit row (prev/new balance, actor, reason) to
    ``wallet_adjustments_audit`` for security/compliance review."""
    amount_usd = grant["usd_equiv"]
    if grant["target_type"] == "user":
        prev_user = await db.users.find_one(
            {"id": grant["target_id"]},
            {"_id": 0, "id": 1, "email": 1, "username": 1, "wallet_balance": 1},
        ) or {}
        prev_balance = float(prev_user.get("wallet_balance", 0.0))
        await db.users.update_one({"id": grant["target_id"]}, {"$inc": {"wallet_balance": amount_usd}})
        new_balance = round(prev_balance + amount_usd, 2)
        # Wallet-adjustment audit row (immutable, append-only).
        await db.wallet_adjustments_audit.insert_one({
            "id": str(uuid.uuid4()),
            "grant_id": grant.get("id"),
            "target_user_id": grant["target_id"],
            "target_email": prev_user.get("email"),
            "target_username": prev_user.get("username"),
            "amount_usd": amount_usd,
            "currency": grant.get("currency"),
            "amount_native": grant.get("amount"),
            "previous_balance_usd": prev_balance,
            "new_balance_usd": new_balance,
            "actor_id": admin["id"],
            "actor_username": admin.get("username"),
            "actor_role": admin.get("role"),
            "reason": grant.get("reason"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        if amount_usd > 0:
            await _notify_wallet_credit(grant["target_id"], float(amount_usd), f"Admin credit — {grant.get('reason','')[:80]}")
        # In-app notification (include `points` for forward-compat with strict NotificationModel)
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": grant["target_id"],
            "type": "admin_credit",
            "title": "Admin balance update",
            "message": f"{('+' if amount_usd >= 0 else '')}{amount_usd:.2f} USD · {grant['reason'][:80]}",
            "points": 0,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:  # stokvel
        await db.stokvels.update_one({"id": grant["target_id"]}, {"$inc": {"total_pool": amount_usd}})

    await db.credit_grants.update_one(
        {"id": grant["id"]},
        {"$set": {
            "status": "applied",
            "applied_at": datetime.now(timezone.utc).isoformat(),
            "co_approver_id": admin["id"] if grant["status"] == "pending_co_approval" else None,
        }},
    )
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="credit.grant_applied", target_type=grant["target_type"], target_id=grant["target_id"],
        reason=grant["reason"], metadata={"grant_id": grant["id"], "usd_equiv": amount_usd},
    )


@api_router.get("/admin/credit-grants")
async def admin_list_grants(
    status_filter: Optional[str] = None,
    limit: int = 100,
    admin: dict = Depends(require_admin_user),
):
    q: Dict[str, Any] = {}
    if status_filter:
        q["status"] = status_filter
    cur = db.credit_grants.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    return await cur.to_list(length=None)


# ===================== OWNER CONTROL CENTER =================================
# These endpoints are exposed to the Platform Owner (super_admin) to give a single
# dashboard-style snapshot of every operational, commercial, content, rewards,
# and engagement signal — with drill-down filtering on the audit trail so the
# owner can correct any issue they spot.

@api_router.get("/admin/owner/overview")
async def owner_overview(owner: dict = Depends(require_super_admin)):
    """High-level KPI snapshot for the Owner Control Center home view."""
    now = datetime.now(timezone.utc)
    today_iso = now.date().isoformat()
    day_ago = (now - timedelta(days=1)).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()

    # ── Users
    total_users = await db.users.count_documents({})
    verified_users = await db.users.count_documents({"email_verified": True})
    new_24h = await db.users.count_documents({"created_at": {"$gte": day_ago}})
    new_7d = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    role_breakdown_pipeline = [{"$group": {"_id": "$role", "n": {"$sum": 1}}}]
    role_rows = await db.users.aggregate(role_breakdown_pipeline).to_list(length=None)
    role_counts = {(r["_id"] or "user"): int(r["n"]) for r in role_rows}
    ambassador_count = await db.users.count_documents({"is_ambassador": True})

    # ── Wallet & financial
    wallet_agg = await db.users.aggregate([
        {"$group": {"_id": None, "total": {"$sum": {"$ifNull": ["$wallet_balance", 0]}}}}
    ]).to_list(1)
    total_wallet_usd = float(wallet_agg[0]["total"]) if wallet_agg else 0.0
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    completed_withdrawals_7d = await db.withdrawals.count_documents({
        "status": "paid", "updated_at": {"$gte": week_ago}
    })
    grant_count_24h = await db.credit_grants.count_documents({"created_at": {"$gte": day_ago}})
    payout_locked = _is_june_payout_locked()

    # ── Score / engagement
    events_today = await db.score_events.count_documents({"date_key": today_iso})
    pts_today_agg = await db.score_events.aggregate([
        {"$match": {"date_key": today_iso}},
        {"$group": {"_id": None, "pts": {"$sum": "$points"}}},
    ]).to_list(1)
    points_today = int(pts_today_agg[0]["pts"]) if pts_today_agg else 0
    top_contributors_month = await db.users.count_documents({
        "top_contributor_at": {"$exists": True, "$ne": None}
    })

    # ── Content
    posts_24h = await db.posts.count_documents({"created_at": {"$gte": day_ago}})
    official_posts_7d = await db.posts.count_documents({
        "is_official": True, "created_at": {"$gte": week_ago}
    })
    pending_ambassador_apps = await db.ambassador_applications.count_documents({"status": "pending"})

    # ── Advertising
    active_ads = await db.ads.count_documents({"is_active": True})
    ad_claims_24h = await db.ad_reward_claims.count_documents({"created_at": {"$gte": day_ago}})

    # ── Promotions
    active_promotions = await db.promotions.count_documents({"is_active": True})

    return {
        "generated_at": now.isoformat(),
        "users": {
            "total": total_users, "verified": verified_users,
            "new_24h": new_24h, "new_7d": new_7d,
            "ambassadors": ambassador_count,
            "by_role": role_counts,
        },
        "wallet": {
            "total_wallet_usd": round(total_wallet_usd, 2),
            "pending_withdrawals": pending_withdrawals,
            "completed_withdrawals_7d": completed_withdrawals_7d,
            "grants_24h": grant_count_24h,
            "payout_locked": payout_locked,
        },
        "engagement": {
            "score_events_today": events_today,
            "points_awarded_today": points_today,
            "posts_24h": posts_24h,
            "official_posts_7d": official_posts_7d,
            "top_contributors_this_month": top_contributors_month,
        },
        "content": {
            "pending_ambassador_apps": pending_ambassador_apps,
        },
        "ads": {
            "active_campaigns": active_ads,
            "claims_24h": ad_claims_24h,
        },
        "promotions": {
            "active": active_promotions,
        },
        "platform": {
            "super_admin_email": SUPER_ADMIN_EMAIL,
            "june_payout_release_at": JUNE_PAYOUT_RELEASE_AT.isoformat(),
        },
    }


@api_router.get("/admin/wallet-audit")
async def owner_wallet_audit(
    target_user_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    min_amount_usd: Optional[float] = None,
    days: int = 30,
    limit: int = 100,
    owner: dict = Depends(require_super_admin),
):
    """Filterable view of every wallet adjustment ever applied.  Super-admin only.

    Supports filtering by target user, actor (admin), minimum amount, and window.
    Returns rows sorted newest-first so the owner can spot anomalies and (via the
    UI) take corrective action (reverse via a counter-grant)."""
    q: Dict[str, Any] = {}
    if target_user_id:
        q["target_user_id"] = target_user_id
    if actor_id:
        q["actor_id"] = actor_id
    if isinstance(min_amount_usd, (int, float)):
        q["amount_usd"] = {"$gte": float(min_amount_usd)}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=max(1, days))).isoformat()
    q.setdefault("created_at", {})
    q["created_at"]["$gte"] = cutoff
    cur = db.wallet_adjustments_audit.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    rows = await cur.to_list(length=None)
    return {
        "count": len(rows),
        "window_days": days,
        "filters": {"target_user_id": target_user_id, "actor_id": actor_id, "min_amount_usd": min_amount_usd},
        "rows": rows,
    }


@api_router.post("/admin/wallet-audit/{audit_id}/reverse")
async def owner_wallet_audit_reverse(
    audit_id: str,
    payload: Dict[str, Any] = None,
    owner: dict = Depends(require_super_admin),
):
    """Reverse a previously-applied wallet adjustment by creating an inverse
    credit_grant. Append-only — the original audit row is preserved."""
    audit_row = await db.wallet_adjustments_audit.find_one({"id": audit_id}, {"_id": 0})
    if not audit_row:
        raise HTTPException(status_code=404, detail="Audit row not found")
    if audit_row.get("reversed_at"):
        raise HTTPException(status_code=400, detail="Adjustment already reversed")
    inverse_amount = -float(audit_row.get("amount_usd", 0.0))
    if inverse_amount == 0:
        raise HTTPException(status_code=400, detail="Cannot reverse a zero-amount entry")
    reason = ((payload or {}).get("reason") or f"Reversal of audit {audit_id}").strip()
    if len(reason) < 10:
        raise HTTPException(status_code=400, detail="Reason must be ≥ 10 chars")

    grant_record = {
        "id": str(uuid.uuid4()),
        "amount": inverse_amount, "currency": "USD",
        "usd_equiv": round(inverse_amount, 2),
        "reason": reason,
        "target_type": "user",
        "target_id": audit_row["target_user_id"],
        "created_by": owner["id"], "created_by_username": owner.get("username"),
        "co_approver_id": None,
        "status": "applied",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "applied_at": None,
        "reverses_audit_id": audit_id,
    }
    await db.credit_grants.insert_one(grant_record)
    await _apply_credit_grant(grant_record, owner)
    # Mark the original audit row as reversed (keeps trail intact).
    await db.wallet_adjustments_audit.update_one(
        {"id": audit_id},
        {"$set": {"reversed_at": datetime.now(timezone.utc).isoformat(),
                  "reversed_by_grant_id": grant_record["id"],
                  "reversed_by_actor_id": owner["id"]}},
    )
    return {"ok": True, "reversal_grant_id": grant_record["id"], "amount_usd": inverse_amount}


@api_router.get("/admin/feature-flags")
async def list_feature_flags(owner: dict = Depends(require_admin_user)):
    """Returns merged view of DB-stored flags + defaults so the UI can render every toggle."""
    defaults = globals().get("DEFAULT_FEATURE_FLAGS", {}) or {}
    db_flags = await db.feature_flags.find({}, {"_id": 0}).to_list(length=None)
    db_map = {f["key"]: f for f in db_flags}
    merged = []
    for key, default in defaults.items():
        row = db_map.get(key)
        merged.append({
            "key": key,
            "value": (row["value"] if row else default),
            "default": default,
            "updated_at": (row.get("updated_at") if row else None),
        })
    for k, row in db_map.items():
        if k not in defaults:
            merged.append({"key": k, "value": row["value"], "default": None,
                           "updated_at": row.get("updated_at")})
    return {"flags": merged}



# ---- AUDIT LOG -------------------------------------------------------------
@api_router.get("/admin/audit-log")
async def admin_audit_log(
    actor_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 200,
    admin: dict = Depends(require_admin_user),
):
    q: Dict[str, Any] = {}
    if actor_id:     q["actor_id"] = actor_id
    if target_type:  q["target_type"] = target_type
    if target_id:    q["target_id"] = target_id
    if action:       q["action"] = action
    cur = db.audit_log.find(q, {"_id": 0}).sort("created_at", -1).limit(min(limit, 1000))
    return await cur.to_list(length=None)


# ---- ADMIN STOKVELS LIST ---------------------------------------------------
@api_router.get("/admin/stokvels")
async def admin_list_stokvels(
    q: Optional[str] = None,
    limit: int = 100,
    admin: dict = Depends(require_admin_user),
):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    cur = db.stokvels.find(query, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    return await cur.to_list(length=None)


# ============================================================================
# ITER 28 — Feature Flags + System Account + Ambassador Role + Full Mgmt Suite
# ============================================================================

SYSTEM_ACCOUNT_USERNAME = "networkcapital"
SYSTEM_ACCOUNT_DISPLAY = "Network Capital"

DEFAULT_FEATURE_FLAGS = {
    "stokvel_plus_enabled": False,   # OFF by default → Coming Soon
}

AMBASSADOR_MONTHLY_TARGETS = [
    {"key": "recruits",            "label": "Recruit ≥ 5 new members",                "target": 5},
    {"key": "completed_profiles",  "label": "Help 3 referred members complete profile", "target": 3},
    {"key": "host_activity",       "label": "Host 1 Activity / event",                 "target": 1},
    {"key": "quality_posts",       "label": "Publish ≥ 10 posts",                      "target": 10},
    {"key": "comments",            "label": "Reply to ≥ 20 community comments",        "target": 20},
    {"key": "stokvel_assist",      "label": "Refer at least 1 Stokvel join",           "target": 1},
]


async def _ensure_system_account() -> Optional[str]:
    """Idempotently create the official 'Network Capital' system account."""
    existing = await db.users.find_one(
        {"username": SYSTEM_ACCOUNT_USERNAME},
        {"_id": 0, "id": 1},
    )
    if existing:
        return existing["id"]
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid,
        "username": SYSTEM_ACCOUNT_USERNAME,
        "email": "system@networkcapitalapp.co.za",
        "password": "$2b$12$disabled.system.account.no.login.allowed.x" * 1,
        "full_name": SYSTEM_ACCOUNT_DISPLAY,
        "photo": "",
        "is_system": True,
        "official": True,
        "role": "admin",
        "wallet_balance": 0.0,
        "monthly_score": 0,
        "network_score": 0,
        "profile_completed": True,
        "email_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    logger.info(f"[SYSTEM] Created Network Capital system account id={uid}")
    return uid


async def _ensure_feature_flags() -> None:
    """Idempotently seed default feature flags."""
    for key, default in DEFAULT_FEATURE_FLAGS.items():
        await db.feature_flags.update_one(
            {"key": key},
            {"$setOnInsert": {
                "key": key, "value": default,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )


@app.on_event("startup")
async def iter28_bootstrap():
    await _ensure_system_account()
    await _ensure_feature_flags()


# ---- FEATURE FLAGS --------------------------------------------------------
@api_router.get("/feature-flags")
async def public_feature_flags():
    """Read-only view used by the frontend to gate UI."""
    docs = await db.feature_flags.find({}, {"_id": 0}).to_list(length=None)
    flags = {d["key"]: d["value"] for d in docs}
    for k, v in DEFAULT_FEATURE_FLAGS.items():
        flags.setdefault(k, v)
    return flags


class FeatureFlagUpdate(BaseModel):
    value: Any


@api_router.put("/admin/feature-flags/{key}")
async def admin_set_feature_flag(
    key: str,
    payload: FeatureFlagUpdate,
    admin: dict = Depends(require_admin_user),
):
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can toggle feature flags")
    await db.feature_flags.update_one(
        {"key": key},
        {"$set": {"key": key, "value": payload.value, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="flag.set", target_type="feature_flag", target_id=key,
        metadata={"value": payload.value},
    )
    return {"ok": True, "key": key, "value": payload.value}


async def _is_feature_enabled(key: str) -> bool:
    doc = await db.feature_flags.find_one({"key": key}, {"_id": 0, "value": 1})
    if doc:
        return bool(doc["value"])
    return bool(DEFAULT_FEATURE_FLAGS.get(key, False))


# ---- ADMIN POSTS / DMS AS "NETWORK CAPITAL" -------------------------------
class AdminAnnounceRequest(BaseModel):
    content: str = Field(min_length=2, max_length=4000)
    image: Optional[str] = ""
    pin: Optional[bool] = False


@api_router.post("/admin/announce")
async def admin_announce_as_network_capital(
    payload: AdminAnnounceRequest,
    admin: dict = Depends(require_admin_user),
):
    """Publish a feed post authored by the Network Capital system account."""
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can announce as Network Capital")
    sys_uid = await _ensure_system_account()
    # IMPORTANT: shape must match the existing Post pydantic model to avoid
    # breaking GET /api/posts (response_model=List[Post]). Extra fields are
    # tolerated as Mongo metadata but stripped on response.
    post = {
        "id": str(uuid.uuid4()),
        "user_id": sys_uid,
        "username": SYSTEM_ACCOUNT_USERNAME,
        "user_photo": "",
        "user_score": 0,
        "content": payload.content.strip(),
        "image": payload.image or "",
        "video": "",
        "likes": [],            # Post.likes is List[str]
        "comments": [],
        "hashtags": [],
        "mentions": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        # iter28 metadata (not part of Post model — used by UI badges)
        "official": True,
        "is_announcement": True,
        "pinned": bool(payload.pin),
        "posted_by_admin_id": admin["id"],
    }
    await db.posts.insert_one(post)
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="post.announce", target_type="post", target_id=post["id"],
        reason="Announcement as Network Capital",
        metadata={"content_preview": post["content"][:120]},
    )
    post.pop("_id", None)
    return post


class AdminDMRequest(BaseModel):
    to_user_id: str
    message: str = Field(min_length=1, max_length=4000)


@api_router.post("/admin/dm")
async def admin_dm_as_network_capital(
    payload: AdminDMRequest,
    admin: dict = Depends(require_admin_user),
):
    """Send a direct message from the Network Capital system account."""
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can DM as Network Capital")
    target = await db.users.find_one({"id": payload.to_user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    sys_uid = await _ensure_system_account()
    message = {
        "id": str(uuid.uuid4()),
        "sender_id": sys_uid,
        "recipient_id": payload.to_user_id,
        "sender_username": SYSTEM_ACCOUNT_USERNAME,
        "content": payload.message.strip(),
        "official": True,
        "from_admin_id": admin["id"],
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(message)
    # In-app notification badge
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": payload.to_user_id,
        "type": "system_message",
        "title": "Message from Network Capital",
        "message": message["content"][:120],
        "points": 0,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="dm.send", target_type="user", target_id=payload.to_user_id,
        metadata={"message_id": message["id"]},
    )
    message.pop("_id", None)
    return message


# ---- USER RESTRICT / FLAG / ENRICH PROFILE --------------------------------
class RestrictUserRequest(BaseModel):
    can_post: Optional[bool] = None       # False → post-muted
    can_comment: Optional[bool] = None    # False → comment-muted
    can_dm: Optional[bool] = None         # False → DM-muted
    reason: Optional[str] = ""


@api_router.post("/admin/users/{user_id}/restrict")
async def admin_restrict_user(
    user_id: str,
    payload: RestrictUserRequest,
    admin: dict = Depends(require_admin_user),
):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    updates: Dict[str, Any] = {}
    for f in ("can_post", "can_comment", "can_dm"):
        v = getattr(payload, f)
        if v is not None:
            updates[f"restrictions.{f}"] = bool(v)
    if not updates:
        raise HTTPException(status_code=400, detail="Specify at least one restriction field")
    await db.users.update_one({"id": user_id}, {"$set": updates})
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="user.restrict", target_type="user", target_id=user_id,
        reason=payload.reason, metadata={"set": updates},
    )
    return {"ok": True, "restrictions": updates}


class FlagUserRequest(BaseModel):
    flagged: bool = True
    reason: Optional[str] = ""


@api_router.post("/admin/users/{user_id}/flag")
async def admin_flag_user(
    user_id: str,
    payload: FlagUserRequest,
    admin: dict = Depends(require_admin_user),
):
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"id": user_id}, {"$set": {
        "flagged_for_review": bool(payload.flagged),
        "flag_reason": payload.reason or "",
    }})
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="user.flag" if payload.flagged else "user.unflag",
        target_type="user", target_id=user_id, reason=payload.reason,
    )
    return {"ok": True, "flagged": payload.flagged}


@api_router.get("/admin/users/{user_id}/full-profile")
async def admin_full_profile(user_id: str, admin: dict = Depends(require_admin_user)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    counts = {
        "posts": await db.posts.count_documents({"user_id": user_id}),
        "comments": await db.comments.count_documents({"user_id": user_id}),
        "messages": await db.messages.count_documents({"$or": [{"sender_id": user_id}, {"recipient_id": user_id}]}),
        "place_reviews": await db.place_reviews.count_documents({"user_id": user_id}),
        "jobs_posted": await db.jobs.count_documents({"employer_id": user_id}),
        "applications": await db.job_applications.count_documents({"applicant_id": user_id}),
        "stokvels_member_of": await db.stokvel_members.count_documents({"user_id": user_id}),
        "referrals": await db.users.count_documents({"referred_by": user_id}),
    }
    recent_posts = await db.posts.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(length=None)
    return {"user": u, "counts": counts, "recent_posts": recent_posts}


# ---- ADMIN DELETE: STOKVEL / JOB / PLACE / ACTIVITY -----------------------
@api_router.delete("/admin/stokvels/{stokvel_id}")
async def admin_delete_stokvel(stokvel_id: str, reason: str = "", admin: dict = Depends(require_admin_user)):
    s = await db.stokvels.delete_one({"id": stokvel_id})
    if not s.deleted_count:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    await db.stokvel_members.delete_many({"stokvel_id": stokvel_id})
    await AuditLog.write(actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="stokvel.delete", target_type="stokvel", target_id=stokvel_id, reason=reason)
    return {"ok": True}


@api_router.delete("/admin/jobs/{job_id}")
async def admin_delete_job(job_id: str, reason: str = "", admin: dict = Depends(require_admin_user)):
    j = await db.jobs.delete_one({"id": job_id})
    if not j.deleted_count:
        raise HTTPException(status_code=404, detail="Job not found")
    await db.job_applications.delete_many({"job_id": job_id})
    await AuditLog.write(actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="job.delete", target_type="job", target_id=job_id, reason=reason)
    return {"ok": True}


@api_router.delete("/admin/places/{place_id}")
async def admin_delete_place(place_id: str, reason: str = "", admin: dict = Depends(require_admin_user)):
    p = await db.places.delete_one({"id": place_id})
    if not p.deleted_count:
        raise HTTPException(status_code=404, detail="Place not found")
    await db.place_reviews.delete_many({"place_id": place_id})
    await db.place_claims.delete_many({"place_id": place_id})
    await AuditLog.write(actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="place.delete", target_type="place", target_id=place_id, reason=reason)
    return {"ok": True}


@api_router.delete("/admin/activities/{activity_id}")
async def admin_delete_activity(activity_id: str, reason: str = "", admin: dict = Depends(require_admin_user)):
    res = await db.activities.delete_one({"id": activity_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Activity not found")
    await AuditLog.write(actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="activity.delete", target_type="activity", target_id=activity_id, reason=reason)
    return {"ok": True}


# ---- ADMIN LIST endpoints (Jobs / Places / Activities) --------------------
@api_router.get("/admin/jobs")
async def admin_list_jobs(q: Optional[str] = None, limit: int = 100, admin: dict = Depends(require_admin_user)):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"company": {"$regex": q, "$options": "i"}}]
    cur = db.jobs.find(query, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    return await cur.to_list(length=None)


@api_router.get("/admin/places")
async def admin_list_places(q: Optional[str] = None, limit: int = 100, admin: dict = Depends(require_admin_user)):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"city": {"$regex": q, "$options": "i"}}]
    cur = db.places.find(query, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    return await cur.to_list(length=None)


@api_router.get("/admin/activities")
async def admin_list_activities(q: Optional[str] = None, limit: int = 100, admin: dict = Depends(require_admin_user)):
    query: Dict[str, Any] = {}
    if q:
        query["$or"] = [{"title": {"$regex": q, "$options": "i"}}, {"description": {"$regex": q, "$options": "i"}}]
    cur = db.activities.find(query, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    return await cur.to_list(length=None)


# ---- AMBASSADOR ROLE + DASHBOARD + LEADERBOARD ----------------------------
@api_router.post("/admin/users/{user_id}/make-ambassador")
async def admin_make_ambassador(
    user_id: str,
    payload: Dict[str, Any] = None,
    admin: dict = Depends(require_admin_user),
):
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can grant ambassador status")
    target = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "email": 1, "is_ambassador": 1, "role": 1, "full_name": 1, "username": 1, "email_verified": 1},
    )
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    is_amb = bool((payload or {}).get("ambassador", True))
    prev_was_ambassador = bool(target.get("is_ambassador"))
    await db.users.update_one({"id": user_id}, {"$set": {
        "is_ambassador": is_amb,
        "ambassador_rank": "Rising Star" if is_amb else None,
        "ambassador_granted_at": datetime.now(timezone.utc).isoformat() if is_amb else None,
    }})
    # Role-change email + notification + audit (only when the flag actually changes).
    if prev_was_ambassador != is_amb:
        try:
            prev_label = "ambassador" if prev_was_ambassador else (target.get("role") or "user")
            new_label = "ambassador" if is_amb else (target.get("role") or "user")
            await _notify_role_change(
                user=target, previous_role=prev_label, new_role=new_label,
                actor_username=admin.get("username") or "admin",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"[ROLE-EMAIL-FAIL] make-ambassador user={user_id} err={exc}")
    await AuditLog.write(actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="user.ambassador_set", target_type="user", target_id=user_id,
        metadata={"is_ambassador": is_amb})
    return {"ok": True, "is_ambassador": is_amb}


def _ambassador_rank_for(total_contrib: int, recruit_count: int) -> str:
    if total_contrib >= 50_000 or recruit_count >= 100:
        return "Network Legend"
    if total_contrib >= 25_000 or recruit_count >= 50:
        return "Elite Ambassador"
    if total_contrib >= 10_000 or recruit_count >= 20:
        return "Senior Ambassador"
    if total_contrib >= 3_000  or recruit_count >= 5:
        return "Ambassador"
    return "Rising Star"


async def _ambassador_summary(user: dict) -> Dict[str, Any]:
    """Aggregate referral-network stats for an ambassador user."""
    uid = user["id"]
    referred = await db.users.find(
        {"referred_by": uid},
        {"_id": 0, "id": 1, "username": 1, "full_name": 1, "photo": 1,
         "monthly_score": 1, "network_score": 1, "profile_completed": 1,
         "created_at": 1},
    ).to_list(length=None)

    total_contrib = sum(int(r.get("monthly_score") or 0) for r in referred)
    completed_count = sum(1 for r in referred if r.get("profile_completed"))
    recruit_count = len(referred)

    # Trend: signups this week / this month
    now = datetime.now(timezone.utc)
    seven_d  = (now - timedelta(days=7)).isoformat()
    thirty_d = (now - timedelta(days=30)).isoformat()
    new_7d  = sum(1 for r in referred if (r.get("created_at") or "") >= seven_d)
    new_30d = sum(1 for r in referred if (r.get("created_at") or "") >= thirty_d)

    # Activity proxies (this calendar month)
    ref_ids = [r["id"] for r in referred]
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()
    posts_this_month = await db.posts.count_documents({"user_id": {"$in": ref_ids}, "created_at": {"$gte": month_start}}) if ref_ids else 0
    comments_this_month = await db.comments.count_documents({"user_id": {"$in": ref_ids}, "created_at": {"$gte": month_start}}) if ref_ids else 0
    stokvel_joins = await db.stokvel_members.count_documents({"user_id": {"$in": ref_ids}}) if ref_ids else 0
    activities_hosted = await db.activities.count_documents({"created_by": uid, "created_at": {"$gte": month_start}})

    # Targets progress
    progress = []
    metric_map = {
        "recruits":           new_30d,
        "completed_profiles": completed_count,
        "host_activity":      activities_hosted,
        "quality_posts":      posts_this_month,
        "comments":           comments_this_month,
        "stokvel_assist":     stokvel_joins,
    }
    for t in AMBASSADOR_MONTHLY_TARGETS:
        progress.append({
            "key": t["key"], "label": t["label"], "target": t["target"],
            "current": int(metric_map.get(t["key"], 0)),
        })

    rank = _ambassador_rank_for(total_contrib, recruit_count)
    return {
        "user_id": uid,
        "username": user.get("username"),
        "full_name": user.get("full_name"),
        "photo": user.get("photo") or "",
        "rank": rank,
        "recruit_count": recruit_count,
        "completed_count": completed_count,
        "new_7d": new_7d,
        "new_30d": new_30d,
        "total_contribution": total_contrib,
        "targets": progress,
        "recent_recruits": sorted(referred, key=lambda r: r.get("created_at",""), reverse=True)[:10],
        "performance": {
            "posts_this_month": posts_this_month,
            "comments_this_month": comments_this_month,
            "stokvel_joins": stokvel_joins,
            "activities_hosted": activities_hosted,
        },
    }


@api_router.get("/ambassadors/me")
async def my_ambassador_dashboard(current_user: dict = Depends(get_current_user)):
    if not current_user.get("is_ambassador"):
        raise HTTPException(status_code=403, detail="Ambassador access required")
    return await _ambassador_summary(current_user)


@api_router.get("/ambassadors/leaderboard")
async def ambassador_leaderboard(limit: int = 50):
    """Public leaderboard ranking ambassadors by their total network contribution."""
    cursor = db.users.find(
        {"is_ambassador": True},
        {"_id": 0, "id": 1, "username": 1, "full_name": 1, "photo": 1, "ambassador_rank": 1},
    ).limit(min(limit, 200))
    ambassadors = await cursor.to_list(length=None)
    summaries: List[Dict[str, Any]] = []
    for amb in ambassadors:
        s = await _ambassador_summary(amb)
        summaries.append({
            "user_id": s["user_id"],
            "username": s["username"],
            "full_name": s["full_name"],
            "photo": s["photo"],
            "rank": s["rank"],
            "total_contribution": s["total_contribution"],
            "recruit_count": s["recruit_count"],
            "new_30d": s["new_30d"],
            "completed_count": s["completed_count"],
        })
    summaries.sort(key=lambda x: (-x["total_contribution"], -x["recruit_count"]))
    return {"leaderboard": summaries, "generated_at": datetime.now(timezone.utc).isoformat()}


@api_router.get("/admin/ambassadors")
async def admin_list_ambassadors(admin: dict = Depends(require_admin_user)):
    cur = db.users.find({"is_ambassador": True}, {"_id": 0, "password": 0}).limit(500)
    return await cur.to_list(length=None)


# ---- STOKVEL+ COMING SOON GATE --------------------------------------------
async def _enforce_stokvel_plus_enabled():
    enabled = await _is_feature_enabled("stokvel_plus_enabled")
    if not enabled:
        raise HTTPException(
            status_code=503,
            detail="Stokvel+ is coming soon. Creation and registration are temporarily disabled.",
        )


# ============================================================================
# ITER 29 — PROMOTIONS SYSTEM (SAST schedules + ZAR rewards + leaderboards)
# ============================================================================

import asyncio
import zoneinfo as _promo_zoneinfo
from typing import Tuple

SAST_TZ = _promo_zoneinfo.ZoneInfo("Africa/Johannesburg")

# Cache active promotions in-memory and refresh every minute to avoid hitting
# the DB on every score_event. _record_promotion_event uses this cache.
_PROMO_CACHE: Dict[str, Any] = {"loaded_at": None, "items": []}


def _now_sast() -> datetime:
    return datetime.now(SAST_TZ)


def _parse_hhmm(s: str) -> Tuple[int, int]:
    try:
        h, m = s.split(":")
        return int(h), int(m)
    except Exception:  # noqa: BLE001
        return 0, 0


def _is_window_active(promo: dict, now: Optional[datetime] = None) -> bool:
    """Is the SAST clock currently inside this promo's active window?"""
    now = now or _now_sast()
    # Outside campaign date range
    start_at = promo.get("starts_at")
    end_at = promo.get("ends_at")
    iso_now = now.isoformat()
    if start_at and iso_now < start_at: return False
    if end_at   and iso_now > end_at:   return False
    if not promo.get("is_active", True): return False
    sched = promo.get("schedule") or {}
    days = sched.get("days_of_week") or list(range(7))   # 0=Mon … 6=Sun
    if now.weekday() not in days: return False
    sh, sm = _parse_hhmm(sched.get("start_time") or "00:00")
    eh, em = _parse_hhmm(sched.get("end_time")   or "23:59")
    minutes_now = now.hour * 60 + now.minute
    return (sh * 60 + sm) <= minutes_now <= (eh * 60 + em)


def _minutes_until_window(promo: dict, now: Optional[datetime] = None) -> Optional[int]:
    """Minutes until the next time this promo opens. None if no upcoming window."""
    now = now or _now_sast()
    sched = promo.get("schedule") or {}
    days = sched.get("days_of_week") or list(range(7))
    sh, sm = _parse_hhmm(sched.get("start_time") or "00:00")
    today_start = now.replace(hour=sh, minute=sm, second=0, microsecond=0)
    for offset in range(0, 8):
        candidate = today_start + timedelta(days=offset)
        if candidate.weekday() in days and candidate > now:
            return int((candidate - now).total_seconds() // 60)
    return None


async def _refresh_promo_cache(force: bool = False) -> None:
    now = datetime.now(timezone.utc)
    if not force and _PROMO_CACHE["loaded_at"] and (now - _PROMO_CACHE["loaded_at"]).total_seconds() < 60:
        return
    docs = await db.promotions.find({"is_active": True}, {"_id": 0}).to_list(length=None)
    _PROMO_CACHE["items"] = docs
    _PROMO_CACHE["loaded_at"] = now


async def _record_promotion_event(*, user_id: str, action: str, points: int) -> None:
    """Side-effect from award_points. If any active promotion qualifies, write a row."""
    if points <= 0:
        return
    await _refresh_promo_cache()
    if not _PROMO_CACHE["items"]:
        return
    sast_now = _now_sast()
    user_doc = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "id": 1, "username": 1, "photo": 1, "full_name": 1, "monthly_score": 1},
    )
    if not user_doc:
        return
    for promo in _PROMO_CACHE["items"]:
        # Match action
        elig = promo.get("eligible_actions") or []
        if elig and action not in elig:
            continue
        # Match min score
        if int(user_doc.get("monthly_score") or 0) < int(promo.get("min_network_score") or 0):
            continue
        # Match window
        if not _is_window_active(promo, sast_now):
            continue
        # Compute ZAR estimate from rate
        zar_rate = float(promo.get("zar_per_point") or 0)
        zar_estimate = round(points * zar_rate, 2)
        await db.promotion_events.insert_one({
            "id": str(uuid.uuid4()),
            "promotion_id": promo["id"],
            "user_id": user_id,
            "username": user_doc.get("username"),
            "photo": user_doc.get("photo") or "",
            "action": action,
            "points": int(points),
            "zar_estimate": zar_estimate,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_at_sast": sast_now.isoformat(),
            "day_key": sast_now.strftime("%Y-%m-%d"),
        })
        # Credit user's promotion ZAR balance ledger (separate from wallet)
        if zar_estimate > 0:
            await db.users.update_one(
                {"id": user_id},
                {"$inc": {"promotion_zar_balance": zar_estimate}},
            )


# ---- ADMIN: Promotion CRUD ------------------------------------------------
class PromotionScheduleIn(BaseModel):
    days_of_week: List[int] = Field(default_factory=lambda: [0, 2, 4])   # M,W,F
    start_time: str = "08:00"
    end_time: str = "12:00"


class PromotionIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: Optional[str] = ""
    eligible_actions: List[str] = Field(default_factory=list)
    min_network_score: int = 0
    schedule: PromotionScheduleIn = Field(default_factory=PromotionScheduleIn)
    starts_at: Optional[str] = None     # ISO datetime in SAST
    ends_at: Optional[str] = None
    zar_per_point: float = 0.0
    is_active: bool = True
    notify_about_to_start_min: int = 15  # send a heads-up X min before window opens
    notify_about_to_end_min: int = 15


@api_router.post("/admin/promotions")
async def admin_create_promotion(payload: PromotionIn, admin: dict = Depends(require_admin_user)):
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can manage promotions")
    promo = {
        "id": str(uuid.uuid4()),
        **payload.model_dump(),
        "created_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "_notify_state": {},
    }
    await db.promotions.insert_one(promo)
    await _refresh_promo_cache(force=True)
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="promotion.create", target_type="promotion", target_id=promo["id"],
        metadata={"name": promo["name"]},
    )
    promo.pop("_id", None)
    return promo


@api_router.get("/admin/promotions")
async def admin_list_promotions(admin: dict = Depends(require_admin_user)):
    cur = db.promotions.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
    items = await cur.to_list(length=None)
    sast_now = _now_sast()
    for p in items:
        p["is_window_active"] = _is_window_active(p, sast_now)
        p["minutes_until_window"] = _minutes_until_window(p, sast_now)
    return items


@api_router.get("/admin/promotions/{promotion_id}")
async def admin_get_promotion(promotion_id: str, admin: dict = Depends(require_admin_user)):
    p = await db.promotions.find_one({"id": promotion_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    sast_now = _now_sast()
    p["is_window_active"] = _is_window_active(p, sast_now)
    p["minutes_until_window"] = _minutes_until_window(p, sast_now)
    return p


@api_router.patch("/admin/promotions/{promotion_id}")
async def admin_update_promotion(promotion_id: str, payload: Dict[str, Any], admin: dict = Depends(require_admin_user)):
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can manage promotions")
    allowed = {"name", "description", "eligible_actions", "min_network_score", "schedule",
               "starts_at", "ends_at", "zar_per_point", "is_active",
               "notify_about_to_start_min", "notify_about_to_end_min"}
    upd = {k: v for k, v in payload.items() if k in allowed}
    if not upd:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.promotions.update_one({"id": promotion_id}, {"$set": upd})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Promotion not found")
    await _refresh_promo_cache(force=True)
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="promotion.update", target_type="promotion", target_id=promotion_id,
        metadata={"fields": list(upd.keys())},
    )
    return await db.promotions.find_one({"id": promotion_id}, {"_id": 0})


@api_router.delete("/admin/promotions/{promotion_id}")
async def admin_delete_promotion(promotion_id: str, admin: dict = Depends(require_admin_user)):
    if admin.get("role") not in ("admin", "super_admin"):
        raise HTTPException(status_code=403, detail="Only admins can manage promotions")
    res = await db.promotions.delete_one({"id": promotion_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Promotion not found")
    await _refresh_promo_cache(force=True)
    await AuditLog.write(
        actor_id=admin["id"], actor_username=admin.get("username") or "admin",
        action="promotion.delete", target_type="promotion", target_id=promotion_id,
    )
    return {"ok": True}


# ---- ANALYTICS endpoints --------------------------------------------------
async def _participant_aggregate(promotion_id: str) -> List[Dict[str, Any]]:
    """Aggregate per-user stats for a promotion."""
    pipeline = [
        {"$match": {"promotion_id": promotion_id}},
        {"$group": {
            "_id": "$user_id",
            "username": {"$last": "$username"},
            "photo": {"$last": "$photo"},
            "points": {"$sum": "$points"},
            "zar_estimate": {"$sum": "$zar_estimate"},
            "events": {"$sum": 1},
            "last_activity": {"$max": "$created_at_sast"},
            "days_active": {"$addToSet": "$day_key"},
            "posts": {"$sum": {"$cond": [{"$eq": ["$action", "post_create"]}, 1, 0]}},
            "shares": {"$sum": {"$cond": [{"$eq": ["$action", "post_share"]}, 1, 0]}},
            "comments": {"$sum": {"$cond": [{"$eq": ["$action", "comment_quality"]}, 1, 0]}},
            "referrals": {"$sum": {"$cond": [{"$in": ["$action", ["referral_qualified", "referral_feature_unlock", "referral_first_post"]]}, 1, 0]}},
        }},
        {"$project": {
            "_id": 0, "user_id": "$_id",
            "username": 1, "photo": 1, "points": 1, "zar_estimate": 1, "events": 1,
            "last_activity": 1, "posts": 1, "shares": 1, "comments": 1, "referrals": 1,
            "streak_days": {"$size": "$days_active"},
        }},
        {"$sort": {"points": -1}},
    ]
    return await db.promotion_events.aggregate(pipeline).to_list(length=None)


@api_router.get("/admin/promotions/{promotion_id}/participants")
async def admin_promotion_participants(promotion_id: str, admin: dict = Depends(require_admin_user)):
    p = await db.promotions.find_one({"id": promotion_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    rows = await _participant_aggregate(promotion_id)
    # Enrich with current_score
    if rows:
        ids = [r["user_id"] for r in rows]
        cur_scores = {u["id"]: u for u in await db.users.find(
            {"id": {"$in": ids}},
            {"_id": 0, "id": 1, "monthly_score": 1, "network_score": 1, "full_name": 1},
        ).to_list(length=None)}
        for r in rows:
            u = cur_scores.get(r["user_id"], {})
            r["current_score"] = u.get("monthly_score") or 0
            r["lifetime_score"] = u.get("network_score") or 0
            r["full_name"] = u.get("full_name")
    return {"participants": rows, "total": len(rows)}


@api_router.get("/admin/promotions/{promotion_id}/leaderboard")
async def admin_promotion_leaderboard(promotion_id: str, limit: int = 50, admin: dict = Depends(require_admin_user)):
    rows = await _participant_aggregate(promotion_id)
    return {
        "leaderboard": rows[:limit],
        "ambassadors": [r for r in rows if await db.users.find_one({"id": r["user_id"], "is_ambassador": True}, {"_id": 0, "id": 1})][:limit],
    }


@api_router.get("/admin/promotions/{promotion_id}/feed")
async def admin_promotion_feed(promotion_id: str, limit: int = 50, admin: dict = Depends(require_admin_user)):
    cur = db.promotion_events.find({"promotion_id": promotion_id}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500))
    return await cur.to_list(length=None)


@api_router.get("/admin/promotions/{promotion_id}/summary")
async def admin_promotion_summary(promotion_id: str, admin: dict = Depends(require_admin_user)):
    p = await db.promotions.find_one({"id": promotion_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    total_points = await db.promotion_events.aggregate([
        {"$match": {"promotion_id": promotion_id}},
        {"$group": {"_id": None, "pts": {"$sum": "$points"}, "zar": {"$sum": "$zar_estimate"}, "events": {"$sum": 1}}},
    ]).to_list(length=None)
    agg = total_points[0] if total_points else {"pts": 0, "zar": 0, "events": 0}
    unique_participants = await db.promotion_events.distinct("user_id", {"promotion_id": promotion_id})
    daily = await db.promotion_events.aggregate([
        {"$match": {"promotion_id": promotion_id}},
        {"$group": {"_id": "$day_key", "pts": {"$sum": "$points"}, "events": {"$sum": 1}, "users": {"$addToSet": "$user_id"}}},
        {"$project": {"_id": 0, "day": "$_id", "pts": 1, "events": 1, "users": {"$size": "$users"}}},
        {"$sort": {"day": 1}},
    ]).to_list(length=None)
    avg_per_user = round((agg["pts"] / max(len(unique_participants), 1)), 1) if unique_participants else 0
    return {
        "promotion": {**p, "is_window_active": _is_window_active(p), "minutes_until_window": _minutes_until_window(p)},
        "total_participants": len(unique_participants),
        "total_points": agg["pts"],
        "total_zar_allocated": round(agg["zar"], 2),
        "total_events": agg["events"],
        "avg_points_per_user": avg_per_user,
        "daily_trend": daily,
    }


@api_router.get("/admin/promotions-summary")
async def admin_all_promotions_summary(admin: dict = Depends(require_admin_user)):
    """Roll-up across every promotion ever created (for the dashboard panel)."""
    total_promos = await db.promotions.count_documents({})
    active_promos = await db.promotions.count_documents({"is_active": True})
    agg = await db.promotion_events.aggregate([
        {"$group": {"_id": None, "pts": {"$sum": "$points"}, "zar": {"$sum": "$zar_estimate"}, "events": {"$sum": 1}, "users": {"$addToSet": "$user_id"}}},
    ]).to_list(length=None)
    a = agg[0] if agg else {"pts": 0, "zar": 0, "events": 0, "users": []}
    return {
        "total_promotions": total_promos,
        "active_promotions": active_promos,
        "total_participants": len(a.get("users") or []),
        "total_points_generated": a["pts"],
        "total_engagement_actions": a["events"],
        "total_zar_allocated": round(a["zar"], 2),
        "avg_per_user": round(a["pts"] / max(len(a.get("users") or []), 1), 1),
        "now_sast": _now_sast().isoformat(),
    }


# ---- Public: active promotions (for the user-facing banner) ---------------
# Canonical conversion rate published across the platform.
# 100 Network Points = R10 ZAR  →  R0.10/pt
NETWORK_POINTS_PER_ZAR = 100
ZAR_PER_NETWORK_POINT = 0.10


def _points_to_zar(points: int) -> float:
    return round(int(points or 0) * ZAR_PER_NETWORK_POINT, 2)


@api_router.get("/promotions/active")
async def public_active_promotions():
    """Read-only view used by the frontend to show 'window is open' banners."""
    await _refresh_promo_cache(force=True)
    sast_now = _now_sast()
    out = []
    for p in _PROMO_CACHE["items"]:
        active = _is_window_active(p, sast_now)
        out.append({
            "id": p["id"],
            "name": p["name"],
            "description": p.get("description") or "",
            "is_window_active": active,
            "minutes_until_window": _minutes_until_window(p, sast_now),
            "schedule": p.get("schedule"),
            "eligible_actions": p.get("eligible_actions") or [],
            "zar_per_point": p.get("zar_per_point") or 0,
            "min_network_score": p.get("min_network_score") or 0,
            "now_sast": sast_now.isoformat(),
        })
    return out


# ============================================================================
# USER-FACING promotions endpoints (Profile tab + Login modal)
# ============================================================================
async def _user_promo_stats(user_id: str, promotion_id: str) -> Dict[str, Any]:
    """Per-user aggregated stats for one promotion (points, zar, breakdown, streak, rank)."""
    pipeline = [
        {"$match": {"promotion_id": promotion_id, "user_id": user_id}},
        {"$group": {
            "_id": "$user_id",
            "points": {"$sum": "$points"},
            "events": {"$sum": 1},
            "last_activity": {"$max": "$created_at_sast"},
            "days_active": {"$addToSet": "$day_key"},
            "posts": {"$sum": {"$cond": [{"$eq": ["$action", "post_create"]}, 1, 0]}},
            "shares": {"$sum": {"$cond": [{"$eq": ["$action", "post_share"]}, 1, 0]}},
            "comments": {"$sum": {"$cond": [{"$eq": ["$action", "comment_quality"]}, 1, 0]}},
            "likes": {"$sum": {"$cond": [{"$eq": ["$action", "post_like"]}, 1, 0]}},
            "referrals": {"$sum": {"$cond": [{"$in": ["$action", ["referral_qualified", "referral_feature_unlock", "referral_first_post"]]}, 1, 0]}},
            "place_reviews": {"$sum": {"$cond": [{"$eq": ["$action", "place_review_create"]}, 1, 0]}},
            "connections": {"$sum": {"$cond": [{"$eq": ["$action", "connection_made"]}, 1, 0]}},
        }},
    ]
    rows = await db.promotion_events.aggregate(pipeline).to_list(length=1)
    base = rows[0] if rows else {}
    pts = int(base.get("points") or 0)
    # Today's contribution in SAST
    today_key = _now_sast().strftime("%Y-%m-%d")
    today_pts = await db.promotion_events.aggregate([
        {"$match": {"promotion_id": promotion_id, "user_id": user_id, "day_key": today_key}},
        {"$group": {"_id": None, "pts": {"$sum": "$points"}}},
    ]).to_list(length=1)
    today_total = int((today_pts[0]["pts"] if today_pts else 0) or 0)
    return {
        "points": pts,
        "zar_estimate": _points_to_zar(pts),
        "events": int(base.get("events") or 0),
        "last_activity": base.get("last_activity"),
        "streak_days": len(base.get("days_active") or []),
        "today_points": today_total,
        "today_zar": _points_to_zar(today_total),
        "breakdown": {
            "posts": int(base.get("posts") or 0),
            "shares": int(base.get("shares") or 0),
            "comments": int(base.get("comments") or 0),
            "likes": int(base.get("likes") or 0),
            "referrals": int(base.get("referrals") or 0),
            "place_reviews": int(base.get("place_reviews") or 0),
            "connections": int(base.get("connections") or 0),
        },
    }


async def _user_rank_in_promo(user_id: str, promotion_id: str) -> Optional[int]:
    """1-based rank of this user in the promotion (by total points)."""
    rows = await _participant_aggregate(promotion_id)
    for i, r in enumerate(rows):
        if r["user_id"] == user_id:
            return i + 1
    return None


@api_router.get("/users/me/promotions")
async def my_promotions(current_user: dict = Depends(get_current_user)):
    """Return every active promotion enriched with this user's participation stats."""
    await _refresh_promo_cache(force=True)
    sast_now = _now_sast()
    out = []
    for p in _PROMO_CACHE["items"]:
        stats = await _user_promo_stats(current_user["id"], p["id"])
        rank = await _user_rank_in_promo(current_user["id"], p["id"]) if stats["points"] > 0 else None
        out.append({
            "promotion": {
                "id": p["id"], "name": p["name"], "description": p.get("description") or "",
                "schedule": p.get("schedule"),
                "is_window_active": _is_window_active(p, sast_now),
                "minutes_until_window": _minutes_until_window(p, sast_now),
                "eligible_actions": p.get("eligible_actions") or [],
                "zar_per_point": p.get("zar_per_point") or ZAR_PER_NETWORK_POINT,
                "min_network_score": p.get("min_network_score") or 0,
            },
            "stats": stats,
            "rank": rank,
        })
    total_points = sum(o["stats"]["points"] for o in out)
    return {
        "promotions": out,
        "user_summary": {
            "monthly_score": int(current_user.get("monthly_score") or 0),
            "network_score": int(current_user.get("network_score") or 0),
            "total_points_in_promotions": total_points,
            "total_zar_estimate": _points_to_zar(total_points),
            "conversion": {"points": NETWORK_POINTS_PER_ZAR, "zar": 10, "rate_per_point": ZAR_PER_NETWORK_POINT, "label": "100 Network Points = R10 ZAR"},
        },
        "now_sast": sast_now.isoformat(),
    }


@api_router.get("/users/me/promotion-events")
async def my_promotion_events(promotion_id: Optional[str] = None, limit: int = 50, current_user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {"user_id": current_user["id"]}
    if promotion_id:
        q["promotion_id"] = promotion_id
    cur = db.promotion_events.find(q, {"_id": 0}).sort("created_at", -1).limit(min(int(limit or 50), 200))
    return await cur.to_list(length=None)


@api_router.get("/promotions/me/login-summary")
async def my_login_summary(current_user: dict = Depends(get_current_user)):
    """Single payload for the daily login modal."""
    await _refresh_promo_cache(force=True)
    sast_now = _now_sast()
    active_promos = []
    for p in _PROMO_CACHE["items"]:
        stats = await _user_promo_stats(current_user["id"], p["id"])
        active_promos.append({
            "id": p["id"], "name": p["name"], "description": p.get("description") or "",
            "schedule": p.get("schedule"),
            "is_window_active": _is_window_active(p, sast_now),
            "minutes_until_window": _minutes_until_window(p, sast_now),
            "user_points": stats["points"],
            "user_zar_estimate": stats["zar_estimate"],
            "user_today_points": stats["today_points"],
            "user_today_zar": stats["today_zar"],
            "user_streak_days": stats["streak_days"],
        })
    # Top 3 ambassadors (reuse existing leaderboard logic — by total_contribution)
    top_amb_pipeline = [
        {"$match": {"is_ambassador": True, "deactivated": {"$ne": True}}},
        {"$project": {"_id": 0, "id": 1, "username": 1, "full_name": 1, "photo": 1, "ambassador_rank": 1,
                      "network_score": {"$ifNull": ["$network_score", 0]},
                      "monthly_score": {"$ifNull": ["$monthly_score", 0]}}},
        {"$sort": {"network_score": -1, "monthly_score": -1}},
        {"$limit": 3},
    ]
    top_ambassadors = await db.users.aggregate(top_amb_pipeline).to_list(length=3)
    user_mscore = int(current_user.get("monthly_score") or 0)
    return {
        "user": {
            "id": current_user["id"],
            "username": current_user.get("username"),
            "full_name": current_user.get("full_name"),
            "photo": current_user.get("photo"),
            "monthly_score": user_mscore,
            "network_score": int(current_user.get("network_score") or 0),
            "estimated_zar_value": _points_to_zar(user_mscore),
        },
        "active_promotions": active_promos,
        "top_ambassadors": top_ambassadors,
        "conversion": {"points": NETWORK_POINTS_PER_ZAR, "zar": 10, "rate_per_point": ZAR_PER_NETWORK_POINT, "label": "100 Network Points = R10 ZAR"},
        "now_sast": sast_now.isoformat(),
        "philosophy": "Network Capital is built on community participation, contribution, and shared growth. Every action you take strengthens your network and unlocks collective benefits.",
    }


# ---- Background scheduler: window open/close notifications ----------------
_PROMO_NOTIFIER_TASK: Optional[asyncio.Task] = None


async def _promotion_notifier_loop():
    """Every 60s, check every active promo; on transition write notifications.
    Targets users who have participated in this promo OR who match min_score."""
    while True:
        try:
            await _refresh_promo_cache(force=True)
            sast_now = _now_sast()
            for promo in _PROMO_CACHE["items"]:
                now_active = _is_window_active(promo, sast_now)
                mins_until = _minutes_until_window(promo, sast_now)
                state_key = sast_now.strftime("%Y-%m-%d")

                # JUST OPENED
                last_open = (promo.get("_notify_state") or {}).get("opened_on")
                if now_active and last_open != state_key:
                    await _notify_promo_participants(
                        promo,
                        title=f"🎉 {promo['name']} window is OPEN",
                        message=f"Earn ZAR-converted points until {promo['schedule']['end_time']} SAST.",
                    )
                    await db.promotions.update_one(
                        {"id": promo["id"]},
                        {"$set": {"_notify_state.opened_on": state_key}},
                    )

                # ABOUT TO START
                heads_up = int(promo.get("notify_about_to_start_min") or 15)
                last_pre  = (promo.get("_notify_state") or {}).get("pre_open_on")
                if (mins_until is not None) and 0 < mins_until <= heads_up and last_pre != state_key:
                    await _notify_promo_participants(
                        promo,
                        title=f"⏰ {promo['name']} starts in {mins_until} min",
                        message=f"Get ready — window opens at {promo['schedule']['start_time']} SAST.",
                    )
                    await db.promotions.update_one(
                        {"id": promo["id"]},
                        {"$set": {"_notify_state.pre_open_on": state_key}},
                    )

                # ABOUT TO END (only when window is currently active)
                if now_active:
                    eh, em = _parse_hhmm(promo["schedule"].get("end_time") or "00:00")
                    end_today = sast_now.replace(hour=eh, minute=em, second=0, microsecond=0)
                    mins_left = int((end_today - sast_now).total_seconds() // 60)
                    heads_down = int(promo.get("notify_about_to_end_min") or 15)
                    last_close = (promo.get("_notify_state") or {}).get("closing_on")
                    if 0 < mins_left <= heads_down and last_close != state_key:
                        await _notify_promo_participants(
                            promo,
                            title=f"⏳ {promo['name']} closing in {mins_left} min",
                            message=f"Last call to earn — window closes at {promo['schedule']['end_time']} SAST.",
                        )
                        await db.promotions.update_one(
                            {"id": promo["id"]},
                            {"$set": {"_notify_state.closing_on": state_key}},
                        )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"promo_notifier_loop iter failed: {exc}")
        await asyncio.sleep(60)


async def _notify_promo_participants(promo: dict, *, title: str, message: str) -> None:
    """Push a notification to anyone who has ever participated in this promo
    OR who meets the score-threshold (so they're aware before the first event)."""
    notified_ids: set = set()
    for uid in await db.promotion_events.distinct("user_id", {"promotion_id": promo["id"]}):
        notified_ids.add(uid)
    if int(promo.get("min_network_score") or 0) > 0:
        cur = db.users.find(
            {"monthly_score": {"$gte": int(promo["min_network_score"])}},
            {"_id": 0, "id": 1},
        ).limit(2000)
        async for u in cur:
            notified_ids.add(u["id"])
    elif not notified_ids:
        # No existing participants and no min_score → notify everyone (cap 2k)
        cur = db.users.find({"deactivated": {"$ne": True}}, {"_id": 0, "id": 1}).limit(2000)
        async for u in cur:
            notified_ids.add(u["id"])
    now_iso = datetime.now(timezone.utc).isoformat()
    if notified_ids:
        await db.notifications.insert_many([{
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "promotion",
            "title": title,
            "message": message,
            "points": 0,
            "read": False,
            "promotion_id": promo["id"],
            "created_at": now_iso,
        } for uid in notified_ids])


@app.on_event("startup")
async def iter29_start_promo_loop():
    global _PROMO_NOTIFIER_TASK
    if _PROMO_NOTIFIER_TASK is None or _PROMO_NOTIFIER_TASK.done():
        _PROMO_NOTIFIER_TASK = asyncio.create_task(_promotion_notifier_loop())


# ============== DAILY REWARDS DIGEST (Brevo) ==============
# Fires once per user per day at >= 21:00 SAST (19:00 UTC) — only if they earned
# points today. Idempotency: user.last_rewards_digest_date == today's SAST date.
_DAILY_DIGEST_TASK: Optional[asyncio.Task] = None
_DAILY_DIGEST_HOUR_UTC = 19  # 21:00 SAST
_DAILY_DIGEST_POLL_SECONDS = 600  # check every 10 min


def _sast_today_key() -> str:
    """Today's date key in SAST (UTC+2). Promotions also use SAST as the canonical TZ."""
    return (datetime.now(timezone.utc) + timedelta(hours=2)).strftime("%Y-%m-%d")


async def _send_one_daily_digest(user: dict, digest_date_key: str) -> bool:
    """Build & send the daily digest for ONE user. Returns True if sent."""
    user_id = user["id"]
    pipeline = [
        {"$match": {"user_id": user_id, "date_key": digest_date_key}},
        {"$group": {"_id": "$action", "points": {"$sum": "$points"}, "count": {"$sum": 1}}},
        {"$sort": {"points": -1}},
    ]
    rows = await db.score_events.aggregate(pipeline).to_list(length=None)
    if not rows:
        return False
    total = sum(int(r.get("points", 0)) for r in rows)
    if total <= 0:
        return False
    breakdown = [
        {
            "label": _SCORE_ACTION_LABELS.get(r["_id"], r["_id"].replace("_", " ").title()),
            "points": int(r.get("points", 0)),
            "count": int(r.get("count", 1)),
        }
        for r in rows
    ]
    email = (user.get("email") or "").strip().lower()
    if not email or not user.get("email_verified") or not _is_broadcast_eligible_email(email):
        return False
    await _send_branded_email(
        to=email,
        subject=f"Your Network Capital recap — +{total} pts today",
        html=_daily_rewards_digest_html(
            name=(user.get("full_name") or user.get("username") or "there"),
            total_points=total,
            breakdown=breakdown,
        ),
        kind="rewards_digest",
    )
    return True


async def _run_daily_digest_sweep() -> int:
    """One sweep: send to every verified user with points today and no digest yet.
    Returns number of emails sent."""
    today = _sast_today_key()
    sent = 0
    # Distinct users with score events today
    user_ids = await db.score_events.distinct("user_id", {"date_key": today})
    if not user_ids:
        return 0
    for uid in user_ids:
        try:
            user = await db.users.find_one(
                {"id": uid, "email_verified": True, "last_rewards_digest_date": {"$ne": today}},
                {"_id": 0, "id": 1, "email": 1, "full_name": 1, "username": 1, "email_verified": 1},
            )
            if not user:
                continue
            delivered = await _send_one_daily_digest(user, today)
            if delivered:
                await db.users.update_one(
                    {"id": uid},
                    {"$set": {"last_rewards_digest_date": today,
                              "last_rewards_digest_at": datetime.now(timezone.utc).isoformat()}},
                )
                sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"[DIGEST-FAIL] user={uid} err={exc}")
    return sent


async def _daily_digest_loop() -> None:
    """Background loop — every 10 min checks if SAST hour >= 21 and runs sweep."""
    await asyncio.sleep(30)  # avoid blocking startup
    while True:
        try:
            sast_now = datetime.now(timezone.utc) + timedelta(hours=2)
            if sast_now.hour >= 21:  # 21:00 SAST onwards
                sent = await _run_daily_digest_sweep()
                if sent:
                    logger.info(f"[DIGEST] Sent {sent} daily rewards emails for {_sast_today_key()}")
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"[DIGEST-LOOP] err={exc}")
        await asyncio.sleep(_DAILY_DIGEST_POLL_SECONDS)


@app.on_event("startup")
async def start_daily_digest_loop():
    global _DAILY_DIGEST_TASK
    if _DAILY_DIGEST_TASK is None or _DAILY_DIGEST_TASK.done():
        _DAILY_DIGEST_TASK = asyncio.create_task(_daily_digest_loop())


# Admin-trigger endpoint so QA can fire the digest without waiting until 21:00 SAST.
@api_router.post("/admin/rewards/digest/run")
async def admin_run_rewards_digest(admin: dict = Depends(require_admin_user)):
    """Force-run today's digest sweep. Idempotent — users already emailed today are skipped."""
    sent = await _run_daily_digest_sweep()
    return {"ok": True, "sent": sent, "date_key_sast": _sast_today_key()}


# ============== OFFICIAL BROADCAST (Brevo) ==============
# When an admin posts with is_official=True, email every verified user.
# Test / non-deliverable domains are skipped so QA pollution doesn't burn quota.
_BROADCAST_SKIP_DOMAINS = {"example.com", "example.org", "example.net", "test.com", "qa.local"}


def _is_broadcast_eligible_email(email: str) -> bool:
    if not email or "@" not in email:
        return False
    domain = email.rsplit("@", 1)[-1].lower()
    return domain not in _BROADCAST_SKIP_DOMAINS


async def _broadcast_official_post(post: dict) -> int:
    """Fan-out email send. Runs as a background task. Returns count sent."""
    sent = 0
    headline = "New update from Network Capital"
    preview_raw = (post.get("content") or "").strip()
    if len(preview_raw) > 320:
        preview_raw = preview_raw[:317] + "…"
    # Basic HTML escape on the preview to keep template safe.
    import html as _html
    preview = _html.escape(preview_raw).replace("\n", "<br/>")
    cursor = db.users.find(
        {"email_verified": True, "email": {"$exists": True, "$ne": ""}},
        {"_id": 0, "id": 1, "email": 1, "full_name": 1, "username": 1, "broadcast_opt_out": 1},
    )
    async for u in cursor:
        if u.get("broadcast_opt_out"):
            continue
        email = (u.get("email") or "").strip().lower()
        if not _is_broadcast_eligible_email(email):
            continue
        try:
            ok = await _send_branded_email(
                to=email,
                subject="Network Capital · New official update",
                html=_official_broadcast_html(
                    recipient_name=(u.get("full_name") or u.get("username") or "there"),
                    headline=headline,
                    content_preview=preview,
                    post_id=post["id"],
                ),
                kind="official_broadcast",
            )
            if ok:
                sent += 1
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"[BROADCAST-FAIL] user={u.get('id')} err={exc}")
        # Gentle throttle — Brevo free tier is 300/day, paid plans much higher.
        # Sleep keeps us under burst limits without DoSing our own loop.
        await asyncio.sleep(0.05)
    logger.info(f"[BROADCAST] Official post {post['id']} fan-out complete — sent={sent}")
    return sent


# ---- Seed the M/W/F 08-12 SAST promotion if none exist --------------------
@app.on_event("startup")
async def iter29_seed_mwf_promotion():
    existing = await db.promotions.count_documents({})
    if existing > 0:
        return
    seed = {
        "id": str(uuid.uuid4()),
        "name": "M/W/F Points-to-Cash Window",
        "description": "All eligible Network Score points earned during M/W/F 08:00–12:00 SAST convert to ZAR cash rewards.",
        "eligible_actions": [
            "post_create", "post_share", "comment_quality", "post_like",
            "video_watched", "referral_qualified", "referral_feature_unlock",
            "referral_first_post", "ad_watch_engage", "ad_watch_share",
            "place_review_create", "connection_made", "job_share", "daily_checkin",
        ],
        "min_network_score": 0,
        "schedule": {"days_of_week": [0, 2, 4], "start_time": "08:00", "end_time": "12:00"},
        "starts_at": None, "ends_at": None,
        "zar_per_point": 0.10,    # 1 pt = R0.10 by default — admin can edit
        "is_active": True,
        "notify_about_to_start_min": 15,
        "notify_about_to_end_min": 15,
        "created_by": "system",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "_notify_state": {},
    }
    await db.promotions.insert_one(seed)
    logger.info(f"[SEED] Created M/W/F SAST promotion id={seed['id']}")


# ============================================================================
# ITER 34 — WITHDRAWALS (Wallet + Promotion ZAR balance, KYC-style request flow)
# ============================================================================
WITHDRAW_MIN_SCORE = 3500
WITHDRAW_PROOF_MAX_BYTES = 5 * 1024 * 1024  # 5 MB
WITHDRAW_PROOF_ALLOWED_PREFIXES = ("data:application/pdf", "data:image/png", "data:image/jpeg", "data:image/jpg")


class WithdrawalRequestIn(BaseModel):
    source: str = Field(pattern="^(wallet|promotion)$")
    amount_zar: float = Field(gt=0)
    full_name: str = Field(min_length=2, max_length=120)
    bank_name: str = Field(min_length=2, max_length=120)
    account_number: str = Field(min_length=4, max_length=40)
    branch_code: Optional[str] = ""
    swift_code: Optional[str] = ""
    address: str = Field(min_length=4, max_length=400)
    proof_data_url: str = Field(min_length=20)   # base64 data-URL, pdf/jpg/png ≤5MB


def _mask_account(num: str) -> str:
    n = (num or "").replace(" ", "")
    if len(n) <= 4:
        return "•" * len(n)
    return "•" * (len(n) - 4) + n[-4:]


@api_router.post("/withdrawals")
async def create_user_withdrawal(payload: WithdrawalRequestIn, current_user: dict = Depends(get_current_user)):
    # June 2026 payout window — block both new requests AND admin approvals
    # until the release date. We surface a clear, friendly message.
    if _is_june_payout_locked():
        raise HTTPException(status_code=403, detail=_june_payout_message())
    # Eligibility — network score floor
    net_score = int(current_user.get("network_score") or 0)
    monthly = int(current_user.get("monthly_score") or 0)
    if max(net_score, monthly) < WITHDRAW_MIN_SCORE:
        raise HTTPException(status_code=403, detail=f"Network Score of {WITHDRAW_MIN_SCORE} or higher required to request a withdrawal.")

    # Validate proof file size + mime via base64 prefix
    proof = payload.proof_data_url
    if not proof.startswith(WITHDRAW_PROOF_ALLOWED_PREFIXES):
        raise HTTPException(status_code=400, detail="Proof of banking must be PDF, JPG, or PNG.")
    # Approximate decoded size — base64 ~ 4/3 of raw, after stripping the prefix
    try:
        _, b64 = proof.split(",", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Proof of banking is invalid.")
    if len(b64) * 3 // 4 > WITHDRAW_PROOF_MAX_BYTES:
        raise HTTPException(status_code=400, detail="Proof of banking must be 5 MB or smaller.")

    # Check source balance
    if payload.source == "wallet":
        available = float(current_user.get("wallet_balance") or 0)
    else:
        available = float(current_user.get("promotion_zar_balance") or 0)
    if payload.amount_zar > available + 1e-9:
        raise HTTPException(status_code=400, detail=f"Requested R{payload.amount_zar:.2f} exceeds available R{available:.2f} on the {payload.source} balance.")

    # Reserve funds — deduct immediately so the user can't double-spend a pending request
    bal_field = "wallet_balance" if payload.source == "wallet" else "promotion_zar_balance"
    await db.users.update_one({"id": current_user["id"]}, {"$inc": {bal_field: -payload.amount_zar}})

    wid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": wid,
        "user_id": current_user["id"],
        "username": current_user.get("username"),
        "user_email": current_user.get("email"),
        "source": payload.source,                  # wallet | promotion
        "amount_zar": round(float(payload.amount_zar), 2),
        "full_name": payload.full_name.strip(),
        "bank_name": payload.bank_name.strip(),
        "account_number": payload.account_number.strip(),
        "branch_code": (payload.branch_code or "").strip(),
        "swift_code": (payload.swift_code or "").strip(),
        "address": payload.address.strip(),
        "proof_data_url": proof,
        "status": "pending",
        "admin_notes": [],
        "created_at": now,
        "updated_at": now,
        "approved_at": None,
        "rejected_at": None,
        "paid_at": None,
        "network_score_at_request": net_score,
        "monthly_score_at_request": monthly,
    }
    await db.withdrawals.insert_one(doc)

    # Notify all admins via in-app notification
    admin_ids = [u["id"] async for u in db.users.find({"role": {"$in": ["admin", "moderator"]}}, {"_id": 0, "id": 1})]
    if admin_ids:
        await db.notifications.insert_many([{
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "withdrawal",
            "title": "New withdrawal request",
            "message": f"@{current_user.get('username') or 'user'} requested R{payload.amount_zar:.2f} from {payload.source}.",
            "withdrawal_id": wid,
            "read": False,
            "created_at": now,
        } for uid in admin_ids])

    return {
        "id": wid,
        "status": "pending",
        "amount_zar": doc["amount_zar"],
        "source": payload.source,
        "estimated_processing": "24–48 hours",
        "created_at": now,
    }


@api_router.get("/withdrawals/me")
async def my_withdrawals(current_user: dict = Depends(get_current_user)):
    rows = await db.withdrawals.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "proof_data_url": 0},   # hide the heavy proof blob from list
    ).sort("created_at", -1).limit(100).to_list(length=None)
    for r in rows:
        if r.get("account_number"):
            r["account_number_masked"] = _mask_account(r["account_number"])
            del r["account_number"]
    return {
        "withdrawals": rows,
        "balances": {
            "wallet_zar": float(current_user.get("wallet_balance") or 0),
            "promotion_zar": float(current_user.get("promotion_zar_balance") or 0),
        },
        "eligibility": {
            "min_score_required": WITHDRAW_MIN_SCORE,
            "your_network_score": int(current_user.get("network_score") or 0),
            "your_monthly_score": int(current_user.get("monthly_score") or 0),
            "eligible": max(int(current_user.get("network_score") or 0), int(current_user.get("monthly_score") or 0)) >= WITHDRAW_MIN_SCORE,
        },
        "processing_window_hours": "24-48",
    }


@api_router.get("/withdrawals/me/{withdrawal_id}/proof")
async def my_withdrawal_proof(withdrawal_id: str, current_user: dict = Depends(get_current_user)):
    w = await db.withdrawals.find_one({"id": withdrawal_id, "user_id": current_user["id"]}, {"_id": 0, "proof_data_url": 1})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    return {"proof_data_url": w.get("proof_data_url", "")}


# ---- ADMIN: review withdrawals --------------------------------------------
@api_router.get("/admin/withdrawals")
async def admin_list_withdrawals(status_filter: Optional[str] = None, q: Optional[str] = None, admin: dict = Depends(require_admin_user)):
    query: Dict[str, Any] = {}
    if status_filter and status_filter != "all":
        query["status"] = status_filter
    if q and q.strip():
        rx = {"$regex": q.strip(), "$options": "i"}
        query["$or"] = [{"username": rx}, {"user_email": rx}, {"full_name": rx}, {"bank_name": rx}]
    rows = await db.withdrawals.find(query, {"_id": 0, "proof_data_url": 0}).sort("created_at", -1).limit(500).to_list(length=None)
    pending = await db.withdrawals.count_documents({"status": "pending"})
    approved = await db.withdrawals.count_documents({"status": "approved"})
    paid = await db.withdrawals.count_documents({"status": "paid"})
    rejected = await db.withdrawals.count_documents({"status": "rejected"})
    total_amount = 0.0
    async for r in db.withdrawals.find({"status": {"$in": ["pending", "approved"]}}, {"_id": 0, "amount_zar": 1}):
        total_amount += float(r.get("amount_zar") or 0)
    return {
        "withdrawals": rows,
        "summary": {
            "pending": pending, "approved": approved, "paid": paid, "rejected": rejected,
            "pending_plus_approved_zar": round(total_amount, 2),
        },
    }


@api_router.get("/admin/withdrawals/{withdrawal_id}")
async def admin_get_withdrawal(withdrawal_id: str, admin: dict = Depends(require_admin_user)):
    w = await db.withdrawals.find_one({"id": withdrawal_id}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    return w


class WithdrawalActionIn(BaseModel):
    note: Optional[str] = ""


async def _push_withdrawal_note(wid: str, admin: dict, action: str, note: str) -> None:
    await db.withdrawals.update_one(
        {"id": wid},
        {"$push": {"admin_notes": {
            "by": admin.get("username") or admin.get("id"),
            "action": action,
            "note": note or "",
            "at": datetime.now(timezone.utc).isoformat(),
        }}},
    )


async def _notify_user_withdrawal(user_id: str, title: str, message: str, withdrawal_id: str) -> None:
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "withdrawal",
        "title": title,
        "message": message,
        "withdrawal_id": withdrawal_id,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


@api_router.post("/admin/withdrawals/{withdrawal_id}/approve")
async def admin_approve_withdrawal(withdrawal_id: str, payload: WithdrawalActionIn, admin: dict = Depends(require_admin_user)):
    if _is_june_payout_locked():
        raise HTTPException(status_code=403, detail=_june_payout_message())
    w = await db.withdrawals.find_one({"id": withdrawal_id})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if w["status"] not in ("pending",):
        raise HTTPException(status_code=400, detail=f"Cannot approve a withdrawal in '{w['status']}' state")
    now = datetime.now(timezone.utc).isoformat()
    await db.withdrawals.update_one({"id": withdrawal_id}, {"$set": {"status": "approved", "approved_at": now, "updated_at": now}})
    await _push_withdrawal_note(withdrawal_id, admin, "approve", payload.note or "")
    await _notify_user_withdrawal(w["user_id"], "Withdrawal approved", f"Your R{w['amount_zar']:.2f} withdrawal request was approved. Funds typically arrive within 24-48 hours.", withdrawal_id)
    return {"ok": True, "status": "approved"}


@api_router.post("/admin/withdrawals/{withdrawal_id}/reject")
async def admin_reject_withdrawal(withdrawal_id: str, payload: WithdrawalActionIn, admin: dict = Depends(require_admin_user)):
    w = await db.withdrawals.find_one({"id": withdrawal_id})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if w["status"] in ("paid", "rejected"):
        raise HTTPException(status_code=400, detail=f"Cannot reject a withdrawal in '{w['status']}' state")
    # Refund — return the reserved amount to the user's source balance
    bal_field = "wallet_balance" if w["source"] == "wallet" else "promotion_zar_balance"
    await db.users.update_one({"id": w["user_id"]}, {"$inc": {bal_field: float(w["amount_zar"])}})
    now = datetime.now(timezone.utc).isoformat()
    await db.withdrawals.update_one({"id": withdrawal_id}, {"$set": {"status": "rejected", "rejected_at": now, "updated_at": now}})
    await _push_withdrawal_note(withdrawal_id, admin, "reject", payload.note or "")
    reason = (payload.note or "").strip()
    msg = f"Your R{w['amount_zar']:.2f} withdrawal request was rejected and funds returned to your {w['source']} balance."
    if reason:
        msg += f" Reason: {reason}"
    await _notify_user_withdrawal(w["user_id"], "Withdrawal rejected", msg, withdrawal_id)
    return {"ok": True, "status": "rejected"}


@api_router.post("/admin/withdrawals/{withdrawal_id}/mark-paid")
async def admin_mark_paid(withdrawal_id: str, payload: WithdrawalActionIn, admin: dict = Depends(require_admin_user)):
    if _is_june_payout_locked():
        raise HTTPException(status_code=403, detail=_june_payout_message())
    w = await db.withdrawals.find_one({"id": withdrawal_id})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if w["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved withdrawals can be marked as paid")
    now = datetime.now(timezone.utc).isoformat()
    await db.withdrawals.update_one({"id": withdrawal_id}, {"$set": {"status": "paid", "paid_at": now, "updated_at": now}})
    await _push_withdrawal_note(withdrawal_id, admin, "paid", payload.note or "")
    await _notify_user_withdrawal(w["user_id"], "Withdrawal paid", f"Your R{w['amount_zar']:.2f} has been sent to your bank account.", withdrawal_id)
    return {"ok": True, "status": "paid"}


class AdminNoteIn(BaseModel):
    note: str = Field(min_length=1, max_length=1000)


@api_router.post("/admin/withdrawals/{withdrawal_id}/note")
async def admin_add_withdrawal_note(withdrawal_id: str, payload: AdminNoteIn, admin: dict = Depends(require_admin_user)):
    w = await db.withdrawals.find_one({"id": withdrawal_id}, {"_id": 0, "id": 1})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    await _push_withdrawal_note(withdrawal_id, admin, "note", payload.note)
    return {"ok": True}


@api_router.get("/admin/withdrawals/{withdrawal_id}/proof")
async def admin_get_withdrawal_proof(withdrawal_id: str, admin: dict = Depends(require_admin_user)):
    w = await db.withdrawals.find_one({"id": withdrawal_id}, {"_id": 0, "proof_data_url": 1})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    return {"proof_data_url": w.get("proof_data_url", "")}


# ============================================================================
# ITER 41 — AD CAMPAIGNS (admin-managed) + AMBASSADOR APPLICATIONS
# ============================================================================
class AdCampaignIn(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    body: str = Field(min_length=2, max_length=600)
    cta_label: str = Field(min_length=1, max_length=40)
    link_url: str = Field(min_length=4, max_length=500)
    image_data_url: Optional[str] = ""
    video_data_url: Optional[str] = ""
    starts_at: Optional[str] = ""           # ISO date or empty for "starts now"
    ends_at: Optional[str] = ""             # ISO date or empty for "no end"
    is_active: bool = True
    reward_engage_points: int = 500
    reward_share_points: int = 100


def _ad_window_active(ad: Dict[str, Any], now_utc: datetime) -> bool:
    if not ad.get("is_active"):
        return False
    sa, ea = ad.get("starts_at"), ad.get("ends_at")
    if sa:
        try:
            if now_utc < datetime.fromisoformat(sa.replace("Z", "+00:00")):
                return False
        except Exception:
            pass
    if ea:
        try:
            if now_utc > datetime.fromisoformat(ea.replace("Z", "+00:00")):
                return False
        except Exception:
            pass
    return True


@api_router.post("/admin/ads")
async def admin_create_ad(payload: AdCampaignIn, admin: dict = Depends(require_admin_user)):
    if payload.image_data_url and len(payload.image_data_url) > MAX_MEDIA_BYTES * 1.4:
        raise HTTPException(status_code=413, detail="Image too large (max 11MB)")
    if payload.video_data_url and len(payload.video_data_url) > MAX_MEDIA_BYTES * 1.4:
        raise HTTPException(status_code=413, detail="Video too large (max 11MB)")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        **payload.dict(),
        "created_by": admin["id"],
        "created_at": now,
        "updated_at": now,
        "impressions": 0,
        "clicks": 0,
        "engagements": 0,
        "shares": 0,
    }
    await db.ad_campaigns.insert_one(doc)
    # Pop the mongo-added _id so the response is JSON-serialisable.
    doc.pop("_id", None)
    return {k: v for k, v in doc.items() if k not in ("image_data_url", "video_data_url")}


@api_router.get("/admin/ads")
async def admin_list_ads(admin: dict = Depends(require_admin_user)):
    rows = await db.ad_campaigns.find({}, {"_id": 0, "image_data_url": 0, "video_data_url": 0}).sort("created_at", -1).limit(200).to_list(length=None)
    total_impressions = sum(r.get("impressions", 0) for r in rows)
    total_clicks = sum(r.get("clicks", 0) for r in rows)
    return {
        "ads": rows,
        "summary": {
            "total_campaigns": len(rows),
            "active_campaigns": sum(1 for r in rows if r.get("is_active")),
            "total_impressions": total_impressions,
            "total_clicks": total_clicks,
            "ctr_pct": round((total_clicks / total_impressions * 100), 2) if total_impressions else 0.0,
        },
    }


@api_router.get("/admin/ads/{ad_id}")
async def admin_get_ad(ad_id: str, admin: dict = Depends(require_admin_user)):
    ad = await db.ad_campaigns.find_one({"id": ad_id}, {"_id": 0})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    return ad


@api_router.patch("/admin/ads/{ad_id}")
async def admin_update_ad(ad_id: str, payload: AdCampaignIn, admin: dict = Depends(require_admin_user)):
    res = await db.ad_campaigns.update_one(
        {"id": ad_id},
        {"$set": {**payload.dict(), "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"ok": True}


@api_router.delete("/admin/ads/{ad_id}")
async def admin_delete_ad(ad_id: str, admin: dict = Depends(require_admin_user)):
    await db.ad_campaigns.delete_one({"id": ad_id})
    await db.ad_events.delete_many({"ad_id": ad_id})
    return {"ok": True}


@api_router.get("/admin/ads/{ad_id}/analytics")
async def admin_ad_analytics(ad_id: str, days: int = 30, admin: dict = Depends(require_admin_user)):
    ad = await db.ad_campaigns.find_one({"id": ad_id}, {"_id": 0, "image_data_url": 0, "video_data_url": 0})
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    days = max(1, min(int(days or 30), 90))
    # By-day chart
    pipeline_daily = [
        {"$match": {"ad_id": ad_id}},
        {"$group": {
            "_id": {"day": "$day_key", "type": "$type"},
            "n": {"$sum": 1},
        }},
        {"$sort": {"_id.day": 1}},
    ]
    raw = await db.ad_events.aggregate(pipeline_daily).to_list(length=None)
    by_day: Dict[str, Dict[str, int]] = {}
    for row in raw:
        d = row["_id"]["day"]
        t = row["_id"]["type"]
        by_day.setdefault(d, {"impressions": 0, "clicks": 0, "engagements": 0, "shares": 0})
        if t in by_day[d]:
            by_day[d][t] = row["n"]
    daily = [{"day": d, **by_day[d]} for d in sorted(by_day.keys())[-days:]]

    # Unique users (overall)
    unique_users = len(await db.ad_events.distinct("user_id", {"ad_id": ad_id}))
    unique_clickers = len(await db.ad_events.distinct("user_id", {"ad_id": ad_id, "type": "clicks"}))

    # Geo breakdown (country / city)
    geo_pipeline = [
        {"$match": {"ad_id": ad_id, "type": "impressions"}},
        {"$group": {"_id": {"country": "$country", "city": "$city"}, "n": {"$sum": 1}}},
        {"$sort": {"n": -1}},
        {"$limit": 20},
    ]
    geo_rows = await db.ad_events.aggregate(geo_pipeline).to_list(length=None)
    geo = [{"country": (g["_id"] or {}).get("country") or "Unknown",
            "city": (g["_id"] or {}).get("city") or "Unknown",
            "impressions": g["n"]} for g in geo_rows]

    # Age bucket breakdown (derived from birth_month — we only have month, so use as a rough cohort)
    age_pipeline = [
        {"$match": {"ad_id": ad_id, "type": "impressions"}},
        {"$group": {"_id": "$birth_month", "n": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    age_rows = await db.ad_events.aggregate(age_pipeline).to_list(length=None)
    age = [{"birth_month": a["_id"], "impressions": a["n"]} for a in age_rows]

    return {
        "ad": ad,
        "totals": {
            "impressions": ad.get("impressions", 0),
            "clicks": ad.get("clicks", 0),
            "engagements": ad.get("engagements", 0),
            "shares": ad.get("shares", 0),
            "unique_viewers": unique_users,
            "unique_clickers": unique_clickers,
            "ctr_pct": round((ad.get("clicks", 0) / ad.get("impressions", 1) * 100), 2) if ad.get("impressions") else 0.0,
        },
        "daily": daily,
        "geo": geo,
        "age": age,
    }


# ---- User-facing: serve the currently active ad ----------------------------
@api_router.get("/ads/current")
async def get_current_ad(current_user: dict = Depends(get_current_user)):
    """Return the most-recent active ad campaign whose schedule window includes 'now'.
    Falls back to the legacy mock ad copy if none configured."""
    now_utc = datetime.now(timezone.utc)
    rows = await db.ad_campaigns.find({"is_active": True}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(length=None)
    for ad in rows:
        if _ad_window_active(ad, now_utc):
            return {
                "id": ad["id"],
                "title": ad["title"],
                "body": ad["body"],
                "cta_label": ad["cta_label"],
                "link_url": ad["link_url"],
                "image_data_url": ad.get("image_data_url") or "",
                "video_data_url": ad.get("video_data_url") or "",
                "reward_engage_points": ad.get("reward_engage_points", 500),
                "reward_share_points": ad.get("reward_share_points", 100),
                "is_real": True,
            }
    # No live ads → caller may render legacy mock copy
    return {"id": None, "is_real": False}


class AdEventIn(BaseModel):
    ad_id: str
    type: str = Field(pattern="^(impressions|clicks|engagements|shares)$")


@api_router.post("/ads/event")
async def record_ad_event(payload: AdEventIn, current_user: dict = Depends(get_current_user)):
    """Log impression / click / engagement / share for analytics."""
    ad = await db.ad_campaigns.find_one({"id": payload.ad_id}, {"_id": 0, "id": 1})
    if not ad:
        # silently ignore — keeps client robust to deleted campaigns
        return {"ok": True}
    now_utc = datetime.now(timezone.utc)
    await db.ad_events.insert_one({
        "id": str(uuid.uuid4()),
        "ad_id": payload.ad_id,
        "user_id": current_user["id"],
        "username": current_user.get("username"),
        "country": current_user.get("country") or "",
        "city": current_user.get("city") or "",
        "birth_month": current_user.get("birth_month"),
        "type": payload.type,
        "created_at": now_utc.isoformat(),
        "day_key": now_utc.strftime("%Y-%m-%d"),
    })
    await db.ad_campaigns.update_one({"id": payload.ad_id}, {"$inc": {payload.type: 1}})
    return {"ok": True}


# ============================================================================
# AMBASSADOR APPLICATIONS — user can self-request, admin approves/rejects
# ============================================================================
AMBASSADOR_MIN_SCORE = 2000


class AmbassadorApplicationIn(BaseModel):
    why: str = Field(min_length=20, max_length=1500)
    links: Optional[List[str]] = []


@api_router.post("/ambassadors/apply")
async def apply_to_be_ambassador(payload: AmbassadorApplicationIn, current_user: dict = Depends(get_current_user)):
    if current_user.get("is_ambassador"):
        raise HTTPException(status_code=400, detail="You are already an ambassador.")
    score = max(int(current_user.get("network_score") or 0), int(current_user.get("monthly_score") or 0))
    if score < AMBASSADOR_MIN_SCORE:
        raise HTTPException(
            status_code=403,
            detail=f"You need a Network Score of {AMBASSADOR_MIN_SCORE} to apply. Yours is currently {score}. Keep contributing — posts, referrals, place reviews and connections all build your score.",
        )
    existing = await db.ambassador_applications.find_one(
        {"user_id": current_user["id"], "status": "pending"},
        {"_id": 0, "id": 1},
    )
    if existing:
        raise HTTPException(status_code=400, detail="You already have a pending application. We'll review it shortly.")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user.get("username"),
        "user_email": current_user.get("email"),
        "full_name": current_user.get("full_name"),
        "photo": current_user.get("photo") or "",
        "network_score": int(current_user.get("network_score") or 0),
        "monthly_score": int(current_user.get("monthly_score") or 0),
        "why": payload.why.strip(),
        "links": [str(l).strip() for l in (payload.links or []) if str(l).strip()][:6],
        "status": "pending",
        "created_at": now,
        "updated_at": now,
        "decided_by": None,
        "decided_at": None,
        "admin_note": "",
    }
    await db.ambassador_applications.insert_one(doc)
    # notify admins
    admin_ids = [u["id"] async for u in db.users.find({"role": {"$in": ["admin", "moderator"]}}, {"_id": 0, "id": 1})]
    if admin_ids:
        await db.notifications.insert_many([{
            "id": str(uuid.uuid4()),
            "user_id": uid,
            "type": "ambassador_application",
            "title": "New ambassador application",
            "message": f"@{current_user.get('username') or 'user'} applied to become an ambassador.",
            "application_id": doc["id"],
            "read": False,
            "created_at": now,
        } for uid in admin_ids])
    return {"ok": True, "id": doc["id"], "status": "pending"}


@api_router.get("/ambassadors/me/application")
async def my_ambassador_application(current_user: dict = Depends(get_current_user)):
    score = max(int(current_user.get("network_score") or 0), int(current_user.get("monthly_score") or 0))
    latest = await db.ambassador_applications.find_one(
        {"user_id": current_user["id"]},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return {
        "is_ambassador": bool(current_user.get("is_ambassador")),
        "score": score,
        "min_score_required": AMBASSADOR_MIN_SCORE,
        "eligible": score >= AMBASSADOR_MIN_SCORE,
        "application": latest,
    }


@api_router.get("/admin/ambassador-applications")
async def admin_list_ambassador_applications(status_filter: Optional[str] = "pending", admin: dict = Depends(require_admin_user)):
    q: Dict[str, Any] = {}
    if status_filter and status_filter != "all":
        q["status"] = status_filter
    rows = await db.ambassador_applications.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=None)
    summary = {
        "pending": await db.ambassador_applications.count_documents({"status": "pending"}),
        "approved": await db.ambassador_applications.count_documents({"status": "approved"}),
        "rejected": await db.ambassador_applications.count_documents({"status": "rejected"}),
    }
    return {"applications": rows, "summary": summary}


class AmbassadorDecisionIn(BaseModel):
    note: Optional[str] = ""


@api_router.post("/admin/ambassador-applications/{application_id}/approve")
async def admin_approve_ambassador(application_id: str, payload: AmbassadorDecisionIn, admin: dict = Depends(require_admin_user)):
    app_row = await db.ambassador_applications.find_one({"id": application_id})
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_row["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Application is already '{app_row['status']}'")
    now = datetime.now(timezone.utc).isoformat()
    await db.ambassador_applications.update_one(
        {"id": application_id},
        {"$set": {"status": "approved", "decided_by": admin.get("username") or admin["id"],
                  "decided_at": now, "admin_note": payload.note or "", "updated_at": now}},
    )
    target_user = await db.users.find_one(
        {"id": app_row["user_id"]},
        {"_id": 0, "id": 1, "email": 1, "is_ambassador": 1, "role": 1, "full_name": 1, "username": 1, "email_verified": 1},
    )
    was_amb = bool((target_user or {}).get("is_ambassador"))
    await db.users.update_one(
        {"id": app_row["user_id"]},
        {"$set": {"is_ambassador": True, "ambassador_rank": "Rising Star",
                  "ambassador_granted_at": now}},
    )
    # Fire role-change email + notification (skip if they were already an ambassador).
    if target_user and not was_amb:
        try:
            await _notify_role_change(
                user=target_user,
                previous_role=(target_user.get("role") or "user"),
                new_role="ambassador",
                actor_username=admin.get("username") or "admin",
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(f"[ROLE-EMAIL-FAIL] ambassador-approve user={app_row['user_id']} err={exc}")
    try:
        await AuditLog.write(
            actor_id=admin["id"], actor_username=admin.get("username") or "admin",
            action="ambassador.approve", target_type="user", target_id=app_row["user_id"],
            reason=payload.note or "approved", metadata={"application_id": application_id},
        )
    except Exception:
        pass
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": app_row["user_id"],
        "type": "ambassador_application",
        "title": "You're an Ambassador!",
        "message": "Congratulations — your ambassador application was approved. The ★ Ambassador badge is now active on your profile.",
        "application_id": application_id,
        "read": False,
        "created_at": now,
    })
    return {"ok": True, "status": "approved"}


@api_router.post("/admin/ambassador-applications/{application_id}/reject")
async def admin_reject_ambassador(application_id: str, payload: AmbassadorDecisionIn, admin: dict = Depends(require_admin_user)):
    app_row = await db.ambassador_applications.find_one({"id": application_id})
    if not app_row:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_row["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Application is already '{app_row['status']}'")
    now = datetime.now(timezone.utc).isoformat()
    await db.ambassador_applications.update_one(
        {"id": application_id},
        {"$set": {"status": "rejected", "decided_by": admin.get("username") or admin["id"],
                  "decided_at": now, "admin_note": payload.note or "", "updated_at": now}},
    )
    msg = "Your ambassador application was not approved this time. Keep growing your network — you can re-apply once you've added more contributions."
    if payload.note and payload.note.strip():
        msg += f" Reviewer note: {payload.note.strip()}"
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": app_row["user_id"],
        "type": "ambassador_application",
        "title": "Ambassador application reviewed",
        "message": msg,
        "application_id": application_id,
        "read": False,
        "created_at": now,
    })
    return {"ok": True, "status": "rejected"}


# Re-register router so all routes added above are picked up (must come AFTER the
# pre-existing seed `app.include_router(api_router)` block immediately below this).
app.include_router(api_router)
