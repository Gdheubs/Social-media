from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Query
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import time
import cloudinary
import cloudinary.utils
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Cloudinary config
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# Stripe config
stripe_api_key = os.environ.get('STRIPE_API_KEY')

app = FastAPI()
api_router = APIRouter(prefix="/api")

JWT_SECRET = os.environ.get('JWT_SECRET', 'default_secret_change_in_production')
JWT_ALGORITHM = "HS256"

# ============= MODELS =============

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    username: str
    account_type: str = "personal"  # personal, professional, business

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    account_type: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    verification_status: bool = False
    wallet_balance: float = 0.0
    total_views: int = 0
    created_at: str

class VideoUpload(BaseModel):
    cloudinary_public_id: str
    cloudinary_url: str
    aspect_ratio: str  # "9:16" or "16:9"
    title: str
    description: Optional[str] = None

class Video(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str]
    cloudinary_public_id: str
    cloudinary_url: str
    aspect_ratio: str
    title: str
    description: Optional[str]
    view_count: int
    validated_views: int
    tips_received: float
    created_at: str
    status: str

class TipRequest(BaseModel):
    video_id: str
    amount: float

class FundraiserCreate(BaseModel):
    title: str
    description: str
    goal_amount: float

class Fundraiser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    business_user_id: str
    username: str
    title: str
    description: str
    goal_amount: float
    current_amount: float
    status: str
    created_at: str

class ModerationFlag(BaseModel):
    video_id: str
    reason: str

