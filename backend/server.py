from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
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

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    profession: Optional[str] = None
    interests: Optional[List[str]] = None
    currency: Optional[str] = None

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
    created_at: str

class CreatePostRequest(BaseModel):
    content: str
    image: Optional[str] = None
    video: Optional[str] = None

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
    type: str
    amount: float
    description: str
    status: str
    created_at: str

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

class CreateStokvelRequest(BaseModel):
    name: str
    description: str
    target_amount: float
    payout_cycle: str

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
    if score < 500:
        return "Rising Star"
    elif score < 2000:
        return "Influencer"
    else:
        return "Builder"

async def update_user_score(user_id: str, points: int, notification_msg: str, action: str = "legacy", source_id: Optional[str] = None):
    """Award points using new monthly-cap + premium-2x system. Backwards compatible."""
    await award_points(user_id, action, points, source_id=source_id, message=notification_msg)


# ============== NEW NETWORK SCORE SYSTEM ==============

MONTHLY_SCORE_CAP = 10000
PREMIUM_TOP_GRACE_DAYS = 90  # 3 months for premium users at cap

def _month_key(dt: Optional[datetime] = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return dt.strftime("%Y-%m")

def _date_key(dt: Optional[datetime] = None) -> str:
    dt = dt or datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%d")

async def _ensure_month_state(user: dict) -> dict:
    """If the calendar month has rolled over since user's last activity, reset monthly_score
    (preserving 3-month grace at top score for premium accounts that hit the cap)."""
    cur_key = _month_key()
    if user.get("month_key") == cur_key:
        return user

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
    else:
        new_state["monthly_score"] = 0
        new_state["cap_reached_at"] = None

    await db.users.update_one({"id": user["id"]}, {"$set": new_state})
    user.update(new_state)
    return user

async def award_points(user_id: str, action: str, base_points: int, source_id: Optional[str] = None, message: Optional[str] = None) -> int:
    """Awards points with: monthly cap (10K), premium 2× multiplier, event log."""
    user = await db.users.find_one({"id": user_id})
    if not user:
        return 0

    user = await _ensure_month_state(user)

    current_monthly = user.get("monthly_score", 0)
    if current_monthly >= MONTHLY_SCORE_CAP:
        return 0

    multiplier = 2 if user.get("premium_unlocked") else 1
    awarded = base_points * multiplier
    awarded = min(awarded, MONTHLY_SCORE_CAP - current_monthly)
    if awarded <= 0:
        return 0

    new_monthly = current_monthly + awarded
    new_lifetime = user.get("network_score", 0) + awarded

    update = {
        "monthly_score": new_monthly,
        "network_score": new_lifetime,
        "rank": calculate_rank(new_lifetime),
    }
    if new_monthly >= MONTHLY_SCORE_CAP and not user.get("cap_reached_at"):
        update["cap_reached_at"] = datetime.now(timezone.utc).isoformat()

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
    return awarded

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
    
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
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
    """MOCK ad reward. with_engagement=True (product/service conversion) → 500 pts.
    with_share=True only → 100 pts. Otherwise → 0."""
    if payload.with_engagement:
        action, base = "ad_engagement", 500
    elif payload.with_share:
        action, base = "ad_share", 100
    else:
        return {"points": 0, "reason": "Watch fully + share or engage to earn points"}

    awarded = await award_points(
        current_user["id"], action, base,
        source_id=payload.ad_id,
        message=f"Watched ad + {'engagement' if payload.with_engagement else 'share'} +{base}"
    )
    return {"points": awarded, "action": action, "mocked": True}


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
        "premium_multiplier_active": bool(user.get("premium_unlocked")),
        "premium_grace": premium_grace,
        "can_claim_premium": can_claim_premium,
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
    if len(payload.media_url) > 4 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Story too large (max ~3MB)")
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
    await award_points(current_user["id"], "story", 5, source_id=story["id"], message="Posted a story +5")
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

@api_router.get("/hubs/cities")
async def list_cities():
    """Curated SA city list + auto-discovered cities from existing users."""
    curated = [
        {"value": "johannesburg", "label": "Johannesburg"},
        {"value": "cape_town", "label": "Cape Town"},
        {"value": "durban", "label": "Durban"},
        {"value": "pretoria", "label": "Pretoria"},
        {"value": "port_elizabeth", "label": "Port Elizabeth"},
        {"value": "bloemfontein", "label": "Bloemfontein"},
        {"value": "east_london", "label": "East London"},
        {"value": "polokwane", "label": "Polokwane"},
        {"value": "nelspruit", "label": "Nelspruit"},
        {"value": "kimberley", "label": "Kimberley"},
        {"value": "other", "label": "Other"},
    ]
    # Stats per city (count of users)
    pipeline = [
        {"$match": {"city": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
    ]
    counts_raw = await db.users.aggregate(pipeline).to_list(100)
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

@api_router.post("/connections/request")
async def send_connection_request(payload: ConnectionRequestPayload, current_user: dict = Depends(get_current_user)):
    if payload.type not in ["social", "financial", "professional"]:
        raise HTTPException(status_code=400, detail="Invalid connection type")
    if payload.to_user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot connect with yourself")
    target = await db.users.find_one({"id": payload.to_user_id}, {"_id": 0, "id": 1, "username": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    # Idempotency: only one pending request per (pair, type)
    existing = await db.connections.find_one({
        "from_user_id": current_user["id"],
        "to_user_id": payload.to_user_id,
        "type": payload.type,
    })
    if existing and existing.get("status") in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail=f"Already {existing['status']}")
    conn_id = str(uuid.uuid4())
    conn = {
        "id": conn_id,
        "from_user_id": current_user["id"],
        "from_username": current_user["username"],
        "from_photo": current_user.get("photo", ""),
        "to_user_id": payload.to_user_id,
        "to_username": target["username"],
        "type": payload.type,
        "status": "pending",
        "message": payload.message or "",
        "stokvel_id": payload.stokvel_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "responded_at": None,
    }
    await db.connections.insert_one(conn)
    if "_id" in conn:
        del conn["_id"]
    return {"connection": conn}

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

@api_router.post("/connections/{connection_id}/accept")
async def accept_connection(connection_id: str, current_user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": connection_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Request not found")
    if conn["to_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    if conn["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Already {conn['status']}")
    await db.connections.update_one(
        {"id": connection_id},
        {"$set": {"status": "accepted", "responded_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Connection accepted"}

@api_router.post("/connections/{connection_id}/reject")
async def reject_connection(connection_id: str, current_user: dict = Depends(get_current_user)):
    conn = await db.connections.find_one({"id": connection_id})
    if not conn:
        raise HTTPException(status_code=404, detail="Request not found")
    if conn["to_user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.connections.update_one(
        {"id": connection_id},
        {"$set": {"status": "rejected", "responded_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Connection declined"}


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



MAX_MEDIA_BYTES = 3 * 1024 * 1024  # ~3MB after base64 ≈ ~2.2MB raw

def _validate_media_size(data_url: str):
    if not data_url or not isinstance(data_url, str):
        raise HTTPException(status_code=400, detail="data_url required")
    # Rough size guard (base64 length ~ 1.37x raw bytes)
    if len(data_url) > MAX_MEDIA_BYTES * 1.4:
        raise HTTPException(status_code=413, detail="File too large (max ~3MB)")

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
    post_id = str(uuid.uuid4())
    post_data = {
        "id": post_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_photo": current_user["photo"],
        "user_score": current_user["network_score"],
        "content": request.content,
        "image": request.image,
        "video": request.video,
        "hashtags": extract_hashtags(request.content),
        "mentions": extract_mentions(request.content),
        "likes": [],
        "comments": [],
        "shares": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.posts.insert_one(post_data)
    await award_points(current_user["id"], "post", 20, source_id=post_data["id"], message="Posted new content +20")
    
    return post_data

@api_router.get("/posts", response_model=List[Post])
async def get_posts(skip: int = 0, limit: int = 20):
    posts = await db.posts.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
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
        return {"liked": False, "likes_count": len(likes)}
    else:
        likes.append(current_user["id"])
        await db.posts.update_one({"id": post_id}, {"$set": {"likes": likes}})

        if post["user_id"] != current_user["id"]:
            # Track lifetime likes received and award 10 pts every 50 likes
            owner = await db.users.find_one({"id": post["user_id"]}, {"_id": 0})
            if owner:
                prev = owner.get("likes_received_count", 0)
                new_count = prev + 1
                await db.users.update_one(
                    {"id": post["user_id"]},
                    {"$set": {"likes_received_count": new_count}}
                )
                if new_count // 50 > prev // 50:
                    await award_points(
                        post["user_id"], "like_milestone", 10,
                        source_id=post_id,
                        message=f"You hit {new_count} likes received +10"
                    )

        return {"liked": True, "likes_count": len(likes)}

@api_router.post("/posts/{post_id}/comment")
async def comment_post(post_id: str, request: CommentRequest, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["id"],
        "username": current_user["username"],
        "user_photo": current_user["photo"],
        "content": request.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    comments = post.get("comments", [])
    comments.append(comment)
    await db.posts.update_one({"id": post_id}, {"$set": {"comments": comments}})
    
    if post["user_id"] != current_user["id"]:
        await award_points(post["user_id"], "comment_received", 2, source_id=post_id,
                           message=f"{current_user['username']} commented on your post +2")
    # Award 20 pts to commenter once they've left 10 cumulative comments (10 comments = 20pts/spec)
    prev_comments = current_user.get("comments_given_count", 0)
    new_comments = prev_comments + 1
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"comments_given_count": new_comments}})
    if new_comments // 10 > prev_comments // 10:
        await award_points(current_user["id"], "comment_milestone", 20,
                           message=f"You hit {new_comments} comments +20")

    return comment

@api_router.post("/posts/{post_id}/share")
async def share_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    shares = post.get("shares", 0) + 1
    await db.posts.update_one({"id": post_id}, {"$set": {"shares": shares}})
    
    if post["user_id"] != current_user["id"]:
        await award_points(post["user_id"], "share_received", 5, source_id=post_id,
                           message=f"{current_user['username']} shared your post +5")
    # Award the sharer per spec: 10 pts per share
    await award_points(current_user["id"], "share", 10, source_id=post_id, message="You shared a post +10")

    return {"shares": shares}

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
    await update_user_score(referrer["id"], 200, f"{current_user['username']} joined using your referral +200")
    
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
@api_router.get("/wallet", response_model=WalletBalance)
async def get_wallet(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {
        "balance": user.get("wallet_balance", 0.0),
        "total_earned": user.get("total_earned", 0.0),
        "total_spent": user.get("total_spent", 0.0),
        "pending": 0.0
    }

@api_router.post("/wallet/deposit")
async def deposit_funds(request: DepositRequest, current_user: dict = Depends(get_current_user)):
    require_premium(current_user)
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "user_id": current_user["id"],
        "type": "deposit",
        "amount": request.amount,
        "description": "Wallet deposit",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {
            "$inc": {
                "wallet_balance": request.amount,
                "total_earned": request.amount
            }
        }
    )
    
    return {"message": "Deposit successful", "new_balance": (current_user.get("wallet_balance", 0) + request.amount)}

@api_router.get("/wallet/transactions", response_model=List[Transaction])
async def get_transactions(current_user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return transactions

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
    
    stokvel_data = {
        "id": stokvel_id,
        "name": request.name,
        "description": request.description,
        "created_by": current_user["id"],
        "creator_name": current_user["username"],
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
    stokvel = await db.stokvels.find_one({"id": stokvel_id}, {"_id": 0})
    if not stokvel:
        raise HTTPException(status_code=404, detail="Stokvel not found")
    
    if stokvel["created_by"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Only creator can invite members")
    
    user = await db.users.find_one({"id": request.user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_already_member = any(m["user_id"] == request.user_id for m in stokvel["members"])
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
        request.user_id,
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
    
    await update_user_score(user["id"], 20, f"Joined Stokvel+: {stokvel['name']} +20")
    
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
        "approved_at": None
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
        "referral_code": user_id[:8],
        "referred_by": None,
        "achievements": [],
        "terms_accepted": False,
        "terms_accepted_at": None
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
        "message": "Account created. Please complete your profile."
    }

@api_router.post("/auth/complete-profile")
async def complete_profile(request: CompleteProfileRequest, current_user: dict = Depends(get_current_user)):
    """Step 2: Complete profile and select intent"""
    # Check username availability
    existing = await db.users.find_one({"username": request.username, "id": {"$ne": current_user["id"]}})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    update_data = {
        "full_name": request.full_name,
        "username": request.username,
        "bio": request.bio or "",
        "user_type": request.intent,
        "is_creator": request.intent == "creator",
        "profile_completed": True,
        "onboarding_step": 3 if request.intent == "creator" else 0,  # Creator goes to product creation
        "terms_accepted": request.terms_accepted,
        "terms_accepted_at": datetime.now(timezone.utc).isoformat() if request.terms_accepted else None
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": update_data}
    )
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password": 0})
    
    return {
        "user": updated_user,
        "next_step": 3 if request.intent == "creator" else 0,
        "message": "Profile completed" if request.intent != "creator" else "Profile completed. Create your first product."
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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()