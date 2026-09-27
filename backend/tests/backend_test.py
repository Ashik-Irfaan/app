"""Mind Well backend API test suite (pytest)."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mindwell-wellness-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PERSONNEL_ID = "CRPF-1001"
PERSONNEL_HIGH = "CRPF-1002"
PERSONNEL_PWD = "Mindwell@123"
THERAPIST_EMAIL = "dr.meera@mindwell.in"
THERAPIST_PWD = "Therapist@123"


# ------------------------ fixtures
@pytest.fixture(scope="session")
def s():
    return requests.Session()


def _login(s, identifier, password, role):
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password, "role": role}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def personnel_token(s):
    return _login(s, PERSONNEL_ID, PERSONNEL_PWD, "personnel")["access_token"]


@pytest.fixture(scope="session")
def personnel_high_token(s):
    return _login(s, PERSONNEL_HIGH, PERSONNEL_PWD, "personnel")["access_token"]


@pytest.fixture(scope="session")
def therapist_token(s):
    return _login(s, THERAPIST_EMAIL, THERAPIST_PWD, "therapist")["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ------------------------ auth
class TestAuth:
    def test_login_personnel(self, s):
        d = _login(s, PERSONNEL_ID, PERSONNEL_PWD, "personnel")
        assert d["user"]["role"] == "personnel"
        assert d["user"]["service_id"] == PERSONNEL_ID
        assert "access_token" in d

    def test_login_therapist(self, s):
        d = _login(s, THERAPIST_EMAIL, THERAPIST_PWD, "therapist")
        assert d["user"]["role"] == "therapist"
        assert d["user"]["email"] == THERAPIST_EMAIL

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"identifier": PERSONNEL_ID, "password": "wrong-pass", "role": "personnel"})
        assert r.status_code == 401

    def test_login_role_mismatch(self, s):
        r = s.post(f"{API}/auth/login", json={"identifier": PERSONNEL_ID, "password": PERSONNEL_PWD, "role": "therapist"})
        assert r.status_code == 401

    def test_register_personnel_and_duplicate(self, s):
        sid = f"CRPF-TEST-{uuid.uuid4().hex[:6].upper()}"
        payload = {"role": "personnel", "name": "TEST User", "password": "Passw0rd!", "service_id": sid, "unit": "TEST"}
        r = s.post(f"{API}/auth/register", json=payload)
        assert r.status_code == 201, r.text
        assert r.json()["user"]["service_id"] == sid.upper()
        r2 = s.post(f"{API}/auth/register", json=payload)
        assert r2.status_code == 409

    def test_register_therapist(self, s):
        email = f"test_{uuid.uuid4().hex[:8]}@mindwell.in"
        r = s.post(f"{API}/auth/register", json={"role": "therapist", "name": "TEST Dr", "password": "Passw0rd!", "email": email})
        assert r.status_code == 201
        assert r.json()["user"]["email"] == email

    def test_me(self, s, personnel_token):
        r = s.get(f"{API}/auth/me", headers=_h(personnel_token))
        assert r.status_code == 200
        assert r.json()["role"] == "personnel"

    def test_consent_toggle(self, s, personnel_token):
        r = s.put(f"{API}/auth/consent", headers=_h(personnel_token), json={"consent": False})
        assert r.status_code == 200
        assert r.json()["consent"] is False
        r = s.put(f"{API}/auth/consent", headers=_h(personnel_token), json={"consent": True})
        assert r.json()["consent"] is True


# ------------------------ assessment
class TestAssessment:
    def test_get_questions(self, s):
        r = s.get(f"{API}/assessment/questions")
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 12
        assert all("id" in q and "options" in q and len(q["options"]) == 4 for q in data)
        assert all("weight" not in q for q in data)

    def test_missing_answers_400(self, s, personnel_token):
        r = s.post(f"{API}/assessments", headers=_h(personnel_token), json={"answers": {"sleep": 1}})
        assert r.status_code == 400

    def test_submit_all_zero_low(self, s, personnel_token):
        answers = {q["id"]: 0 for q in s.get(f"{API}/assessment/questions").json()}
        r = s.post(f"{API}/assessments", headers=_h(personnel_token), json={"answers": answers})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["level"] == "low"
        assert d["score"] < 35
        assert d["alert_created"] is False
        assert isinstance(d.get("top_factors"), list)
        assert isinstance(d.get("actions"), list) and len(d["actions"]) > 0

    def test_submit_all_three_high_creates_alert(self, s, personnel_token):
        answers = {q["id"]: 3 for q in s.get(f"{API}/assessment/questions").json()}
        r = s.post(f"{API}/assessments", headers=_h(personnel_token), json={"answers": answers})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["level"] == "high"
        assert d["score"] >= 60
        assert d["alert_created"] is True

    def test_history_and_by_id(self, s, personnel_token):
        r = s.get(f"{API}/assessments/history", headers=_h(personnel_token))
        assert r.status_code == 200
        hist = r.json()
        assert len(hist) > 0
        aid = hist[-1]["id"]
        r2 = s.get(f"{API}/assessments/{aid}", headers=_h(personnel_token))
        assert r2.status_code == 200
        assert "score" in r2.json() and "level" in r2.json()

    def test_dashboard(self, s, personnel_token):
        r = s.get(f"{API}/dashboard", headers=_h(personnel_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["history", "latest", "today", "wearable", "support_requested", "user"]:
            assert k in d

    def test_therapist_cannot_submit(self, s, therapist_token):
        r = s.post(f"{API}/assessments", headers=_h(therapist_token), json={"answers": {}})
        assert r.status_code == 403


# ------------------------ wearable
class TestWearable:
    def test_wearable_status_initial(self, s, personnel_token):
        r = s.get(f"{API}/wearable", headers=_h(personnel_token))
        assert r.status_code == 200

    def test_connect_disconnect(self, s, personnel_token):
        r = s.post(f"{API}/wearable/connect", headers=_h(personnel_token), json={"device": "Apple Watch S9"})
        assert r.status_code == 200
        d = r.json()
        assert d["connected"] is True
        assert d["device"] == "Apple Watch S9"
        assert d["reading"]["heart_rate"] > 0
        r2 = s.post(f"{API}/wearable/disconnect", headers=_h(personnel_token))
        assert r2.status_code == 200
        assert r2.json()["connected"] is False


# ------------------------ chat
class TestChat:
    def test_chat_history_empty_or_list(self, s, personnel_token):
        s.delete(f"{API}/chat/history", headers=_h(personnel_token))
        r = s.get(f"{API}/chat/history", headers=_h(personnel_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_chat_message_llm(self, s, personnel_token):
        r = s.post(f"{API}/chat/message", headers=_h(personnel_token),
                   json={"message": "Hi Mitra, quick hello!"}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "assistant"
        assert isinstance(d["content"], str) and len(d["content"]) > 0

    def test_clear_chat(self, s, personnel_token):
        r = s.delete(f"{API}/chat/history", headers=_h(personnel_token))
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ------------------------ support
class TestSupport:
    def test_support_request(self, s, personnel_token):
        r = s.post(f"{API}/support/request", headers=_h(personnel_token))
        assert r.status_code == 200
        assert r.json()["ok"] is True


# ------------------------ therapist
class TestTherapist:
    def test_overview(self, s, therapist_token):
        r = s.get(f"{API}/therapist/overview", headers=_h(therapist_token))
        assert r.status_code == 200
        d = r.json()
        assert "counts" in d and "personnel" in d
        assert all("anon_id" in p and p["anon_id"].startswith("MW-") for p in d["personnel"])

    def test_personnel_forbidden(self, s, personnel_token):
        r = s.get(f"{API}/therapist/overview", headers=_h(personnel_token))
        assert r.status_code == 403

    def test_alerts_and_followup(self, s, therapist_token, personnel_high_token):
        r = s.get(f"{API}/therapist/alerts", headers=_h(therapist_token))
        assert r.status_code == 200
        alerts = r.json()
        open_alerts = [a for a in alerts if a["status"] == "open"]
        if not open_alerts:
            pytest.skip("No open alerts to follow up")
        aid = open_alerts[0]["id"]
        r2 = s.post(f"{API}/therapist/alerts/{aid}/followup", headers=_h(therapist_token),
                    json={"note": "TEST followup note"})
        assert r2.status_code == 200
        r3 = s.get(f"{API}/therapist/alerts", headers=_h(therapist_token))
        matched = [a for a in r3.json() if a["id"] == aid][0]
        assert matched["status"] == "followed_up"
        assert matched["followup_note"] == "TEST followup note"

    def test_personnel_detail(self, s, therapist_token):
        overview = s.get(f"{API}/therapist/overview", headers=_h(therapist_token)).json()
        if not overview["personnel"]:
            pytest.skip("No personnel to load detail")
        uref = overview["personnel"][0]["user_ref"]
        r = s.get(f"{API}/therapist/personnel/{uref}", headers=_h(therapist_token))
        assert r.status_code == 200
        d = r.json()
        assert d["anon_id"].startswith("MW-")
        assert "history" in d and "alerts" in d