# ============= HELPER FUNCTIONS =============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============= AUTH ROUTES =============

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password_hash": hash_password(user_data.password),
        "username": user_data.username,
        "account_type": user_data.account_type,
        "avatar": None,
        "bio": None,
        "verification_status": False,
        "wallet_balance": 0.0,
        "total_views": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id)
    
    return {
        "token": token,
        "user": User(**{k: v for k, v in user_doc.items() if k != "password_hash"})
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    user_data = {k: v for k, v in user.items() if k not in ["_id", "password_hash"]}
    
    return {
        "token": token,
        "user": User(**user_data)
    }

# ============= USER ROUTES =============

@api_router.get("/users/me")
async def get_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return User(**user)

@api_router.get("/users/{username}")
async def get_user_profile(username: str):
    user = await db.users.find_one({"username": username}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    video_count = await db.videos.count_documents({"user_id": user["id"], "status": "active"})
    
    return {
        **user,
        "video_count": video_count
    }

@api_router.put("/users/profile")
async def update_profile(avatar: Optional[str] = None, bio: Optional[str] = None, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    update_data = {}
    if avatar:
        update_data["avatar"] = avatar
    if bio:
        update_data["bio"] = bio
    
    if update_data:
        await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    
    return {"message": "Profile updated"}

# ============= CLOUDINARY ROUTES =============

@api_router.get("/cloudinary/signature")
async def generate_cloudinary_signature(
    resource_type: str = Query("video", enum=["image", "video"]),
    folder: str = "uploads",
    authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    
    ALLOWED_FOLDERS = ("users/", "posts/", "uploads/")
    if not folder.startswith(ALLOWED_FOLDERS):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    
    timestamp = int(time.time())
    params = {
        "timestamp": timestamp,
        "folder": folder,
        "resource_type": resource_type
    }
    
    signature = cloudinary.utils.api_sign_request(
        params,
        os.getenv("CLOUDINARY_API_SECRET")
    )
    
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.getenv("CLOUDINARY_API_KEY"),
        "folder": folder,
        "resource_type": resource_type
    }

# ============= VIDEO ROUTES =============

@api_router.post("/videos/upload")
async def upload_video(video_data: VideoUpload, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    video_id = str(uuid.uuid4())
    video_doc = {
        "id": video_id,
        "user_id": user["id"],
        "username": user["username"],
        "user_avatar": user.get("avatar"),
        "cloudinary_public_id": video_data.cloudinary_public_id,
        "cloudinary_url": video_data.cloudinary_url,
        "aspect_ratio": video_data.aspect_ratio,
        "title": video_data.title,
        "description": video_data.description,
        "view_count": 0,
        "validated_views": 0,
        "tips_received": 0.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.videos.insert_one(video_doc)
    return Video(**video_doc)

@api_router.get("/videos/feed")
async def get_video_feed(
    skip: int = 0,
    limit: int = 20,
    aspect_ratio: Optional[str] = None
):
    query = {"status": "active"}
    if aspect_ratio:
        query["aspect_ratio"] = aspect_ratio
    
    videos = await db.videos.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return videos

@api_router.get("/videos/{video_id}")
async def get_video(video_id: str):
    video = await db.videos.find_one({"id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@api_router.post("/videos/{video_id}/view")
async def increment_view(video_id: str):
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Increment view count
    new_view_count = video["view_count"] + 1
    new_validated_views = video["validated_views"] + 1
    
    await db.videos.update_one(
        {"id": video_id},
        {"$set": {
            "view_count": new_view_count,
            "validated_views": new_validated_views
        }}
    )
    
    # Calculate earnings ($0.50 per 1000 views)
    if new_validated_views % 1000 == 0:
        earnings = 0.50
        await db.users.update_one(
            {"id": video["user_id"]},
            {"$inc": {"wallet_balance": earnings, "total_views": 1000}}
        )
    
    return {"view_count": new_view_count}

@api_router.get("/videos/user/{username}")
async def get_user_videos(username: str, skip: int = 0, limit: int = 20):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    videos = await db.videos.find(
        {"user_id": user["id"], "status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return videos

# ============= TIP ROUTES =============

@api_router.post("/tips/initiate")
async def initiate_tip(
    tip_data: TipRequest,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    
    video = await db.videos.find_one({"id": tip_data.video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video["user_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot tip your own video")
    
    # Get origin from request
    origin = request.headers.get("origin", "")
    if not origin:
        raise HTTPException(status_code=400, detail="Origin header required")
    
    success_url = f"{origin}/tip-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/feed"
    
    # Initialize Stripe
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=tip_data.amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "tip",
            "from_user_id": user["id"],
            "to_user_id": video["user_id"],
            "video_id": tip_data.video_id
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "from_user_id": user["id"],
        "to_user_id": video["user_id"],
        "video_id": tip_data.video_id,
        "amount": tip_data.amount,
        "currency": "usd",
        "type": "tip",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_doc)
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/tips/status/{session_id}")
async def get_tip_status(session_id: str, request: Request):
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction in database
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    
    if transaction and transaction["payment_status"] != "completed" and status.payment_status == "paid":
        # Update transaction status
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "completed"}}
        )
        
        # Credit creator's wallet
        platform_fee = transaction["amount"] * 0.05  # 5% platform fee
        creator_amount = transaction["amount"] - platform_fee
        
        await db.users.update_one(
            {"id": transaction["to_user_id"]},
            {"$inc": {"wallet_balance": creator_amount}}
        )
        
        # Update video tips
        await db.videos.update_one(
            {"id": transaction["video_id"]},
            {"$inc": {"tips_received": creator_amount}}
        )
    
    return status

# ============= FUNDRAISER ROUTES =============

@api_router.post("/fundraisers/create")
async def create_fundraiser(
    fundraiser_data: FundraiserCreate,
    authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    
    if user["account_type"] != "business":
        raise HTTPException(status_code=403, detail="Only business accounts can create fundraisers")
    
    fundraiser_id = str(uuid.uuid4())
    fundraiser_doc = {
        "id": fundraiser_id,
        "business_user_id": user["id"],
        "username": user["username"],
        "title": fundraiser_data.title,
        "description": fundraiser_data.description,
        "goal_amount": fundraiser_data.goal_amount,
        "current_amount": 0.0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.fundraisers.insert_one(fundraiser_doc)
    return Fundraiser(**fundraiser_doc)

@api_router.get("/fundraisers")
async def get_fundraisers(skip: int = 0, limit: int = 20):
    fundraisers = await db.fundraisers.find(
        {"status": "active"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return fundraisers

@api_router.post("/fundraisers/{fundraiser_id}/contribute")
async def contribute_to_fundraiser(
    fundraiser_id: str,
    amount: float,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    
    fundraiser = await db.fundraisers.find_one({"id": fundraiser_id})
    if not fundraiser:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    
    origin = request.headers.get("origin", "")
    if not origin:
        raise HTTPException(status_code=400, detail="Origin header required")
    
    success_url = f"{origin}/fundraiser-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/fundraisers"
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "type": "fundraiser",
            "contributor_id": user["id"],
            "fundraiser_id": fundraiser_id
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction_doc = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "from_user_id": user["id"],
        "fundraiser_id": fundraiser_id,
        "amount": amount,
        "currency": "usd",
        "type": "fundraiser",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_doc)
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/fundraisers/status/{session_id}")
async def get_fundraiser_status(session_id: str, request: Request):
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    
    if transaction and transaction["payment_status"] != "completed" and status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "completed"}}
        )
        
        await db.fundraisers.update_one(
            {"id": transaction["fundraiser_id"]},
            {"$inc": {"current_amount": transaction["amount"]}}
        )
    
    return status

# ============= ANALYTICS ROUTES =============

@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    # Get user's videos
    videos = await db.videos.find({"user_id": user["id"]}, {"_id": 0}).to_list(None)
    
    total_videos = len(videos)
    total_views = sum(v["view_count"] for v in videos)
    total_tips = sum(v["tips_received"] for v in videos)
    
    return {
        "total_videos": total_videos,
        "total_views": total_views,
        "total_tips": total_tips,
        "wallet_balance": user["wallet_balance"],
        "videos": videos[:10]  # Recent 10 videos
    }

# ============= MODERATION ROUTES =============

@api_router.post("/moderation/flag")
async def flag_video(flag_data: ModerationFlag, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    flag_doc = {
        "id": str(uuid.uuid4()),
        "video_id": flag_data.video_id,
        "flagged_by": user["id"],
        "reason": flag_data.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.moderation_flags.insert_one(flag_doc)
    return {"message": "Video flagged for review"}

@api_router.get("/moderation/queue")
async def get_moderation_queue(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    # Simple admin check (you can enhance this)
    if user["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    flags = await db.moderation_flags.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return flags

# ============= WEBHOOK =============

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=stripe_api_key, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        return {"status": "success", "event_type": webhook_response.event_type}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ============= ADMIN ROUTES =============

@api_router.get("/admin/stats")
async def get_admin_stats(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    if user["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_users = await db.users.count_documents({})
    total_videos = await db.videos.count_documents({})
    total_transactions = await db.payment_transactions.count_documents({})
    
    return {
        "total_users": total_users,
        "total_videos": total_videos,
        "total_transactions": total_transactions
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