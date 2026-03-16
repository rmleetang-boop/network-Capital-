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
        "achievements": []
    }
    
    await db.users.insert_one(user_data)
    
    token = create_access_token({"sub": user_id})
    user_data_copy = user_data.copy()
    user_data_copy.pop("password")
    
    return {"token": token, "user": user_data_copy}

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user or not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": user["id"]})
    user_copy = user.copy()
    user_copy.pop("password")
    
    return {"token": token, "user": user_copy}

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
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    updated_user.pop("password")
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
    posts = await db.posts.find({"user_id": current_user["id"]}, {"_id": 0}).to_list(1000)
    
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