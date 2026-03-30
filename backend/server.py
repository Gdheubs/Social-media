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
import socketio
import asyncio
from openai import AsyncOpenAI
from agora_token_builder import RtcTokenBuilder

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

# OpenAI config for moderation
openai_client = AsyncOpenAI(api_key=os.environ.get('OPENAI_API_KEY', ''))

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
socket_app = socketio.ASGIApp(sio)

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

class PrivacySettings(BaseModel):
    show_email: bool = False
    show_phone: bool = False
    show_birthday: bool = False
    show_location: bool = False
    show_followers_count: bool = True
    show_following_count: bool = True
    profile_visibility: str = "public"  # public, followers_only, private

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    account_type: str
    avatar: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    birthday: Optional[str] = None
    location: Optional[str] = None
    verification_status: bool = False
    wallet_balance: float = 0.0
    total_views: int = 0
    followers_count: int = 0
    following_count: int = 0
    auth_provider: str = "email"  # email, google, phone, facebook, twitter
    privacy_settings: Optional[PrivacySettings] = None
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

class CommentCreate(BaseModel):
    text: str
    parent_id: Optional[str] = None  # For reply threading

class CommentUpdate(BaseModel):
    text: str

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    video_id: str
    user_id: str
    username: str
    user_avatar: Optional[str]
    text: str
    parent_id: Optional[str] = None
    edited: bool = False
    reply_count: int = 0
    created_at: str
    updated_at: Optional[str] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    type: str  # tip, comment, fundraiser, milestone
    message: str
    link: Optional[str]
    read: bool
    created_at: str

class LiveStreamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = "general"

class LiveStream(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    user_avatar: Optional[str]
    channel_name: str
    title: str
    description: Optional[str]
    category: str
    viewer_count: int
    status: str  # live, ended
    started_at: str
    ended_at: Optional[str] = None

class AgoraTokenRequest(BaseModel):
    channel_name: str
    uid: Optional[int] = 0
    role: str = "publisher"  # publisher or subscriber

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

async def create_notification(user_id: str, notification_type: str, message: str, link: Optional[str] = None):
    """Helper to create notifications"""
    notification_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": notification_type,
        "message": message,
        "link": link,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification_doc)
    
    # Emit real-time notification via WebSocket
    await sio.emit('new_notification', notification_doc, room=user_id)

async def moderate_content_ai(text: str, video_url: Optional[str] = None) -> Dict:
    """AI-powered content moderation using OpenAI"""
    try:
        if not os.environ.get('OPENAI_API_KEY'):
            return {"flagged": False, "categories": {}, "scores": {}}
        
        # Moderate text content
        response = await openai_client.moderations.create(input=text)
        result = response.results[0]
        
        return {
            "flagged": result.flagged,
            "categories": result.categories.model_dump(),
            "category_scores": result.category_scores.model_dump()
        }
    except Exception as e:
        logger.error(f"AI moderation error: {str(e)}")
        return {"flagged": False, "categories": {}, "scores": {}}

# ============= WEBSOCKET HANDLERS =============

