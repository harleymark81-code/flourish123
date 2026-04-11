from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, Response
from starlette.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from bson.errors import InvalidId
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Annotated
import os
import logging
import bcrypt
import jwt
import uuid
import json
import stripe as stripe_lib
from datetime import datetime, timezone, timedelta
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

# ── Anthropic helper with retry ────────────────────────────────────────────────
ANTHROPIC_MODEL = "claude-3-5-haiku-20241022"

def _is_transient_error(exc):
    """Retry on 5xx Anthropic errors or network errors."""
    if isinstance(exc, ValueError) and "Anthropic API error" in str(exc):
        try:
            code = int(str(exc).split("error ")[1].split(":")[0])
            return code >= 500
        except Exception:
            return False
    return isinstance(exc, (httpx.ConnectError, httpx.TimeoutException))

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    retry=retry_if_exception(_is_transient_error),
    reraise=True,
)
async def call_anthropic(system: str, user_msg: str) -> str:
    """Call Anthropic API directly using httpx, with retry on transient errors."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set in environment")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": ANTHROPIC_MODEL,
                "max_tokens": 2048,
                "system": system,
                "messages": [{"role": "user", "content": user_msg}],
            },
        )
        if resp.status_code != 200:
            error_body = resp.text
            raise ValueError(f"Anthropic API error {resp.status_code}: {error_body}")
        return resp.json()["content"][0]["text"]

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── DB ───────────────────────────────────────────────────────────────────────
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ── Constants ─────────────────────────────────────────────────────────────────
JWT_ALGORITHM = "HS256"
FREE_DAILY_RATINGS = 5
FREE_DAILY_SCANS = 3
IS_PRODUCTION = os.environ.get("ENVIRONMENT", "").lower() == "production"

# ── Admin token (set ADMIN_SESSION_TOKEN in Railway env vars) ─────────────────
ADMIN_SESSION_TOKEN = os.environ.get("ADMIN_SESSION_TOKEN", "")

def _verify_admin(request: Request):
    """Raise 401 if the X-Admin-Token header does not match the server-side token."""
    if not ADMIN_SESSION_TOKEN:
        raise HTTPException(status_code=500, detail="Admin token not configured on server")
    auth = request.headers.get("X-Admin-Token", "")
    if auth != ADMIN_SESSION_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Startup / shutdown via lifespan ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@flourish.app")
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password:
        raise RuntimeError("ADMIN_PASSWORD env var is required — set it in Railway")

    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "conditions": [],
            "goals": [],
            "onboarding_completed": True,
            "is_premium": False,
            "token_version": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

    yield

    # ── Shutdown ──
    client.close()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Flourish API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
api_router = APIRouter(prefix="/api")

# ── CORS ─────────────────────────────────────────────────────────────────────
_allow_origins = [
    "https://theflourishapp.netlify.app",
    "https://69d3f4f94ab7f09ab2fa371d--lovely-chaja-e17ca9.netlify.app",
    "https://flourish123-production.up.railway.app",
]
# Add localhost only in non-production (set CORS_ORIGINS env var locally)
_extra = os.environ.get("CORS_ORIGINS", "")
if _extra:
    _allow_origins += [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-Admin-Token"],
    expose_headers=["*"],
    max_age=86400,
)

# ── PyObjectId helper ──────────────────────────────────────────────────────────
def oid(v: Any) -> str:
    return str(v)

def doc_to_dict(doc: dict) -> dict:
    if doc is None:
        return None
    d = dict(doc)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    return d

def safe_object_id(value: str) -> ObjectId:
    """Convert string to ObjectId, raising 400 on invalid format."""
    try:
        return ObjectId(value)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="Invalid ID format")

# ── Password helpers ──────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ── JWT helpers ────────────────────────────────────────────────────────────────
def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "token_version": token_version,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Token version check — invalidated on logout
        if payload.get("token_version", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Session expired, please log in again")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_user(request: Request):
    try:
        return await get_current_user(request)
    except (HTTPException, jwt.InvalidTokenError):
        return None

# ── Pydantic Models ────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""
    referred_by: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class ProfileUpdateRequest(BaseModel):
    conditions: List[str]
    goals: List[str]
    managing_duration: Optional[str] = ""
    food_challenge: Optional[str] = ""
    onboarding_completed: Optional[bool] = True

class FoodRatingRequest(BaseModel):
    food_name: str
    ingredients: Optional[str] = ""
    barcode: Optional[str] = ""
    product_image: Optional[str] = ""

class DiaryLogRequest(BaseModel):
    food_name: str
    overall_score: int = Field(ge=0, le=100)
    verdict: Optional[str] = ""
    ingredients: Optional[str] = ""
    product_image: Optional[str] = ""
    barcode: Optional[str] = ""
    dimensions: Optional[dict] = None
    flags: Optional[dict] = None
    forYourCondition: Optional[str] = ""
    alternatives: Optional[list] = None
    bodySystemsAffected: Optional[list] = None
    id: Optional[str] = None
    rated_at: Optional[str] = None

class DiaryNoteRequest(BaseModel):
    entry_id: str
    note: str

class SymptomRequest(BaseModel):
    energy: int = Field(ge=1, le=5)
    bloating: int = Field(ge=1, le=5)
    brain_fog: int = Field(ge=1, le=5)
    mood: int = Field(ge=1, le=5)
    skin: int = Field(ge=1, le=5)

class MealPlanRequest(BaseModel):
    regenerate: Optional[bool] = False

class CheckoutRequest(BaseModel):
    plan: str  # "monthly" or "annual"
    origin_url: str

class AffiliateApplicationRequest(BaseModel):
    name: str
    email: str
    social_handles: str
    audience_size: str
    condition_niche: str
    description: str

class AdminLoginRequest(BaseModel):
    password: str

# ── AUTH ROUTES ───────────────────────────────────────────────────────────────
@api_router.post("/auth/register")
@limiter.limit("10/minute")
async def register(request: Request, data: RegisterRequest):
    from fastapi.responses import JSONResponse as JR
    email = data.email.lower().strip()

    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    user_doc = {
        "email": email,
        "password_hash": hash_password(data.password),
        "name": data.name or email.split("@")[0],
        "role": "user",
        "conditions": [],
        "goals": [],
        "managing_duration": "",
        "food_challenge": "",
        "onboarding_completed": False,
        "is_premium": False,
        "premium_plan": None,
        "premium_expires_at": None,
        "referral_code": str(uuid.uuid4())[:8].upper(),
        "referred_by": data.referred_by or None,
        "streak": 0,
        "longest_streak": 0,
        "last_active_date": None,
        "preview_24h_used": False,
        "preview_24h_expires": None,
        "token_version": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = str(result.inserted_id)
    user_doc.pop("password_hash", None)

    # If registered via an affiliate link, increment their signup counter
    if data.referred_by:
        await db.affiliate_applications.update_one(
            {"affiliate_code": data.referred_by},
            {"$inc": {"signups": 1}}
        )

    token = create_access_token(str(result.inserted_id), email, token_version=0)
    resp = JR(content={"user": user_doc, "token": token})
    resp.set_cookie(
        "access_token", token, httponly=True,
        secure=IS_PRODUCTION, samesite="lax", max_age=86400 * 7
    )
    return resp

@api_router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, data: LoginRequest):
    from fastapi.responses import JSONResponse as JR
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    user["_id"] = user_id
    user.pop("password_hash", None)

    # Update streak
    today = datetime.now(timezone.utc).date().isoformat()
    last_active = user.get("last_active_date")
    streak = user.get("streak", 0)

    if last_active:
        from datetime import date
        last_date = date.fromisoformat(last_active)
        today_date = date.fromisoformat(today)
        diff = (today_date - last_date).days
        if diff == 1:
            streak += 1
        elif diff > 1:
            streak = 1
    else:
        streak = 1

    longest = max(streak, user.get("longest_streak", 0))

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"streak": streak, "longest_streak": longest, "last_active_date": today}}
    )
    user["streak"] = streak
    user["longest_streak"] = longest
    user["last_active_date"] = today

    token_version = user.get("token_version", 0)
    token = create_access_token(user_id, email, token_version=token_version)
    resp = JR(content={"user": user, "token": token})
    resp.set_cookie(
        "access_token", token, httponly=True,
        secure=IS_PRODUCTION, samesite="lax", max_age=86400 * 7
    )
    return resp

@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request):
    from fastapi.responses import JSONResponse as JR
    # Increment token_version to revoke all existing tokens for this user
    try:
        user = await get_current_user(request)
        uid = user.get("id") or user.get("_id")
        await db.users.update_one(
            {"_id": ObjectId(uid)},
            {"$inc": {"token_version": 1}}
        )
    except HTTPException:
        pass  # Already logged out or token invalid — still clear the cookie
    resp = JR(content={"message": "Logged out"})
    resp.delete_cookie("access_token")
    return resp

# ── PROFILE ────────────────────────────────────────────────────────────────────
@api_router.put("/profile")
async def update_profile(data: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    update = {
        "conditions": data.conditions,
        "goals": data.goals,
        "managing_duration": data.managing_duration,
        "food_challenge": data.food_challenge,
        "onboarding_completed": data.onboarding_completed
    }
    await db.users.update_one({"_id": ObjectId(current_user["id"] if "id" in current_user else current_user["_id"])}, {"$set": update})
    return {"success": True}

@api_router.get("/profile/stats")
async def get_profile_stats(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()

    today_ratings = await db.diary.count_documents({"user_id": uid, "date": today})

    month_start = datetime.now(timezone.utc).replace(day=1).date().isoformat()
    monthly_entries = await db.diary.find({"user_id": uid, "date": {"$gte": month_start}}, {"overall_score": 1}).to_list(500)
    monthly_avg = round(sum(e.get("overall_score", 0) for e in monthly_entries) / len(monthly_entries)) if monthly_entries else 0

    streak = current_user.get("streak", 0)
    bonus_scans = 0
    if streak >= 3:
        bonus_scans = 2
    elif streak >= 1:
        bonus_scans = 1

    is_premium = current_user.get("is_premium", False)
    preview_active = _check_preview_active(current_user)

    return {
        "today_ratings": today_ratings,
        "daily_limit": FREE_DAILY_RATINGS + bonus_scans,
        "remaining_ratings": max(0, FREE_DAILY_RATINGS + bonus_scans - today_ratings),
        "monthly_avg": monthly_avg,
        "streak": current_user.get("streak", 0),
        "longest_streak": current_user.get("longest_streak", 0),
        "bonus_scans": bonus_scans,
        "is_premium": is_premium or preview_active,
        "preview_active": preview_active
    }

def _check_preview_active(user: dict) -> bool:
    """Return True if the user's 24h premium preview is currently active."""
    if user.get("is_premium"):
        return False  # Already full premium — no need to check preview
    exp = user.get("preview_24h_expires")
    if not exp:
        return False
    try:
        preview_exp = datetime.fromisoformat(str(exp).replace("Z", "+00:00"))
        return datetime.now(timezone.utc) < preview_exp
    except Exception:
        return False

