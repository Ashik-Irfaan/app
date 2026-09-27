import hashlib
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, Any, Literal, Optional

import bcrypt
import jwt
from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

from risk_engine import QUESTIONS, compute_risk
from seed import seed

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("mindwell")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ.get("JWT_ISSUER", "mindwell-api")
JWT_ALGORITHM = "HS256"
JWT_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "720"))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

Role = Literal["personnel", "therapist"]
PyObjectId = Annotated[str, BeforeValidator(str)]


def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(400, "Password is too long")
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


@asynccontextmanager
async def lifespan(_: FastAPI):
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("service_id", unique=True, sparse=True)
    await db.assessments.create_index([("user_id", 1), ("created_at", -1)])
    await db.chat_messages.create_index([("user_id", 1), ("created_at", 1)])
    await seed(db, hash_password)
    logger.info("Seed complete")
    yield
    client.close()


app = FastAPI(title="Mind Well API", lifespan=lifespan)
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------- models
class BaseDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: Optional[PyObjectId] = None

    @classmethod
    def from_mongo(cls, doc: dict):
        data = {k: v for k, v in doc.items() if k != "_id"}
        data["id"] = str(doc["_id"])
        return cls(**data)


class PublicUser(BaseDocument):
    name: str
    role: Role
    email: Optional[str] = None
    service_id: Optional[str] = None
    unit: Optional[str] = None
    consent: bool = True
    wearable: dict = Field(default_factory=lambda: {"connected": False, "device": None})
    anon_id: Optional[str] = None


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=2, max_length=254)
    password: str = Field(min_length=6, max_length=128)
    role: Role


class RegisterRequest(BaseModel):
    role: Role
    name: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=8, max_length=128)
    service_id: Optional[str] = Field(default=None, min_length=4, max_length=40)
    unit: Optional[str] = Field(default=None, max_length=80)
    email: Optional[str] = Field(default=None, max_length=254)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: PublicUser


class AssessmentSubmit(BaseModel):
    answers: dict[str, int]


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ConsentUpdate(BaseModel):
    consent: bool


class WearableConnect(BaseModel):
    device: str = Field(min_length=2, max_length=60)


class FollowupRequest(BaseModel):
    note: str = Field(min_length=1, max_length=500)


# ---------------------------------------------------------------- helpers
def anon_id_for(user_id: str) -> str:
    return "MW-" + hashlib.sha256(user_id.encode()).hexdigest()[:4].upper()


def public_user(doc: dict) -> PublicUser:
    u = PublicUser.from_mongo(doc)
    u.anon_id = anon_id_for(str(doc["_id"]))
    return u


def make_token(user: dict) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user["_id"]), "role": user["role"], "iss": JWT_ISSUER, "iat": now,
               "exp": now + timedelta(minutes=JWT_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def current_user(credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)]):
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "Missing bearer token")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM], issuer=JWT_ISSUER,
                             options={"require": ["sub", "exp", "iat", "iss", "role"]})
        user = await db.users.find_one({"_id": ObjectId(payload["sub"]), "is_active": True})
    except (jwt.InvalidTokenError, ValueError):
        user = None
    if not user or user["role"] != payload.get("role"):
        raise HTTPException(401, "Invalid or expired token")
    return user


def require_role(role: Role):
    async def dep(user=Depends(current_user)):
        if user["role"] != role:
            raise HTTPException(403, "Insufficient role")
        return user
    return dep


def serialize_assessment(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "score": doc["score"],
        "level": doc["level"],
        "top_factors": doc.get("top_factors", []),
        "heart_rate": doc.get("heart_rate"),
        "created_at": doc["created_at"].isoformat(),
    }


def simulated_heart_rate(user_id: str, latest_level: str | None) -> dict:
    """Deterministic simulated live wearable reading for the prototype."""
    seed_val = int(hashlib.md5((user_id + datetime.now(timezone.utc).strftime("%Y%m%d%H")).encode()).hexdigest(), 16)
    base = {"high": 92, "medium": 80, "low": 68}.get(latest_level or "low", 70)
    resting = base + (seed_val % 9) - 4
    return {
        "heart_rate": resting,
        "hrv_ms": max(20, 70 - (resting - 60)),
        "sleep_hours": round(max(4.0, 8.2 - (resting - 60) / 10), 1),
        "steps": 4200 + (seed_val % 5000),
        "status": "elevated" if resting > 90 else ("moderate" if resting > 80 else "normal"),
        "trend": [max(55, resting - 6 + ((seed_val >> (i * 3)) % 11)) for i in range(12)],
    }