@sio.event
async def connect(sid, environ):
    logger.info(f"WebSocket client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"WebSocket client disconnected: {sid}")

@sio.event
async def authenticate(sid, data):
    """Authenticate user and join their personal room"""
    try:
        token = data.get('token')
        if not token:
            return
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        
        # Join user to their personal room for targeted notifications
        await sio.enter_room(sid, user_id)
        logger.info(f"User {user_id} authenticated on WebSocket")
    except Exception as e:
        logger.error(f"WebSocket auth error: {str(e)}")

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
    resource_type: str = Query("video"),
    folder: str = Query("uploads"),
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
    
    # AI moderation check on title and description
    moderation_text = f"{video_data.title} {video_data.description or ''}"
    moderation_result = await moderate_content_ai(moderation_text)
    
    # Auto-flag if AI detects inappropriate content
    status = "active"
    if moderation_result.get("flagged"):
        status = "under_review"
        # Create moderation flag automatically
        flag_doc = {
            "id": str(uuid.uuid4()),
            "video_id": str(uuid.uuid4()),  # Temporary, will update after video creation
            "flagged_by": "system_ai",
            "reason": f"AI-flagged: {', '.join([k for k, v in moderation_result.get('categories', {}).items() if v])}",
            "status": "pending",
            "ai_scores": moderation_result.get("category_scores", {}),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    
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
        "status": status,
        "moderation": moderation_result
    }
    
    await db.videos.insert_one(video_doc)
    
    # If flagged, create the flag and notify user
    if status == "under_review":
        flag_doc["video_id"] = video_id
        await db.moderation_flags.insert_one(flag_doc)
        await create_notification(
            user["id"],
            "moderation",
            f'Your video "{video_data.title}" is under review for content policy compliance',
            None
        )
    
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

# ============= COMMENT ROUTES =============

@api_router.post("/videos/{video_id}/comments")
async def create_comment(
    video_id: str,
    comment_data: CommentCreate,
    authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # If it's a reply, verify parent comment exists
    if comment_data.parent_id:
        parent = await db.comments.find_one({"id": comment_data.parent_id})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
        
        # Increment reply count on parent
        await db.comments.update_one(
            {"id": comment_data.parent_id},
            {"$inc": {"reply_count": 1}}
        )
    
    comment_id = str(uuid.uuid4())
    comment_doc = {
        "id": comment_id,
        "video_id": video_id,
        "user_id": user["id"],
        "username": user["username"],
        "user_avatar": user.get("avatar"),
        "text": comment_data.text,
        "parent_id": comment_data.parent_id,
        "edited": False,
        "reply_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.comments.insert_one(comment_doc)
    
    # Notify video owner about new comment (not for replies to avoid spam)
    if video["user_id"] != user["id"] and not comment_data.parent_id:
        await create_notification(
            video["user_id"],
            "comment",
            f'{user["username"]} commented on your video "{video["title"]}"',
            f"/feed?video={video_id}"
        )
    
    return Comment(**comment_doc)

@api_router.get("/videos/{video_id}/comments")
async def get_video_comments(video_id: str, skip: int = 0, limit: int = 50):
    # Get top-level comments only (no parent_id)
    comments = await db.comments.find(
        {"video_id": video_id, "parent_id": None},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return comments

@api_router.get("/comments/{comment_id}/replies")
async def get_comment_replies(comment_id: str, skip: int = 0, limit: int = 20):
    """Get replies to a specific comment"""
    replies = await db.comments.find(
        {"parent_id": comment_id},
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)
    return replies

@api_router.put("/comments/{comment_id}")
async def update_comment(
    comment_id: str,
    comment_data: CommentUpdate,
    authorization: Optional[str] = Header(None)
):
    """Edit a comment"""
    user = await get_current_user(authorization)
    
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")
    
    await db.comments.update_one(
        {"id": comment_id},
        {"$set": {
            "text": comment_data.text,
            "edited": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Comment updated"}

@api_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    comment = await db.comments.find_one({"id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    await db.comments.delete_one({"id": comment_id})
    return {"message": "Comment deleted"}

# ============= SEARCH & FILTER =============

@api_router.get("/videos/search/query")
async def search_videos(
    q: str = Query(""),
    aspect_ratio: Optional[str] = None,
    sort: str = Query("recent", enum=["recent", "popular"]),
    skip: int = 0,
    limit: int = 20
):
    query = {"status": "active"}
    
    if q:
        # Search in title and description
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"username": {"$regex": q, "$options": "i"}}
        ]
    
    if aspect_ratio:
        query["aspect_ratio"] = aspect_ratio
    
    sort_field = "created_at" if sort == "recent" else "view_count"
    
    videos = await db.videos.find(query, {"_id": 0}).sort(sort_field, -1).skip(skip).limit(limit).to_list(limit)
    return videos

# ============= NOTIFICATION ROUTES =============

@api_router.get("/notifications")
async def get_notifications(
    authorization: Optional[str] = Header(None),
    skip: int = 0,
    limit: int = 50
):
    user = await get_current_user(authorization)
    
    notifications = await db.notifications.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        "user_id": user["id"],
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    authorization: Optional[str] = Header(None)
):
    user = await get_current_user(authorization)
    
    notification = await db.notifications.find_one({"id": notification_id})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    
    await db.notifications.update_many(
        {"user_id": user["id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": "All notifications marked as read"}

# ============= CREATOR SPOTLIGHT =============

@api_router.get("/creators/spotlight")
async def get_creator_spotlight(limit: int = 10):
    # Get videos from last 7 days
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Aggregate top creators by views + tips
    pipeline = [
        {
            "$match": {
                "status": "active",
                "created_at": {"$gte": seven_days_ago}
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "username": {"$first": "$username"},
                "user_avatar": {"$first": "$user_avatar"},
                "total_views": {"$sum": "$view_count"},
                "total_tips": {"$sum": "$tips_received"},
                "video_count": {"$sum": 1},
                "top_video": {"$first": "$$ROOT"}
            }
        },
        {
            "$project": {
                "user_id": "$_id",
                "username": 1,
                "user_avatar": 1,
                "total_views": 1,
                "total_tips": 1,
                "video_count": 1,
                "top_video": 1,
                "spotlight_score": {
                    "$add": [
                        "$total_views",
                        {"$multiply": ["$total_tips", 1000]}
                    ]
                }
            }
        },
        {"$sort": {"spotlight_score": -1}},
        {"$limit": limit}
    ]
    
    creators = await db.videos.aggregate(pipeline).to_list(limit)
    
    # Clean up MongoDB _id fields
    for creator in creators:
        creator.pop("_id", None)
        if "top_video" in creator and "_id" in creator["top_video"]:
            creator["top_video"].pop("_id", None)
    
    return creators


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
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if not origin:
        origin = os.environ.get("FRONTEND_URL", "")
    
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
        
        # Create notification for creator
        video = await db.videos.find_one({"id": transaction["video_id"]})
        tipper = await db.users.find_one({"id": transaction["from_user_id"]})
        if video and tipper:
            await create_notification(
                transaction["to_user_id"],
                "tip",
                f'{tipper["username"]} tipped ${creator_amount:.2f} on your video "{video["title"]}"',
                f"/wallet"
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
    
    origin = request.headers.get("origin") or request.headers.get("referer", "").rstrip("/")
    if not origin:
        origin = os.environ.get("FRONTEND_URL", "")
    
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
    
    # Get total count
    total_videos = await db.videos.count_documents({"user_id": user["id"]})
    
    # Use aggregation for totals (efficient)
    agg_result = await db.videos.aggregate([
        {"$match": {"user_id": user["id"]}},
        {"$group": {
            "_id": None,
            "total_views": {"$sum": "$view_count"},
            "total_tips": {"$sum": "$tips_received"}
        }}
    ]).to_list(1)
    
    totals = agg_result[0] if agg_result else {"total_views": 0, "total_tips": 0}
    
    # Get recent videos (limited)
    recent_videos = await db.videos.find(
        {"user_id": user["id"]},
        {
            "_id": 0,
            "id": 1,
            "title": 1,
            "view_count": 1,
            "tips_received": 1,
            "created_at": 1,
            "cloudinary_url": 1
        }
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_videos": total_videos,
        "total_views": totals["total_views"],
        "total_tips": totals["total_tips"],
        "wallet_balance": user["wallet_balance"],
        "videos": recent_videos
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
    active_fundraisers = await db.fundraisers.count_documents({"status": "active"})
    pending_flags = await db.moderation_flags.count_documents({"status": "pending"})
    
    return {
        "total_users": total_users,
        "total_videos": total_videos,
        "total_transactions": total_transactions,
        "active_fundraisers": active_fundraisers,
        "pending_flags": pending_flags
    }

@api_router.get("/admin/users")
async def get_all_users(
    authorization: Optional[str] = Header(None),
    skip: int = 0,
    limit: int = 50
):
    user = await get_current_user(authorization)
    
    if user["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return users

@api_router.put("/admin/users/{user_id}/verify")
async def verify_user(user_id: str, authorization: Optional[str] = Header(None)):
    admin = await get_current_user(authorization)
    
    if admin["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"verification_status": True}}
    )
    
    # Notify user
    await create_notification(
        user_id,
        "milestone",
        "Congratulations! Your account has been verified.",
        "/profile"
    )
    
    return {"message": "User verified"}

@api_router.delete("/admin/videos/{video_id}")
async def delete_video_admin(video_id: str, authorization: Optional[str] = Header(None)):
    admin = await get_current_user(authorization)
    
    if admin["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    video = await db.videos.find_one({"id": video_id})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Update status instead of deleting
    await db.videos.update_one(
        {"id": video_id},
        {"$set": {"status": "removed"}}
    )
    
    # Notify video owner
    await create_notification(
        video["user_id"],
        "moderation",
        f'Your video "{video["title"]}" was removed by moderators',
        None
    )
    
    return {"message": "Video removed"}

@api_router.put("/admin/flags/{flag_id}/resolve")
async def resolve_flag(
    flag_id: str,
    action: str,
    authorization: Optional[str] = Header(None)
):
    admin = await get_current_user(authorization)
    
    if admin["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    flag = await db.moderation_flags.find_one({"id": flag_id})
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    
    await db.moderation_flags.update_one(
        {"id": flag_id},
        {"$set": {
            "status": "reviewed",
            "reviewed_by": admin["id"]
        }}
    )
    
    if action == "remove":
        await db.videos.update_one(
            {"id": flag["video_id"]},
            {"$set": {"status": "removed"}}
        )
    
    return {"message": "Flag resolved"}

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


# ============= ADVANCED ANALYTICS =============

@api_router.get("/admin/analytics/timeseries")
async def get_analytics_timeseries(
    days: int = 30,
    authorization: Optional[str] = Header(None)
):
    """Get time-series analytics data for charts"""
    admin = await get_current_user(authorization)
    
    if admin["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # User growth over time
    users_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    # Video uploads over time
    videos_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date.isoformat()}
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "count": {"$sum": 1},
                "total_views": {"$sum": "$view_count"}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    # Revenue over time (from transactions)
    revenue_pipeline = [
        {
            "$match": {
                "created_at": {"$gte": start_date.isoformat()},
                "payment_status": "completed"
            }
        },
        {
            "$group": {
                "_id": {"$substr": ["$created_at", 0, 10]},
                "revenue": {"$sum": "$amount"},
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    # Execute aggregations
    user_growth = await db.users.aggregate(users_pipeline).to_list(days)
    video_stats = await db.videos.aggregate(videos_pipeline).to_list(days)
    revenue_stats = await db.payment_transactions.aggregate(revenue_pipeline).to_list(days)
    
    # Fill missing dates with zeros
    date_range = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    
    user_growth_dict = {item["_id"]: item["count"] for item in user_growth}
    video_stats_dict = {item["_id"]: item for item in video_stats}
    revenue_stats_dict = {item["_id"]: item for item in revenue_stats}
    
    chart_data = []
    cumulative_users = 0
    
    for date in date_range:
        cumulative_users += user_growth_dict.get(date, 0)
        video_data = video_stats_dict.get(date, {"count": 0, "total_views": 0})
        revenue_data = revenue_stats_dict.get(date, {"revenue": 0, "count": 0})
        
        chart_data.append({
            "date": date,
            "new_users": user_growth_dict.get(date, 0),
            "total_users": cumulative_users,
            "videos_uploaded": video_data["count"],
            "total_views": video_data.get("total_views", 0),
            "revenue": float(revenue_data.get("revenue", 0)),
            "transactions": revenue_data.get("count", 0)
        })
    
    return chart_data

@api_router.get("/admin/analytics/engagement")
async def get_engagement_metrics(authorization: Optional[str] = Header(None)):
    """Get engagement metrics for admin dashboard"""
    admin = await get_current_user(authorization)
    
    if admin["email"] not in ["admin@example.com"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate various engagement metrics
    total_videos = await db.videos.count_documents({"status": "active"})
    total_comments = await db.comments.count_documents({})
    total_notifications = await db.notifications.count_documents({})
    
    # Average views per video
    avg_views_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": None,
            "avg_views": {"$avg": "$view_count"},
            "total_views": {"$sum": "$view_count"}
        }}
    ]
    
    avg_views = await db.videos.aggregate(avg_views_pipeline).to_list(1)
    avg_views_result = avg_views[0] if avg_views else {"avg_views": 0, "total_views": 0}
    
    # Top creators by views
    top_creators_pipeline = [
        {"$match": {"status": "active"}},
        {"$group": {
            "_id": "$user_id",
            "username": {"$first": "$username"},
            "total_views": {"$sum": "$view_count"},
            "video_count": {"$sum": 1}
        }},
        {"$sort": {"total_views": -1}},
        {"$limit": 5}
    ]
    
    top_creators = await db.videos.aggregate(top_creators_pipeline).to_list(5)
    
    # Clean up MongoDB _id
    for creator in top_creators:
        creator.pop("_id", None)
    
    return {
        "total_videos": total_videos,
        "total_comments": total_comments,
        "total_notifications": total_notifications,
        "average_views_per_video": round(avg_views_result["avg_views"], 2),
        "total_platform_views": avg_views_result["total_views"],
        "top_creators": top_creators,
        "comments_per_video": round(total_comments / total_videos, 2) if total_videos > 0 else 0
    }

# Mount Socket.IO app
app.mount("/socket.io", socket_app)


# ============= LIVE STREAMING ROUTES =============

@api_router.post("/live/token")
async def generate_agora_token(
    token_request: AgoraTokenRequest,
    authorization: Optional[str] = Header(None)
):
    """Generate Agora RTC token for live streaming."""
    user = await get_current_user(authorization)
    
    agora_app_id = os.environ.get('AGORA_APP_ID')
    agora_app_certificate = os.environ.get('AGORA_APP_CERTIFICATE')
    
    if not agora_app_id or not agora_app_certificate:
        raise HTTPException(status_code=500, detail="Agora credentials not configured")
    
    # Set role: 1 = publisher/host, 2 = subscriber/audience
    role = 1 if token_request.role == "publisher" else 2
    
    # Token expires in 1 hour
    expiration_time = int(time.time()) + 3600
    
    try:
        token = RtcTokenBuilder.buildTokenWithUid(
            appId=agora_app_id,
            appCertificate=agora_app_certificate,
            channelName=token_request.channel_name,
            uid=token_request.uid,
            role=role,
            privilegeExpiredTs=expiration_time
        )
        
        return {
            "token": token,
            "app_id": agora_app_id,
            "channel": token_request.channel_name,
            "uid": token_request.uid,
            "expiration": expiration_time
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate token: {str(e)}")

@api_router.post("/live/start")
async def start_live_stream(
    stream_data: LiveStreamCreate,
    authorization: Optional[str] = Header(None)
):
    """Start a new live stream."""
    user = await get_current_user(authorization)
    
    # Generate unique channel name
    channel_name = f"live-{user['id']}-{int(time.time())}"
    
    stream_id = str(uuid.uuid4())
    stream_doc = {
        "id": stream_id,
        "user_id": user["id"],
        "username": user["username"],
        "user_avatar": user.get("avatar"),
        "channel_name": channel_name,
        "title": stream_data.title,
        "description": stream_data.description,
        "category": stream_data.category,
        "viewer_count": 0,
        "status": "live",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None
    }
    
    await db.live_streams.insert_one(stream_doc)
    
    # Generate token for broadcaster
    token_request = AgoraTokenRequest(channel_name=channel_name, uid=int(user["id"][:8], 16) % 2147483647, role="publisher")
    token_response = await generate_agora_token(token_request, authorization)
    
    return {
        **LiveStream(**stream_doc).dict(),
        "agora_token": token_response["token"],
        "agora_app_id": token_response["app_id"]
    }

@api_router.put("/live/{stream_id}/end")
async def end_live_stream(stream_id: str, authorization: Optional[str] = Header(None)):
    """End a live stream."""
    user = await get_current_user(authorization)
    
    stream = await db.live_streams.find_one({"id": stream_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    
    if stream["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.live_streams.update_one(
        {"id": stream_id},
        {"$set": {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Stream ended"}

@api_router.get("/live/active")
async def get_active_streams(skip: int = 0, limit: int = 20):
    """Get all active live streams."""
    streams = await db.live_streams.find(
        {"status": "live"},
        {"_id": 0}
    ).sort("started_at", -1).skip(skip).limit(limit).to_list(limit)
    return streams

@api_router.get("/live/{stream_id}")
async def get_stream(stream_id: str):
    """Get stream details."""
    stream = await db.live_streams.find_one({"id": stream_id}, {"_id": 0})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return stream

@api_router.put("/live/{stream_id}/viewer-count")
async def update_viewer_count(stream_id: str, count: int):
    """Update viewer count for a stream."""
    await db.live_streams.update_one(
        {"id": stream_id},
        {"$set": {"viewer_count": count}}
    )
    return {"message": "Viewer count updated"}

# ============= PRIVACY SETTINGS ROUTES =============

@api_router.get("/users/me/privacy")
async def get_privacy_settings(authorization: Optional[str] = Header(None)):
    """Get user's privacy settings."""
    user = await get_current_user(authorization)
    
    privacy = user.get("privacy_settings", {})
    return PrivacySettings(**privacy) if privacy else PrivacySettings()

@api_router.put("/users/me/privacy")
async def update_privacy_settings(
    settings: PrivacySettings,
    authorization: Optional[str] = Header(None)
):
    """Update user's privacy settings."""
    user = await get_current_user(authorization)
    
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"privacy_settings": settings.dict()}}
    )
    
    return {"message": "Privacy settings updated", "settings": settings}

@api_router.put("/users/me/profile-extended")
async def update_extended_profile(
    phone: Optional[str] = None,
    birthday: Optional[str] = None,
    location: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    """Update extended user profile information."""
    user = await get_current_user(authorization)
    
    update_data = {}
    if phone is not None:
        update_data["phone"] = phone
    if birthday is not None:
        update_data["birthday"] = birthday
    if location is not None:
        update_data["location"] = location
    
    if update_data:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": update_data}
        )
    
    return {"message": "Profile updated"}

