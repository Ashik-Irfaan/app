"""Idempotent demo data seeding for Mind Well."""
import random
from datetime import datetime, timedelta, timezone

from risk_engine import compute_risk

DEMO_ACCOUNTS = [
    {"service_id": "CRPF-1001", "name": "Constable Arjun Singh", "unit": "112 Bn CRPF", "role": "personnel",
     "password": "Mindwell@123"},
    {"service_id": "CRPF-1002", "name": "Head Constable Ravi Kumar", "unit": "45 Bn CRPF", "role": "personnel",
     "password": "Mindwell@123"},
    {"service_id": "CRPF-1003", "name": "Constable Priya Nair", "unit": "203 Bn CRPF", "role": "personnel",
     "password": "Mindwell@123"},
    {"service_id": "CRPF-1004", "name": "SI Mohammed Faisal", "unit": "Rapid Action Force", "role": "personnel",
     "password": "Mindwell@123"},
    {"service_id": "CRPF-1005", "name": "Constable Deepak Yadav", "unit": "CoBRA 205", "role": "personnel",
     "password": "Mindwell@123"},
    {"email": "dr.meera@mindwell.in", "name": "Dr. Meera Iyer", "role": "therapist", "password": "Therapist@123"},
]

# score trajectories (approximate severity profile per assessment) per personnel
PROFILES = {
    "CRPF-1001": [0.6, 0.7, 0.9, 1.2, 1.0, 1.3, 1.1, 0.9],          # low → medium-ish
    "CRPF-1002": [1.5, 1.7, 1.9, 2.1, 2.3, 2.6],                    # rising → high
    "CRPF-1003": [0.4, 0.5, 0.3, 0.6, 0.5],                          # low
    "CRPF-1004": [1.2, 1.4, 1.6, 1.5, 1.7],                          # medium
    "CRPF-1005": [2.2, 2.4, 2.7, 2.8],                              # high
}


def _answers_for(level: float, rng: random.Random) -> dict:
    ans = {}
    for qid in ["work_hours", "night_duty", "workload", "transfers", "deployment", "leave",
                "sleep", "mood", "exhaustion", "anxiety", "family", "trauma"]:
        v = level + rng.uniform(-0.8, 0.8)
        ans[qid] = int(max(0, min(3, round(v))))
    return ans


async def seed(db, hash_password):
    rng = random.Random(42)
    now = datetime.now(timezone.utc)
    for acc in DEMO_ACCOUNTS:
        key = {"service_id": acc["service_id"]} if "service_id" in acc else {"email": acc["email"]}
        doc = {
            "name": acc["name"], "role": acc["role"], "is_active": True,
            "consent": True, "password_hash": hash_password(acc["password"]),
            "wearable": {"connected": False, "device": None},
            "created_at": now,
        }
        if "service_id" in acc:
            doc["service_id"] = acc["service_id"]
            doc["unit"] = acc["unit"]
        else:
            doc["email"] = acc["email"]
        await db.users.update_one(key, {"$setOnInsert": doc}, upsert=True)

    for sid, profile in PROFILES.items():
        user = await db.users.find_one({"service_id": sid})
        if not user:
            continue
        existing = await db.assessments.count_documents({"user_id": str(user["_id"])})
        if existing:
            continue
        n = len(profile)
        for i, lvl in enumerate(profile):
            answers = _answers_for(lvl, rng)
            result = compute_risk(answers)
            created = now - timedelta(days=(n - i) * 7)
            await db.assessments.insert_one({
                "user_id": str(user["_id"]),
                "answers": answers,
                "score": result["score"],
                "level": result["level"],
                "top_factors": result["top_factors"],
                "heart_rate": None,
                "created_at": created,
            })
            if result["level"] == "high" and i == n - 1:
                await db.alerts.insert_one({
                    "user_id": str(user["_id"]),
                    "score": result["score"],
                    "level": "high",
                    "top_factors": result["top_factors"],
                    "status": "open",
                    "created_at": created,
                    "followup_note": None,
                    "followed_up_at": None,
                })