# ---------------------------------------------------------------- auth
@api.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    ident = body.identifier.strip()
    user = await db.users.find_one({"$or": [{"email": ident.lower()}, {"service_id": ident.upper()}]})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    if user["role"] != body.role:
        raise HTTPException(401, "Invalid credentials for the selected role")
    if not user.get("is_active", True):
        raise HTTPException(403, "Account is disabled")
    return TokenResponse(access_token=make_token(user), user=public_user(user))


@api.post("/auth/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    doc: dict[str, Any] = {
        "name": body.name.strip(), "role": body.role, "is_active": True, "consent": True,
        "password_hash": hash_password(body.password),
        "wearable": {"connected": False, "device": None},
        "created_at": datetime.now(timezone.utc),
    }
    if body.role == "personnel":
        if not body.service_id:
            raise HTTPException(400, "Service ID is required for personnel")
        doc["service_id"] = body.service_id.strip().upper()
        doc["unit"] = (body.unit or "").strip() or None
    else:
        if not body.email or "@" not in body.email:
            raise HTTPException(400, "A valid email is required for therapists")
        doc["email"] = body.email.strip().lower()
    try:
        res = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this ID already exists")
    doc["_id"] = res.inserted_id
    return TokenResponse(access_token=make_token(doc), user=public_user(doc))


@api.get("/auth/me", response_model=PublicUser)
async def me(user=Depends(current_user)):
    return public_user(user)


@api.put("/auth/consent", response_model=PublicUser)
async def update_consent(body: ConsentUpdate, user=Depends(current_user)):
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"consent": body.consent}})
    user["consent"] = body.consent
    return public_user(user)


# ---------------------------------------------------------------- assessments (personnel)
@api.get("/assessment/questions")
async def get_questions():
    return [{k: v for k, v in q.items() if k != "weight"} for q in QUESTIONS]


@api.post("/assessments")
async def submit_assessment(body: AssessmentSubmit, user=Depends(require_role("personnel"))):
    missing = [q["id"] for q in QUESTIONS if q["id"] not in body.answers]
    if missing:
        raise HTTPException(400, f"Missing answers: {', '.join(missing)}")
    hr = None
    if user.get("wearable", {}).get("connected"):
        latest = await db.assessments.find_one({"user_id": str(user["_id"])}, sort=[("created_at", -1)])
        hr = simulated_heart_rate(str(user["_id"]), latest["level"] if latest else None)["heart_rate"]
    result = compute_risk(body.answers, hr)
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": str(user["_id"]), "answers": body.answers, "score": result["score"],
        "level": result["level"], "top_factors": result["top_factors"], "heart_rate": hr, "created_at": now,
    }
    res = await db.assessments.insert_one(doc)
    alert_created = False
    if result["level"] == "high":
        await db.alerts.insert_one({
            "user_id": str(user["_id"]), "assessment_id": str(res.inserted_id), "score": result["score"],
            "level": "high", "top_factors": result["top_factors"], "status": "open", "created_at": now,
            "followup_note": None, "followed_up_at": None,
        })
        alert_created = True
    return {"id": str(res.inserted_id), "created_at": now.isoformat(), "alert_created": alert_created, **result}


@api.get("/assessments/history")
async def assessment_history(user=Depends(require_role("personnel"))):
    docs = await db.assessments.find({"user_id": str(user["_id"])}).sort("created_at", 1).to_list(200)
    return [serialize_assessment(d) for d in docs]


@api.get("/assessments/{assessment_id}")
async def get_assessment(assessment_id: str, user=Depends(require_role("personnel"))):
    try:
        doc = await db.assessments.find_one({"_id": ObjectId(assessment_id), "user_id": str(user["_id"])})
    except Exception:
        doc = None
    if not doc:
        raise HTTPException(404, "Assessment not found")
    result = compute_risk(doc["answers"], doc.get("heart_rate"))
    return {"id": str(doc["_id"]), "created_at": doc["created_at"].isoformat(), **result}


@api.get("/dashboard")
async def personnel_dashboard(user=Depends(require_role("personnel"))):
    docs = await db.assessments.find({"user_id": str(user["_id"])}).sort("created_at", 1).to_list(200)
    history = [serialize_assessment(d) for d in docs]
    latest = docs[-1] if docs else None
    today = None
    if latest:
        a = latest["answers"]
        labels = {0: "Good", 1: "Fair", 2: "Poor", 3: "Very poor"}
        wl = {0: "Light", 1: "Moderate", 2: "Heavy", 3: "Very heavy"}
        mood = {0: "Good", 1: "Okay", 2: "Low", 3: "Very low"}
        today = {"sleep": labels[a.get("sleep", 0)], "workload": wl[a.get("workload", 0)], "mood": mood[a.get("mood", 0)]}
    wearable = user.get("wearable", {"connected": False})
    hr = simulated_heart_rate(str(user["_id"]), latest["level"] if latest else None) if wearable.get("connected") else None
    open_alert = await db.alerts.find_one({"user_id": str(user["_id"]), "status": "open"})
    return {
        "user": public_user(user).model_dump(),
        "latest": serialize_assessment(latest) if latest else None,
        "history": history,
        "today": today,
        "wearable": {**wearable, "reading": hr},
        "support_requested": bool(open_alert),
    }


