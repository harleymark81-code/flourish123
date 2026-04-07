from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
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
# Direct Anthropic API helper (no third-party wrapper needed)

ANTHROPIC_MODEL = "claude-3-5-haiku-20241022"

async def call_anthropic(system: str, user_msg: str) -> str:
    """Call Anthropic API directly using httpx."""
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

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Flourish API")
api_router = APIRouter(prefix="/api")

_allow_origins = [
    "https://theflourishapp.netlify.app",
    "https://69d3f4f94ab7f09ab2fa371d--lovely-chaja-e17ca9.netlify.app",
    "https://flourish123-production.up.railway.app",
    "http://localhost:3000",
]
# Allow additional origins via env var (comma-separated)
_extra = os.environ.get("CORS_ORIGINS", "")
if _extra:
    _allow_origins += [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["*"],
    max_age=86400,
)

@app.middleware("http")
async def cors_preflight_handler(request: Request, call_next):
    origin = request.headers.get("origin", "")
    allowed = origin in _allow_origins
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = origin if allowed else ""
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        response.headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Accept, Origin, X-Requested-With"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response
    response = await call_next(request)
    if allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

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

# ── Password helpers ──────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

# ── JWT helpers ────────────────────────────────────────────────────────────────
def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=30),
               "type": "access"}
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
    except:
        return None

# ── Pydantic Models ────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = ""

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

class DiaryNoteRequest(BaseModel):
    entry_id: str
    note: str

class SymptomRequest(BaseModel):
    energy: int
    bloating: int
    brain_fog: int
    mood: int
    skin: int

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

# ── Startup / Seed ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@flourish.app")
    admin_password = os.environ.get("ADMIN_PASSWORD", "Flourish2026")
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
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}}
        )

    # Write test credentials
    import os as _os
    _os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"""# Flourish Test Credentials

## Admin Account
- Email: {admin_email}
- Password: {admin_password}
- Role: admin
- Admin Dashboard: /admin (password: Flourish2026)

## Test User (create via register)
- Email: testuser@flourish.app
- Password: TestPass123

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- POST /api/auth/logout

## App URL
- https://food-wellness-score.preview.emergentagent.com
""")

@app.on_event("shutdown")
async def shutdown():
    client.close()

# ── AUTH ROUTES ───────────────────────────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: RegisterRequest, response: JSONResponse = None):
    from fastapi.responses import JSONResponse as JR
    email = data.email.lower().strip()
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
        "referred_by": None,
        "streak": 0,
        "longest_streak": 0,
        "last_active_date": None,
        "preview_24h_used": False,
        "preview_24h_expires": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = str(result.inserted_id)
    user_doc.pop("password_hash", None)
    
    token = create_access_token(str(result.inserted_id), email)
    resp = JR(content={"user": user_doc, "token": token})
    resp.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=86400*30)
    return resp

@api_router.post("/auth/login")
async def login(data: LoginRequest):
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
        # diff == 0 means same day, no change
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
    
    token = create_access_token(user_id, email)
    resp = JR(content={"user": user, "token": token})
    resp.set_cookie("access_token", token, httponly=True, secure=False, samesite="lax", max_age=86400*30)
    return resp

@api_router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return current_user

@api_router.post("/auth/logout")
async def logout():
    from fastapi.responses import JSONResponse as JR
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
    
    # Count today's ratings
    today_ratings = await db.diary.count_documents({"user_id": uid, "date": today})
    
    # Monthly avg score
    month_start = datetime.now(timezone.utc).replace(day=1).date().isoformat()
    monthly_entries = await db.diary.find({"user_id": uid, "date": {"$gte": month_start}}, {"overall_score": 1}).to_list(500)
    monthly_avg = round(sum(e.get("overall_score", 0) for e in monthly_entries) / len(monthly_entries)) if monthly_entries else 0
    
    # Get streak bonus scans
    streak = current_user.get("streak", 0)
    bonus_scans = 0
    if streak >= 3:
        bonus_scans = 2
    elif streak >= 1:
        bonus_scans = 1
    
    # Check 24h preview
    is_premium = current_user.get("is_premium", False)
    preview_active = False
    if not is_premium and current_user.get("preview_24h_expires"):
        preview_exp = datetime.fromisoformat(current_user["preview_24h_expires"].replace("Z", "+00:00")) if isinstance(current_user["preview_24h_expires"], str) else current_user["preview_24h_expires"]
        if datetime.now(timezone.utc) < preview_exp:
            preview_active = True
    
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

