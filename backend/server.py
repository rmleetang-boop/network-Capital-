from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    photo: Optional[str] = None

class Post(BaseModel):
    id: str
    user_id: str
    username: str
    user_photo: str
    user_score: int
    content: str
    image: Optional[str] = None
    likes: List[str] = []
    comments: List[Dict[str, Any]] = []
    shares: int = 0
    created_at: str

class CreatePostRequest(BaseModel):
    content: str
    image: Optional[str] = None

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
    activation_fee_paid: bool
    members_fees_paid: Dict[str, bool]

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
    
    user_data = {
        "id": user_id,
        "email": request.email,
        "password": hashed_password,
        "username": request.username,
        "bio": request.bio,
        "photo": request.photo,
        "network_score": 0,
        "rank": "Rising Star",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "referral_code": user_id[:8],
        "referred_by": None,
        "achievements": [],
        "wallet_balance": 0.0,
        "total_earned": 0.0,
        "total_spent": 0.0
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
        "total_contributions": len(await db.contributions.find({"stokvel_id": stokvel_id}).to_list(1000)),
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