# ---------------------------------------------------------------- wearable
@api.get("/wearable")
async def wearable_status(user=Depends(require_role("personnel"))):
    wearable = user.get("wearable", {"connected": False, "device": None})
    latest = await db.assessments.find_one({"user_id": str(user["_id"])}, sort=[("created_at", -1)])
    reading = simulated_heart_rate(str(user["_id"]), latest["level"] if latest else None) if wearable.get("connected") else None
    return {**wearable, "reading": reading}


@api.post("/wearable/connect")
async def wearable_connect(body: WearableConnect, user=Depends(require_role("personnel"))):
    wearable = {"connected": True, "device": body.device, "connected_at": datetime.now(timezone.utc).isoformat()}
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"wearable": wearable}})
    latest = await db.assessments.find_one({"user_id": str(user["_id"])}, sort=[("created_at", -1)])
    return {**wearable, "reading": simulated_heart_rate(str(user["_id"]), latest["level"] if latest else None)}


@api.post("/wearable/disconnect")
async def wearable_disconnect(user=Depends(require_role("personnel"))):
    wearable = {"connected": False, "device": None}
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"wearable": wearable}})
    return {**wearable, "reading": None}


# ---------------------------------------------------------------- AI chat
SYSTEM_PROMPT = (
    "You are 'Mitra', the friendly wellness companion inside the Mind Well app for uniformed forces personnel "
    "(CRPF, CAPFs, Armed Forces, police). Have warm, natural, motivating conversations. Be encouraging, "
    "respectful of their service, and practical. Keep replies short (2-5 sentences), conversational, and positive. "
    "Offer simple, actionable wellness tips (breathing, sleep, connecting with family, small wins) when relevant. "
    "You are NOT a doctor or therapist and never diagnose. If someone expresses thoughts of self-harm, hopelessness "
    "or crisis, respond with compassion and gently encourage them to contact a Mind Well counsellor immediately via the "
    "'Talk to Counsellor' option, or Tele-MANAS helpline 14416 (India). Never be preachy; sound like a supportive friend."
)


@api.get("/chat/history")
async def chat_history(user=Depends(require_role("personnel"))):
    docs = await db.chat_messages.find({"user_id": str(user["_id"]), "deleted_at": None}).sort("created_at", 1).to_list(200)
    return [{"id": str(d["_id"]), "role": d["role"], "content": d["content"], "created_at": d["created_at"].isoformat()}
            for d in docs]


@api.post("/chat/message")
async def chat_message(body: ChatRequest, user=Depends(require_role("personnel"))):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "AI companion is not configured")
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    uid = str(user["_id"])
    prior = await db.chat_messages.find({"user_id": uid, "deleted_at": None}).sort("created_at", -1).to_list(20)
    prior.reverse()
    system = SYSTEM_PROMPT + f" The user's name is {user.get('name', 'friend')}."
    initial = [{"role": "system", "content": system}]
    initial += [{"role": d["role"], "content": d["content"]} for d in prior]

    now = datetime.now(timezone.utc)
    await db.chat_messages.insert_one({"user_id": uid, "role": "user", "content": body.message,
                                       "created_at": now, "deleted_at": None})
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"mindwell-{uid}", system_message=system,
                       initial_messages=initial).with_model("openai", "gpt-5.4-mini")
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as e:  # noqa: BLE001
        logger.exception("LLM error")
        raise HTTPException(502, f"AI companion unavailable: {e}")
    reply_doc = {"user_id": uid, "role": "assistant", "content": reply,
                 "created_at": datetime.now(timezone.utc), "deleted_at": None}
    res = await db.chat_messages.insert_one(reply_doc)
    return {"id": str(res.inserted_id), "role": "assistant", "content": reply,
            "created_at": reply_doc["created_at"].isoformat()}


@api.delete("/chat/history")
async def clear_chat(user=Depends(require_role("personnel"))):
    await db.chat_messages.update_many({"user_id": str(user["_id"]), "deleted_at": None},
                                       {"$set": {"deleted_at": datetime.now(timezone.utc)}})
    return {"ok": True}