def _effective_premium(user: dict) -> bool:
    """Return True if user is premium (paid or active preview)."""
    return user.get("is_premium", False) or _check_preview_active(user)

# ── FOOD RATING ────────────────────────────────────────────────────────────────
@api_router.post("/food/rate")
@limiter.limit("20/minute")
async def rate_food(request: Request, data: FoodRatingRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()

    if not _effective_premium(current_user):
        today_count = await db.diary.count_documents({"user_id": uid, "date": today})
        streak = current_user.get("streak", 0)
        bonus = 2 if streak >= 3 else (1 if streak >= 1 else 0)
        daily_limit = FREE_DAILY_RATINGS + bonus
        if today_count >= daily_limit:
            raise HTTPException(status_code=429, detail=f"Daily limit of {daily_limit} ratings reached. Upgrade to Premium for unlimited ratings.")

    conditions = current_user.get("conditions", [])
    goals = current_user.get("goals", [])
    managing_duration = current_user.get("managing_duration", "")
    food_challenge = current_user.get("food_challenge", "")

    system_msg = """You are a nutritional AI advisor specialised in hormonal conditions, autoimmune disease, gut health, and chronic illness. You provide evidence-based food ratings personalised to the user's specific health conditions. You MUST return ONLY valid JSON with no markdown, no preamble, no explanation — just the raw JSON object."""

    user_prompt = f"""Rate this food for a user with the following profile:
- Health conditions: {', '.join(conditions) if conditions else 'General health'}
- Health goals: {', '.join(goals) if goals else 'General wellness'}
- Managing duration: {managing_duration}
- Food challenges: {food_challenge}

Food to rate: {data.food_name}
{f'Ingredients: {data.ingredients}' if data.ingredients else ''}
(Suggestion seed: {uuid.uuid4().hex[:8]} — always suggest fresh, varied alternatives not previously suggested)

Return ONLY this exact JSON structure (no markdown, no extra text):
{{
  "name": "{data.food_name}",
  "overallScore": <integer 0-100>,
  "verdict": "<one sentence using phrases like 'may support', 'research suggests', 'commonly associated with'  — never absolute claims>",
  "dimensions": {{
    "naturalness": {{"score": <0-100>, "summary": "<2-3 sentences>"}},
    "hormonalImpact": {{"score": <0-100>, "summary": "<2-3 sentences>"}},
    "inflammation": {{"score": <0-100>, "summary": "<2-3 sentences>"}},
    "gutHealth": {{"score": <0-100>, "summary": "<2-3 sentences>"}}
  }},
  "flags": {{
    "warnings": ["<short warning>", ...],
    "positives": ["<short positive>", ...],
    "tips": ["<short tip>", ...]
  }},
  "forYourCondition": "<2-3 sentences deeply personalised to their specific conditions and goals using calm measured language>",
  "alternatives": [
    {{"name": "<food name>", "predictedScore": <0-100>}},
    {{"name": "<food name>", "predictedScore": <0-100>}},
    {{"name": "<food name>", "predictedScore": <0-100>}}
  ],
  "bodySystemsAffected": ["<from: Hormones, Gut, Immune, Thyroid, Energy>", ...]
}}"""

    try:
        response = await call_anthropic(system_msg, user_prompt)

        response_text = response.strip()
        if response_text.startswith("```"):
            parts = response_text.split("```")
            response_text = parts[1] if len(parts) > 1 else response_text
            if response_text.startswith("json"):
                response_text = response_text[4:]

        rating_data = json.loads(response_text)
        rating_data["product_image"] = data.product_image
        rating_data["food_name"] = data.food_name
        rating_data["barcode"] = data.barcode
        rating_data["rated_at"] = datetime.now(timezone.utc).isoformat()
        rating_data["user_id"] = uid
        rating_data["date"] = today
        rating_data["id"] = str(uuid.uuid4())

        return rating_data

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}, response: {response_text[:500]}")
        raise HTTPException(status_code=500, detail="Failed to parse AI response")
    except Exception as e:
        logger.error(f"AI rating error: {e}")
        raise HTTPException(status_code=500, detail=f"AI rating failed: {str(e)}")