# ── FOOD RATING ────────────────────────────────────────────────────────────────
@api_router.post("/food/rate")
async def rate_food(data: FoodRatingRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Check daily limit for free users
    is_premium = current_user.get("is_premium", False)
    if not is_premium:
        # check 24h preview
        preview_active = False
        if current_user.get("preview_24h_expires"):
            try:
                pexp = datetime.fromisoformat(str(current_user["preview_24h_expires"]).replace("Z", "+00:00"))
                if datetime.now(timezone.utc) < pexp:
                    preview_active = True
            except:
                pass
        
        if not preview_active:
            today_count = await db.diary.count_documents({"user_id": uid, "date": today})
            streak = current_user.get("streak", 0)
            bonus = 2 if streak >= 3 else (1 if streak >= 1 else 0)
            daily_limit = FREE_DAILY_RATINGS + bonus
            if today_count >= daily_limit:
                raise HTTPException(status_code=429, detail=f"Daily limit of {daily_limit} ratings reached. Upgrade to Premium for unlimited ratings.")
    
    # Call Anthropic
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

        # Clean and parse JSON
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
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
    
    # Check if we have a tip for today
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
        return {"tip": "Focus on whole, unprocessed foods today. Your body responds best to foods it recognises and can easily process.", "date": today}

# ── MEAL PLANNER ───────────────────────────────────────────────────────────────
@api_router.post("/food/meal-plan")
async def get_meal_plan(data: MealPlanRequest, current_user: dict = Depends(get_current_user)):
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
            response_text = response_text.split("```")[1]
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
async def log_to_diary(data: dict, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()
    
    entry = {
        **data,
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
    is_premium = current_user.get("is_premium", False)
    today = datetime.now(timezone.utc).date().isoformat()
    
    query_date = date or today
    
    # Free users only see today
    if not is_premium and query_date != today:
        return {"entries": [], "locked": True, "message": "Upgrade to Premium to view your full diary history."}
    
    entries = await db.diary.find({"user_id": uid, "date": query_date}).sort("logged_at", -1).to_list(100)
    return {"entries": [doc_to_dict(e) for e in entries], "locked": False}

@api_router.get("/diary/dates")
async def get_diary_dates(current_user: dict = Depends(get_current_user)):
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
    await db.diary.update_one(
        {"_id": ObjectId(data.entry_id), "user_id": uid},
        {"$set": {"note": data.note}}
    )
    return {"success": True}

@api_router.delete("/diary/{entry_id}")
async def delete_diary_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    await db.diary.delete_one({"_id": ObjectId(entry_id), "user_id": uid})
    return {"success": True}

@api_router.get("/diary/patterns")
async def get_patterns(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    is_premium = current_user.get("is_premium", False)
    if not is_premium:
        raise HTTPException(status_code=403, detail="Premium feature")
    
    # Get last 14 days of diary + symptoms
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
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        patterns = json.loads(response_text)
        return {"patterns": patterns}
    except Exception as e:
        return {"patterns": [{"insight": "Keep logging consistently to see your personal food-symptom patterns emerge.", "type": "neutral"}]}

# ── SYMPTOMS ───────────────────────────────────────────────────────────────────
@api_router.post("/symptoms")
async def log_symptoms(data: SymptomRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Upsert today's symptoms
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
        # Check if 24h preview already used
        preview_used = current_user.get("preview_24h_used", False)
        if not preview_used:
            preview_expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            await db.users.update_one(
                {"_id": ObjectId(uid)},
                {"$set": {"preview_24h_used": True, "preview_24h_expires": preview_expires, "is_premium": True}}
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
    
    try:
        session = stripe_lib.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            subscription_data={"trial_period_days": 3},
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"user_id": uid, "email": current_user.get("email", ""), "plan": data.plan}
        )
        
        # Save pending transaction
        await db.payment_transactions.insert_one({
            "session_id": session.id,
            "user_id": uid,
            "email": current_user.get("email", ""),
            "plan": data.plan,
            "amount": 12.99 if data.plan == "monthly" else 79.0,
            "currency": "gbp",
            "status": "pending",
            "payment_status": "pending",
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
    uid = current_user.get("id") or current_user.get("_id")
    
    stripe_lib.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
    
    # Check if already processed
    transaction = await db.payment_transactions.find_one({"session_id": session_id})
    if transaction and transaction.get("payment_status") == "paid":
        return {"status": "complete", "payment_status": "paid", "already_processed": True}
    
    try:
        session = stripe_lib.checkout.Session.retrieve(session_id)
        
        payment_status = session.payment_status
        status = session.status
        # For subscription/trial: payment_status may be "no_payment_required" initially
        is_success = (payment_status in ["paid", "no_payment_required"] and status == "complete") or payment_status == "paid"
        
        if is_success:
            # Update transaction
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"status": "complete", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Upgrade user to premium
            plan = session.metadata.get("plan", "monthly") if session.metadata else "monthly"
            expires = (datetime.now(timezone.utc) + timedelta(days=30 if plan == "monthly" else 365)).isoformat()
            
            await db.users.update_one(
                {"_id": ObjectId(uid)},
                {"$set": {
                    "is_premium": True,
                    "premium_plan": plan,
                    "premium_since": datetime.now(timezone.utc).isoformat(),
                    "premium_expires_at": expires
                }}
            )
        
        return {"status": status, "payment_status": payment_status, "is_success": is_success}
    except Exception as e:
        logger.error(f"Payment status error: {e}")
        return {"status": "unknown", "payment_status": "unknown", "is_success": False}

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    stripe_lib.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
    
    try:
        payload = json.loads(body)
        event_type = payload.get("type", "")
        
        if event_type == "checkout.session.completed":
            session = payload.get("data", {}).get("object", {})
            session_id = session.get("id")
            payment_status = session.get("payment_status")
            metadata = session.get("metadata") or {}
            user_id = metadata.get("user_id")
            plan = metadata.get("plan", "monthly")
            
            if session_id and (payment_status in ["paid", "no_payment_required"]):
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": "paid", "status": "complete", "updated_at": datetime.now(timezone.utc).isoformat()}}
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

        elif event_type == "customer.subscription.deleted":
            subscription = payload.get("data", {}).get("object", {})
            sub_id = subscription.get("id")
            customer_id = subscription.get("customer")
            # Try to find user by customer_id or by looking up the transaction
            try:
                txn = await db.payment_transactions.find_one({"stripe_customer_id": customer_id})
                uid = txn.get("user_id") if txn else None
                if uid:
                    await db.users.update_one(
                        {"_id": ObjectId(uid)},
                        {"$set": {"is_premium": False, "premium_expires_at": datetime.now(timezone.utc).isoformat()}}
                    )
                    logger.info(f"User {uid} downgraded from premium via webhook (subscription deleted)")
            except Exception as e:
                logger.error(f"Failed to handle subscription deletion: {e}")

        elif event_type == "customer.subscription.updated":
            # Reactivate premium if subscription becomes active again
            subscription = payload.get("data", {}).get("object", {})
            sub_status = subscription.get("status", "")
            customer_id = subscription.get("customer")
            if sub_status == "active" and customer_id:
                try:
                    txn = await db.payment_transactions.find_one({"stripe_customer_id": customer_id})
                    if not txn:
                        # Try matching by session metadata
                        txn = await db.payment_transactions.find_one({"payment_status": "paid", "stripe_customer_id": customer_id})
                    uid = txn.get("user_id") if txn else None
                    if uid:
                        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                        await db.users.update_one(
                            {"_id": ObjectId(uid)},
                            {"$set": {"is_premium": True, "premium_expires_at": expires}}
                        )
                except Exception as e:
                    logger.error(f"Failed to handle subscription update: {e}")

        elif event_type == "invoice.payment_succeeded":
            # Extend premium on successful recurring payment
            invoice = payload.get("data", {}).get("object", {})
            customer_id = invoice.get("customer")
            if customer_id:
                try:
                    txn = await db.payment_transactions.find_one({"stripe_customer_id": customer_id})
                    uid = txn.get("user_id") if txn else None
                    if uid:
                        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                        await db.users.update_one(
                            {"_id": ObjectId(uid)},
                            {"$set": {"is_premium": True, "premium_expires_at": expires}}
                        )
                        logger.info(f"Premium renewed for user {uid} via invoice.payment_succeeded")
                except Exception as e:
                    logger.error(f"Failed to handle invoice payment: {e}")

        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}

# ── REFERRAL ───────────────────────────────────────────────────────────────────
@api_router.get("/referral/stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("id") or current_user.get("_id")
    referral_code = current_user.get("referral_code", "")
    
    # Count paying referrals
    paying_referrals = await db.payment_transactions.count_documents({
        "referral_code": referral_code,
        "payment_status": "paid"
    })
    
    return {
        "referral_code": referral_code,
        "referral_link": f"{os.environ.get('FRONTEND_URL', 'https://food-wellness-score.preview.emergentagent.com')}?ref={referral_code}",
        "paying_referrals": paying_referrals,
        "free_months_earned": paying_referrals,
        "monthly_commission": round(paying_referrals * 12.99 * 0.30, 2),
        "annual_commission": 0
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
async def affiliate_dashboard(ref: str):
    # Look up by affiliate_code
    aff = await db.affiliate_applications.find_one({"affiliate_code": ref})
    if not aff:
        # Return empty dashboard for unknown codes (don't expose 404)
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
    
    paying_subs = await db.payment_transactions.count_documents({"referral_code": ref, "payment_status": "paid"})
    monthly_commission = round(paying_subs * 12.99 * 0.30, 2)
    
    return {
        "name": aff.get("name", ""),
        "status": aff.get("status", "pending"),
        "affiliate_code": ref,
        "clicks": aff.get("clicks", 0),
        "signups": aff.get("signups", 0),
        "paying_subscribers": paying_subs,
        "commission_earned": monthly_commission,
        "commission_pending": monthly_commission  # pending until payout
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
async def admin_login(data: AdminLoginRequest):
    if data.password != os.environ.get("ADMIN_PASSWORD", "Flourish2026"):
        raise HTTPException(status_code=401, detail="Invalid admin password")
    return {"success": True, "token": "admin_" + data.password}

@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    auth = request.headers.get("X-Admin-Token", "")
    if not auth.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    premium_users = await db.users.count_documents({"is_premium": True})
    monthly_subs = await db.users.count_documents({"premium_plan": "monthly", "is_premium": True})
    annual_subs = await db.users.count_documents({"premium_plan": "annual", "is_premium": True})
    monthly_revenue = round(monthly_subs * 12.99 + (annual_subs * 84.99 / 12), 2)
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
    auth = request.headers.get("X-Admin-Token", "")
    if not auth.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    users = await db.users.find({"role": {"$ne": "admin"}}, {"password_hash": 0}).sort("created_at", -1).to_list(500)
    return {"users": [doc_to_dict(u) for u in users]}

@api_router.get("/admin/transactions")
async def admin_transactions(request: Request):
    auth = request.headers.get("X-Admin-Token", "")
    if not auth.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    txns = await db.payment_transactions.find().sort("created_at", -1).to_list(500)
    return {"transactions": [doc_to_dict(t) for t in txns]}

@api_router.get("/admin/affiliates")
async def admin_affiliates(request: Request):
    auth = request.headers.get("X-Admin-Token", "")
    if not auth.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    apps = await db.affiliate_applications.find().sort("submitted_at", -1).to_list(500)
    return {"applications": [doc_to_dict(a) for a in apps]}

@api_router.put("/admin/affiliates/{app_id}/status")
async def update_affiliate_status(app_id: str, request: Request):
    auth = request.headers.get("X-Admin-Token", "")
    if not auth.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    body = await request.json()
    status = body.get("status")
    if status not in ["pending", "approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    await db.affiliate_applications.update_one(
        {"_id": ObjectId(app_id)},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True}

@api_router.get("/admin/activity")
async def admin_activity(request: Request):
    auth = request.headers.get("X-Admin-Token", "")
    if not auth.startswith("admin_"):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    # Foods rated per day last 30 days
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