# ---------------------------------------------------------------- support request (personnel → counsellor)
@api.post("/support/request")
async def request_support(user=Depends(require_role("personnel"))):
    existing = await db.alerts.find_one({"user_id": str(user["_id"]), "status": "open"})
    if existing:
        return {"ok": True, "already_open": True}
    latest = await db.assessments.find_one({"user_id": str(user["_id"])}, sort=[("created_at", -1)])
    await db.alerts.insert_one({
        "user_id": str(user["_id"]), "assessment_id": str(latest["_id"]) if latest else None,
        "score": latest["score"] if latest else None, "level": latest["level"] if latest else "unknown",
        "top_factors": latest.get("top_factors", []) if latest else [], "status": "open", "source": "self_request",
        "created_at": datetime.now(timezone.utc), "followup_note": None, "followed_up_at": None,
    })
    return {"ok": True, "already_open": False}


# ---------------------------------------------------------------- therapist
async def _personnel_summaries():
    users = await db.users.find({"role": "personnel", "is_active": True}).to_list(500)
    out = []
    for u in users:
        uid = str(u["_id"])
        docs = await db.assessments.find({"user_id": uid}).sort("created_at", -1).to_list(2)
        if not docs:
            continue
        latest = docs[0]
        prev = docs[1] if len(docs) > 1 else None
        trend = "stable"
        if prev:
            diff = latest["score"] - prev["score"]
            trend = "rising" if diff > 5 else ("improving" if diff < -5 else "stable")
        open_alert = await db.alerts.find_one({"user_id": uid, "status": "open"})
        out.append({
            "anon_id": anon_id_for(uid), "user_ref": uid, "unit": u.get("unit"),
            "score": latest["score"], "level": latest["level"], "trend": trend,
            "last_assessed": latest["created_at"].isoformat(),
            "top_factors": latest.get("top_factors", [])[:2], "has_open_alert": bool(open_alert),
            "wearable_connected": bool(u.get("wearable", {}).get("connected")),
        })
    order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda p: (order[p["level"]], -p["score"]))
    return out


@api.get("/therapist/overview")
async def therapist_overview(_=Depends(require_role("therapist"))):
    summaries = await _personnel_summaries()
    counts = {"high": 0, "medium": 0, "low": 0}
    for s in summaries:
        counts[s["level"]] += 1
    open_alerts = await db.alerts.count_documents({"status": "open"})
    followed = await db.alerts.count_documents({"status": "followed_up"})
    return {"counts": counts, "total": len(summaries), "open_alerts": open_alerts, "followed_up": followed,
            "personnel": summaries}


@api.get("/therapist/alerts")
async def therapist_alerts(_=Depends(require_role("therapist"))):
    docs = await db.alerts.find().sort("created_at", -1).to_list(200)
    out = []
    for d in docs:
        u = await db.users.find_one({"_id": ObjectId(d["user_id"])})
        out.append({
            "id": str(d["_id"]), "anon_id": anon_id_for(d["user_id"]), "user_ref": d["user_id"],
            "unit": u.get("unit") if u else None, "score": d.get("score"), "level": d.get("level"),
            "status": d["status"], "source": d.get("source", "ai_detection"),
            "top_factors": d.get("top_factors", []), "created_at": d["created_at"].isoformat(),
            "followup_note": d.get("followup_note"),
            "followed_up_at": d["followed_up_at"].isoformat() if d.get("followed_up_at") else None,
        })
    return out


@api.post("/therapist/alerts/{alert_id}/followup")
async def mark_followup(alert_id: str, body: FollowupRequest, _=Depends(require_role("therapist"))):
    try:
        oid = ObjectId(alert_id)
    except Exception:
        raise HTTPException(404, "Alert not found")
    res = await db.alerts.update_one({"_id": oid}, {"$set": {
        "status": "followed_up", "followup_note": body.note, "followed_up_at": datetime.now(timezone.utc)}})
    if not res.matched_count:
        raise HTTPException(404, "Alert not found")
    return {"ok": True}


@api.get("/therapist/personnel/{user_ref}")
async def therapist_personnel_detail(user_ref: str, _=Depends(require_role("therapist"))):
    try:
        u = await db.users.find_one({"_id": ObjectId(user_ref), "role": "personnel"})
    except Exception:
        u = None
    if not u:
        raise HTTPException(404, "Personnel not found")
    docs = await db.assessments.find({"user_id": user_ref}).sort("created_at", 1).to_list(200)
    alerts = await db.alerts.find({"user_id": user_ref}).sort("created_at", -1).to_list(50)
    latest_factors = docs[-1].get("top_factors", []) if docs else []
    return {
        "anon_id": anon_id_for(user_ref), "unit": u.get("unit"),
        "wearable_connected": bool(u.get("wearable", {}).get("connected")),
        "history": [serialize_assessment(d) for d in docs],
        "top_factors": latest_factors,
        "alerts": [{"id": str(a["_id"]), "status": a["status"], "score": a.get("score"),
                    "created_at": a["created_at"].isoformat(), "followup_note": a.get("followup_note")} for a in alerts],
    }


@api.get("/")
async def root():
    return {"app": "Mind Well API", "status": "ok"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])