# ── DAILY TIP ──────────────────────────────────────────────────────────────────
@api_router.get("/food/daily-tip")
async def get_daily_tip(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date().isoformat()
    uid = current_user.get("id") or current_user.get("_id")

    existing = await db.daily_tips.find_one({"user_id": uid, "date": today})
    if existing:
        return {"tip": existing["tip"], "date": today}

    conditions = current_user.get("conditions", ["general health"])

    try:
        response = await call_anthropic(
            "You are a warm, supportive nutritional advisor for people with hormonal conditions.",
            f"Give me one short, warm, specific daily food tip (2 sentences max) for someone managing: {', '.join(conditions)}. Be encouraging and specific. No bullet points, just plain text."
        )
        tip = response.strip()
        await db.daily_tips.insert_one({"user_id": uid, "date": today, "tip": tip})
        return {"tip": tip, "date": today}
    except Exception as e:
        logger.error(f"Daily tip error: {e}")
        return {"tip": "Focus on whole, unprocessed foods today. Your body responds best to foods it recognises and can easily process.", "date": today}

# ── MEAL PLANNER ───────────────────────────────────────────────────────────────
@api_router.post("/food/meal-plan")
async def get_meal_plan(data: MealPlanRequest, current_user: dict = Depends(get_current_user)):
    if not _effective_premium(current_user):
        raise HTTPException(status_code=403, detail="Meal planner is a Premium feature")

    conditions = current_user.get("conditions", ["general health"])
    goals = current_user.get("goals", [])

    try:
        response = await call_anthropic(
            "You are a nutritional advisor specialised in hormonal health. Return ONLY valid JSON.",
            f"""Create a one-day meal plan for someone with: {', '.join(conditions)}. Goals: {', '.join(goals) if goals else 'general wellness'}.
All meals should be green-rated (score 70+). Return ONLY this JSON:
{{
  "breakfast": {{"name": "<meal>", "description": "<brief>", "predictedScore": <70-95>, "emoji": "🥣"}},
  "lunch": {{"name": "<meal>", "description": "<brief>", "predictedScore": <70-95>, "emoji": "🥗"}},
  "dinner": {{"name": "<meal>", "description": "<brief>", "predictedScore": <70-95>, "emoji": "🍽️"}},
  "snack": {{"name": "<meal>", "description": "<brief>", "predictedScore": <70-95>, "emoji": "🍎"}}
}}"""
        )

        response_text = response.strip()
        if response_text.startswith("```"):
            parts = response_text.split("```")
            response_text = parts[1] if len(parts) > 1 else response_text
            if response_text.startswith("json"):
                response_text = response_text[4:]

        plan = json.loads(response_text)
        return plan
    except Exception as e:
        logger.error(f"Meal plan error: {e}")
        return {
            "breakfast": {"name": "Greek Yoghurt with Berries", "description": "Rich in probiotics and antioxidants", "predictedScore": 88, "emoji": "🥣"},
            "lunch": {"name": "Wild Salmon Salad", "description": "Anti-inflammatory omega-3 rich meal", "predictedScore": 92, "emoji": "🥗"},
            "dinner": {"name": "Roasted Vegetables with Lentils", "description": "Fibre-rich and hormone-balancing", "predictedScore": 85, "emoji": "🍽️"},
            "snack": {"name": "Flaxseed Smoothie", "description": "Supports oestrogen balance", "predictedScore": 87, "emoji": "🍎"}
        }

# ── DIARY ──────────────────────────────────────────────────────────────────────
@api_router.post("/diary/log")
async def log_to_diary(data: DiaryLogRequest, current_user: dict = Depends(get_current_user)):
    if not _effective_premium(current_user):
        raise HTTPException(status_code=403, detail="Food diary is a Premium feature")

    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()

    entry = {
        **data.model_dump(exclude_none=True),
        "user_id": uid,
        "date": today,
        "logged_at": datetime.now(timezone.utc).isoformat(),
        "note": ""
    }
    result = await db.diary.insert_one(entry)
    entry["_id"] = str(result.inserted_id)
    entry["id"] = str(result.inserted_id)
    return entry

@api_router.get("/diary")
async def get_diary(date: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    is_premium = _effective_premium(current_user)
    today = datetime.now(timezone.utc).date().isoformat()

    query_date = date or today

    if not is_premium and query_date != today:
        return {"entries": [], "locked": True, "message": "Upgrade to Premium to view your full diary history."}

    entries = await db.diary.find({"user_id": uid, "date": query_date}).sort("logged_at", -1).to_list(100)
    return {"entries": [doc_to_dict(e) for e in entries], "locked": False}

@api_router.get("/diary/dates")
async def get_diary_dates(current_user: dict = Depends(get_current_user)):
    if not _effective_premium(current_user):
        raise HTTPException(status_code=403, detail="Premium feature")
    uid = current_user.get("id") or current_user.get("_id")
    pipeline = [
        {"$match": {"user_id": uid}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}, "avg_score": {"$avg": "$overall_score"}}},
        {"$sort": {"_id": -1}}
    ]
    dates = await db.diary.aggregate(pipeline).to_list(365)
    return {"dates": [{"date": d["_id"], "count": d["count"], "avg_score": round(d.get("avg_score", 0))} for d in dates]}

