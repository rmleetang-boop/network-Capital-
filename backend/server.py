from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Header
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

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    profession: Optional[str] = None
    interests: Optional[List[str]] = None

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

async def update_user_score(user_id: str, points: int, notification_msg: str):
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        return
    
    new_score = user.get("network_score", 0) + points
    new_rank = calculate_rank(new_score)
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"network_score": new_score, "rank": new_rank}}
    )
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": "score_increase",
        "message": notification_msg,
        "points": points,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)

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
        "likes": [],
        "comments": [],
        "shares": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.posts.insert_one(post_data)
    await update_user_score(current_user["id"], 10, "Posted new content +10")
    
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
            await update_user_score(post["user_id"], 2, f"{current_user['username']} liked your post +2")
        
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
        await update_user_score(post["user_id"], 5, f"{current_user['username']} commented on your post +5")
    
    return comment

@api_router.post("/posts/{post_id}/share")
async def share_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    shares = post.get("shares", 0) + 1
    await db.posts.update_one({"id": post_id}, {"$set": {"shares": shares}})
    
    if post["user_id"] != current_user["id"]:
        await update_user_score(post["user_id"], 8, f"{current_user['username']} shared your post +8")
    
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