@api_router.put("/diary/note")
async def update_diary_note(data: DiaryNoteRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    oid_val = safe_object_id(data.entry_id)
    await db.diary.update_one(
        {"_id": oid_val, "user_id": uid},
        {"$set": {"note": data.note}}
    )
    return {"success": True}

@api_router.delete("/diary/{entry_id}")
async def delete_diary_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    oid_val = safe_object_id(entry_id)
    await db.diary.delete_one({"_id": oid_val, "user_id": uid})
    return {"success": True}

@api_router.get("/diary/patterns")
async def get_patterns(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    if not _effective_premium(current_user):
        raise HTTPException(status_code=403, detail="Premium feature")

    two_weeks_ago = (datetime.now(timezone.utc).date() - timedelta(days=14)).isoformat()
    diary_entries = await db.diary.find({"user_id": uid, "date": {"$gte": two_weeks_ago}}, {"food_name": 1, "overall_score": 1, "date": 1}).to_list(300)
    symptom_entries = await db.symptoms.find({"user_id": uid, "date": {"$gte": two_weeks_ago}}, {"energy": 1, "bloating": 1, "date": 1}).to_list(100)

    if len(diary_entries) < 5:
        return {"patterns": [], "message": "Keep logging your food to unlock patterns after 14 days."}

    conditions = current_user.get("conditions", [])

    try:
        diary_summary = [(e.get("food_name", ""), e.get("overall_score", 0), e.get("date", "")) for e in diary_entries[:20]]
        symptom_summary = [(e.get("energy", 0), e.get("bloating", 0), e.get("date", "")) for e in symptom_entries[:14]]

        response = await call_anthropic(
            "You are a nutritional analyst. Identify patterns between food and health symptoms.",
            f"""Analyse these food and symptom patterns for someone with {', '.join(conditions)}:
Food diary (food, score, date): {diary_summary[:10]}
Symptoms (energy, bloating, date): {symptom_summary[:7]}

Return 3 specific insights as JSON array: [{{"insight": "<2 sentence finding>", "type": "<positive|negative|neutral>"}}]
Only return the JSON array, no other text."""
        )

        response_text = response.strip()
        if response_text.startswith("```"):
            parts = response_text.split("```")
            response_text = parts[1] if len(parts) > 1 else response_text
            if response_text.startswith("json"):
                response_text = response_text[4:]

        patterns = json.loads(response_text)
        return {"patterns": patterns}
    except Exception as e:
        logger.error(f"Patterns error: {e}")
        return {"patterns": [{"insight": "Keep logging consistently to see your personal food-symptom patterns emerge.", "type": "neutral"}]}

# ── SYMPTOMS ───────────────────────────────────────────────────────────────────
@api_router.post("/symptoms")
async def log_symptoms(data: SymptomRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()

    await db.symptoms.update_one(
        {"user_id": uid, "date": today},
        {"$set": {
            "energy": data.energy,
            "bloating": data.bloating,
            "brain_fog": data.brain_fog,
            "mood": data.mood,
            "skin": data.skin,
            "logged_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return {"success": True}

@api_router.get("/symptoms/today")
async def get_today_symptoms(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()
    entry = await db.symptoms.find_one({"user_id": uid, "date": today})
    if entry:
        return doc_to_dict(entry)
    return None

# ── STREAK / REWARDS ───────────────────────────────────────────────────────────
@api_router.get("/streak/reward")
async def get_streak_reward(current_user: dict = Depends(get_current_user)):
    streak = current_user.get("streak", 0)
    uid = current_user.get("id") or current_user.get("_id")

    reward = None
    if streak == 1:
        reward = {"type": "bonus_scan", "amount": 1, "message": "Welcome back. You have earned 1 bonus scan today."}
    elif streak == 3:
        reward = {"type": "bonus_scan", "amount": 2, "message": "3 day streak! You have earned 2 bonus scans today."}
    elif streak == 7:
        reward = {"type": "weekly_insight", "message": "7 day streak! You have unlocked your weekly health insight."}
    elif streak == 14:
        preview_used = current_user.get("preview_24h_used", False)
        if not preview_used:
            preview_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            # Only set preview fields — do NOT set is_premium permanently
            await db.users.update_one(
                {"_id": ObjectId(uid)},
                {"$set": {"preview_24h_used": True, "preview_24h_expires": preview_expires}}
            )
            reward = {"type": "premium_preview", "message": "2 week streak! You have earned a free 24-hour premium preview!"}
        else:
            reward = {"type": "bonus_scan", "amount": 2, "message": "14 day streak! Great work!"}
    elif streak == 30:
        reward = {"type": "free_week", "message": "30 day streak! You have earned one week of Flourish Premium free."}

    return {"streak": streak, "reward": reward}

# ── PAYMENTS ───────────────────────────────────────────────────────────────────
@api_router.post("/payments/checkout")
async def create_checkout(data: CheckoutRequest, request: Request, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")

    stripe_key = os.environ.get("STRIPE_SECRET_KEY", "")
    if not stripe_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    stripe_lib.api_key = stripe_key

    if data.plan == "monthly":
        price_id = os.environ.get("STRIPE_MONTHLY_PRICE_ID", "")
    else:
        price_id = os.environ.get("STRIPE_ANNUAL_PRICE_ID", "")

    if not price_id:
        raise HTTPException(status_code=500, detail="Price ID not configured")

    origin = data.origin_url.rstrip("/")
    success_url = f"{origin}/?success=true&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/?cancelled=true"

    referral_code = current_user.get("referred_by", "") or ""

    try:
        session = stripe_lib.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            subscription_data={"trial_period_days": 3},
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=current_user.get("email", "") or None,
            metadata={"user_id": uid, "email": current_user.get("email", ""), "plan": data.plan, "referral_code": referral_code}
        )

        # Annual price is £49.99; monthly is £12.99
        await db.payment_transactions.insert_one({
            "session_id": session.id,
            "user_id": uid,
            "email": current_user.get("email", ""),
            "plan": data.plan,
            "amount": 12.99 if data.plan == "monthly" else 49.99,
            "currency": "gbp",
            "status": "pending",
            "payment_status": "pending",
            "referral_code": referral_code,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        return {"url": session.url, "session_id": session.id}
    except stripe_lib.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to create checkout session: {str(e)}")
    except Exception as e:
        logger.error(f"Checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout session: {str(e)}")

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request, current_user: dict = Depends(get_current_user)):
    """Polling endpoint — reads payment status only. User upgrades are handled exclusively by the webhook."""
    stripe_lib.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

    # Check if already processed by webhook
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    if transaction and transaction.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "is_success": True, "already_processed": True}

    try:
        session = stripe_lib.checkout.Session.retrieve(session_id)
        payment_status = session.payment_status
        status = session.status
        is_success = (payment_status in ["paid", "no_payment_required"] and status == "complete") or payment_status == "paid"

        if is_success:
            # Mark transaction as complete — do NOT upgrade the user here; let the webhook do it
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "complete", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=False
            )

        return {"status": status, "payment_status": payment_status, "is_success": is_success}
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        return {"status": "unknown", "payment_status": "unknown", "is_success": False}

async def _find_uid_by_customer(customer_id: str) -> Optional[str]:
    txn = await db.payment_transactions.find_one({"stripe_customer_id": customer_id})
    return txn.get("user_id") if txn else None

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    stripe_lib.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    # ── Require signature verification ───────────────────────────────────────
    if not webhook_secret:
        logger.error("STRIPE_WEBHOOK_SECRET is not set — rejecting webhook to prevent unauthenticated processing")
        raise HTTPException(status_code=500, detail="Webhook secret not configured on server")

    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe_lib.Webhook.construct_event(body, sig, webhook_secret)
        payload = event
    except stripe_lib.error.SignatureVerificationError as e:
        logger.warning(f"Stripe webhook signature invalid: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook parse error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    try:
        event_type = payload.get("type", "")
        data_obj = payload.get("data", {}).get("object", {})
        logger.info(f"Stripe webhook received: {event_type}")

        if event_type == "checkout.session.completed":
            session_id = data_obj.get("id")
            payment_status = data_obj.get("payment_status")
            metadata = data_obj.get("metadata") or {}
            user_id = metadata.get("user_id")
            plan = metadata.get("plan", "monthly")
            referral_code = metadata.get("referral_code", "")
            customer_id = data_obj.get("customer")
            subscription_id = data_obj.get("subscription")

            if session_id and (payment_status in ["paid", "no_payment_required"]):
                update_fields = {
                    "payment_status": "paid",
                    "status": "complete",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
                if customer_id:
                    update_fields["stripe_customer_id"] = customer_id
                if subscription_id:
                    update_fields["stripe_subscription_id"] = subscription_id
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": update_fields}
                )
                if user_id:
                    try:
                        expires = (datetime.now(timezone.utc) + timedelta(days=30 if plan == "monthly" else 365)).isoformat()
                        await db.users.update_one(
                            {"_id": ObjectId(user_id)},
                            {"$set": {
                                "is_premium": True,
                                "premium_plan": plan,
                                "premium_since": datetime.now(timezone.utc).isoformat(),
                                "premium_expires_at": expires
                            }}
                        )
                        logger.info(f"User {user_id} upgraded to premium via webhook (plan: {plan})")
                    except Exception as e:
                        logger.error(f"Failed to upgrade user {user_id} via webhook: {e}")

        elif event_type == "customer.subscription.trial_will_end":
            customer_id = data_obj.get("customer")
            logger.info(f"Trial will end soon for Stripe customer: {customer_id}")

        elif event_type == "customer.subscription.updated":
            sub_status = data_obj.get("status", "")
            customer_id = data_obj.get("customer")
            plan_id = None
            try:
                plan_id = data_obj.get("items", {}).get("data", [{}])[0].get("price", {}).get("id")
            except Exception:
                pass
            if customer_id:
                uid = await _find_uid_by_customer(customer_id)
                if uid:
                    if sub_status == "active":
                        is_annual = plan_id == os.environ.get("STRIPE_ANNUAL_PRICE_ID", "")
                        days = 365 if is_annual else 30
                        await db.users.update_one(
                            {"_id": ObjectId(uid)},
                            {"$set": {"is_premium": True, "premium_expires_at": (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()}}
                        )
                    elif sub_status in ("canceled", "unpaid", "past_due"):
                        await db.users.update_one(
                            {"_id": ObjectId(uid)},
                            {"$set": {"is_premium": False}}
                        )
                        logger.info(f"User {uid} premium paused — sub status: {sub_status}")

        elif event_type == "customer.subscription.deleted":
            customer_id = data_obj.get("customer")
            if customer_id:
                uid = await _find_uid_by_customer(customer_id)
                if uid:
                    await db.users.update_one(
                        {"_id": ObjectId(uid)},
                        {"$set": {"is_premium": False, "premium_expires_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    logger.info(f"User {uid} downgraded — subscription deleted")

        elif event_type == "invoice.payment_succeeded":
            customer_id = data_obj.get("customer")
            plan = "monthly"
            try:
                price_id = data_obj.get("lines", {}).get("data", [{}])[0].get("price", {}).get("id", "")
                if price_id == os.environ.get("STRIPE_ANNUAL_PRICE_ID", ""):
                    plan = "annual"
            except Exception:
                pass
            if customer_id:
                uid = await _find_uid_by_customer(customer_id)
                if uid:
                    days = 365 if plan == "annual" else 30
                    expires = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
                    await db.users.update_one(
                        {"_id": ObjectId(uid)},
                        {"$set": {"is_premium": True, "premium_expires_at": expires}}
                    )
                    logger.info(f"Premium renewed for user {uid} ({plan}, +{days}d)")

        elif event_type == "invoice.payment_failed":
            customer_id = data_obj.get("customer")
            attempt_count = data_obj.get("attempt_count", 1)
            if customer_id:
                uid = await _find_uid_by_customer(customer_id)
                if uid:
                    if attempt_count >= 3:
                        await db.users.update_one(
                            {"_id": ObjectId(uid)},
                            {"$set": {"is_premium": False}}
                        )
                        logger.warning(f"User {uid} premium revoked after {attempt_count} failed payment attempts")
                    else:
                        logger.warning(f"Payment failed for user {uid} (attempt {attempt_count}) — keeping premium for now")

        return {"received": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        return {"received": True}

@api_router.post("/payments/portal")
async def create_portal_session(current_user: dict = Depends(get_current_user)):
    stripe_lib.api_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if not stripe_lib.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    uid = current_user.get("id") or current_user.get("_id")
    email = current_user.get("email", "")
    txn = await db.payment_transactions.find_one({"user_id": uid, "payment_status": "paid"})
    customer_id = txn.get("stripe_customer_id") if txn else None
    if not customer_id:
        try:
            customers = stripe_lib.Customer.list(email=email, limit=1)
            if customers.data:
                customer_id = customers.data[0].id
        except Exception:
            pass
    if not customer_id:
        raise HTTPException(status_code=404, detail="No Stripe customer found. Please contact support.")
    try:
        portal = stripe_lib.billing_portal.Session.create(
            customer=customer_id,
            return_url="https://theflourishapp.netlify.app/"
        )
        return {"url": portal.url}
    except stripe_lib.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── REFERRAL ───────────────────────────────────────────────────────────────────
@api_router.get("/referral/stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    referral_code = current_user.get("referral_code", "")
    frontend_url = os.environ.get("FRONTEND_URL", "https://theflourishapp.netlify.app")

    monthly_refs = await db.payment_transactions.count_documents({
        "referral_code": referral_code, "payment_status": "paid", "plan": "monthly"
    })
    annual_refs = await db.payment_transactions.count_documents({
        "referral_code": referral_code, "payment_status": "paid", "plan": "annual"
    })
    paying_referrals = monthly_refs + annual_refs

    return {
        "referral_code": referral_code,
        "referral_link": f"{frontend_url}?ref={referral_code}",
        "paying_referrals": paying_referrals,
        "free_months_earned": paying_referrals,
        "monthly_commission": round(monthly_refs * 12.99 * 0.30, 2),
        "annual_commission": round(annual_refs * 49.99 * 0.30, 2),
        "total_commission": round((monthly_refs * 12.99 + annual_refs * 49.99) * 0.30, 2)
    }

# ── AFFILIATE ─────────────────────────────────────────────────────────────────
@api_router.post("/affiliate/apply")
async def affiliate_apply(data: AffiliateApplicationRequest):
    existing = await db.affiliate_applications.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Application already submitted with this email")

    affiliate_code = "AFF" + str(uuid.uuid4())[:6].upper()

    app_doc = {
        "name": data.name,
        "email": data.email,
        "social_handles": data.social_handles,
        "audience_size": data.audience_size,
        "condition_niche": data.condition_niche,
        "description": data.description,
        "status": "pending",
        "affiliate_code": affiliate_code,
        "clicks": 0,
        "signups": 0,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.affiliate_applications.insert_one(app_doc)
    return {"success": True, "id": str(result.inserted_id), "affiliate_code": affiliate_code}

@api_router.get("/affiliate/dashboard")
async def affiliate_dashboard(ref: str, current_user: dict = Depends(get_current_user)):
    """Affiliate dashboard — requires authentication to prevent enumeration of affiliate data."""
    aff = await db.affiliate_applications.find_one({"affiliate_code": ref})
    if not aff:
        return {
            "name": "Affiliate",
            "status": "pending",
            "affiliate_code": ref,
            "clicks": 0,
            "signups": 0,
            "paying_subscribers": 0,
            "commission_earned": 0.0,
            "commission_pending": 0.0
        }

    monthly_subs = await db.payment_transactions.count_documents({"referral_code": ref, "payment_status": "paid", "plan": "monthly"})
    annual_subs = await db.payment_transactions.count_documents({"referral_code": ref, "payment_status": "paid", "plan": "annual"})
    paying_subs = monthly_subs + annual_subs
    total_commission = round((monthly_subs * 12.99 + annual_subs * 49.99) * 0.30, 2)

    return {
        "name": aff.get("name", ""),
        "status": aff.get("status", "pending"),
        "affiliate_code": ref,
        "clicks": aff.get("clicks", 0),
        "signups": aff.get("signups", 0),
        "paying_subscribers": paying_subs,
        "monthly_subscribers": monthly_subs,
        "annual_subscribers": annual_subs,
        "commission_earned": total_commission,
        "commission_pending": total_commission
    }

@api_router.post("/affiliate/track-click")
async def track_affiliate_click(request: Request):
    body = await request.json()
    ref = body.get("ref", "")
    if ref:
        await db.affiliate_applications.update_one(
            {"affiliate_code": ref},
            {"$inc": {"clicks": 1}}
        )
    return {"success": True}

# ── ADMIN ─────────────────────────────────────────────────────────────────────
@api_router.post("/admin/login")
@limiter.limit("3/minute")
async def admin_login(request: Request, data: AdminLoginRequest):
    admin_password = os.environ.get("ADMIN_PASSWORD")
    if not admin_password or data.password != admin_password:
        raise HTTPException(status_code=401, detail="Invalid admin password")
    if not ADMIN_SESSION_TOKEN:
        raise HTTPException(status_code=500, detail="ADMIN_SESSION_TOKEN not configured on server — set it in Railway env vars")
    return {"success": True, "token": ADMIN_SESSION_TOKEN}

@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    _verify_admin(request)
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    premium_users = await db.users.count_documents({"is_premium": True})
    monthly_subs = await db.users.count_documents({"premium_plan": "monthly", "is_premium": True})
    annual_subs = await db.users.count_documents({"premium_plan": "annual", "is_premium": True})
    # Annual price is £49.99
    monthly_revenue = round(monthly_subs * 12.99 + annual_subs * 49.99 / 12, 2)
    pending_affiliates = await db.affiliate_applications.count_documents({"status": "pending"})

    return {
        "total_users": total_users,
        "premium_subscribers": premium_users,
        "monthly_revenue": monthly_revenue,
        "pending_affiliates": pending_affiliates,
        "monthly_subs": monthly_subs,
        "annual_subs": annual_subs
    }

@api_router.get("/admin/users")
async def admin_users(request: Request):
    _verify_admin(request)
    users = await db.users.find({"role": {"$ne": "admin"}}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    return {"users": [doc_to_dict(u) for u in users]}

@api_router.get("/admin/transactions")
async def admin_transactions(request: Request):
    _verify_admin(request)
    txns = await db.payment_transactions.find().sort("created_at", -1).to_list(500)
    return {"transactions": [doc_to_dict(t) for t in txns]}

@api_router.get("/admin/affiliates")
async def admin_affiliates(request: Request):
    _verify_admin(request)
    apps = await db.affiliate_applications.find().sort("submitted_at", -1).to_list(500)
    return {"applications": [doc_to_dict(a) for a in apps]}

@api_router.put("/admin/affiliates/{app_id}/status")
async def update_affiliate_status(app_id: str, request: Request):
    _verify_admin(request)
    oid_val = safe_object_id(app_id)
    body = await request.json()
    status = body.get("status")
    if status not in ["pending", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.affiliate_applications.update_one(
        {"_id": oid_val},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

@api_router.get("/admin/activity")
async def admin_activity(request: Request):
    _verify_admin(request)
    thirty_days_ago = (datetime.now(timezone.utc).date() - timedelta(days=30)).isoformat()
    pipeline = [
        {"$match": {"date": {"$gte": thirty_days_ago}}},
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    activity = await db.diary.aggregate(pipeline).to_list(30)
    return {"activity": [{"date": a["_id"], "count": a["count"]} for a in activity]}

# ── OPEN FOOD FACTS ────────────────────────────────────────────────────────────
@api_router.get("/food/barcode/{barcode}")
async def lookup_barcode(barcode: str):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json")
            data = resp.json()

        if data.get("status") != 1:
            return {"found": False, "message": "Product not found in our database. Try searching by name instead."}

        product = data.get("product", {})
        ingredients = product.get("ingredients_text", "") or product.get("ingredients_text_en", "")
        image_url = product.get("image_url", "") or product.get("image_front_url", "")

        return {
            "found": True,
            "name": product.get("product_name", "") or product.get("product_name_en", "Unknown Product"),
            "ingredients": ingredients[:500] if ingredients else "",
            "image_url": image_url,
            "barcode": barcode
        }
    except Exception as e:
        logger.error(f"Barcode lookup error: {e}")
        return {"found": False, "message": "Could not fetch product data. Try searching by name."}

# ── Health check ───────────────────────────────────────────────────────────────
@api_router.get("/")
async def root():
    return {"message": "Flourish API", "status": "healthy"}

app.include_router(api_router)
