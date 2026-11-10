# Backend regression tests: auth, RBAC, positions, employees, infraction types, daily data, reports & settings calc
import os
import uuid
import pytest
import requests
from pymongo import MongoClient
from dotenv import dotenv_values

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
            or dotenv_values("/app/frontend/.env").get("EXPO_PUBLIC_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
BENV = dotenv_values("/app/backend/.env")
MONTH = "2031-05"  # isolated month so seeded data does not interfere
DAY = f"{MONTH}-01"


def login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw})
    return r


@pytest.fixture(scope="module")
def admin():
    r = login("admin@company.dz", "Admin@123")
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return s


@pytest.fixture(scope="module")
def emp():
    r = login("employee@company.dz", "Employee@123")
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    s.user = r.json()["user"]
    return s


@pytest.fixture(scope="module")
def mongo():
    c = MongoClient(BENV["MONGO_URL"])
    yield c[BENV["DB_NAME"]]
    c.close()


@pytest.fixture(scope="module")
def setup_data(admin):
    """TEST position + employee + 3 infraction types; cleaned up at end."""
    pos = admin.post(f"{API}/positions", json={"name": "TEST_pos", "kpis": [
        {"name": "TEST_k1", "weight": 60, "target": 100}, {"name": "TEST_k2", "weight": 40, "target": 10}]})
    assert pos.status_code == 200, pos.text
    pos = pos.json()
    email = f"test_{uuid.uuid4().hex[:6]}@company.dz"
    e = admin.post(f"{API}/employees", json={"full_name": "TEST_emp", "phone": "0555123456", "email": email,
                                             "password": "Test@123", "position_id": pos["id"], "base_salary": 50000})
    assert e.status_code == 200, e.text
    e = e.json()
    types = {}
    for dt, v in (("points", 2), ("percent", 10), ("amount", 300)):
        t = admin.post(f"{API}/infraction-types", json={"name": f"TEST_{dt}", "deduction_type": dt, "value": v})
        assert t.status_code == 200
        types[dt] = t.json()
    orig_settings = admin.get(f"{API}/settings").json()
    yield {"pos": pos, "emp": e, "email": email, "types": types}
    admin.put(f"{API}/settings", json={k: v for k, v in orig_settings.items() if k != "id"})
    admin.delete(f"{API}/employees/{e['id']}")
    for t in types.values():
        admin.delete(f"{API}/infraction-types/{t['id']}")
    admin.delete(f"{API}/positions/{pos['id']}")


# --- Auth ---
class TestAuth:
    def test_admin_login_and_me(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200 and r.json()["role"] == "admin"

    def test_employee_login(self, emp):
        assert emp.user["role"] == "employee" and emp.user["employee_id"]

    def test_bad_creds(self):
        assert login("admin@company.dz", "wrong").status_code == 401
        assert requests.get(f"{API}/auth/me").status_code == 401


# --- RBAC ---
class TestRBAC:
    def test_employee_forbidden(self, emp):
        assert emp.get(f"{API}/employees").status_code == 403
        assert emp.get(f"{API}/reports/company").status_code == 403
        s = emp.get(f"{API}/settings").json()
        assert emp.put(f"{API}/settings", json={k: v for k, v in s.items() if k != "id"}).status_code == 403

    def test_me_report_own(self, emp):
        r = emp.get(f"{API}/me/report")
        assert r.status_code == 200
        assert r.json()["employee"]["id"] == emp.user["employee_id"]
        assert "employees" not in r.json()


# --- Positions ---
class TestPositions:
    def test_weight_validation(self, admin):
        r = admin.post(f"{API}/positions", json={"name": "TEST_bad", "kpis": [{"name": "a", "weight": 50, "target": 1}]})
        assert r.status_code == 400

    def test_delete_blocked_with_employees(self, admin, setup_data):
        r = admin.delete(f"{API}/positions/{setup_data['pos']['id']}")
        assert r.status_code == 400

    def test_update_position_persist(self, admin, setup_data):
        p = setup_data["pos"]
        r = admin.put(f"{API}/positions/{p['id']}", json={"name": "TEST_pos2", "kpis": p["kpis"]})
        assert r.status_code == 200
        got = [x for x in admin.get(f"{API}/positions").json() if x["id"] == p["id"]][0]
        assert got["name"] == "TEST_pos2"


# --- Employees ---
class TestEmployees:
    def test_new_employee_can_login(self, setup_data):
        r = login(setup_data["email"], "Test@123")
        assert r.status_code == 200 and r.json()["user"]["employee_id"] == setup_data["emp"]["id"]

    def test_salary_encrypted(self, mongo, setup_data):
        d = mongo.employees.find_one({"id": setup_data["emp"]["id"]})
        assert "base_salary" not in d and "50000" not in str(d.get("base_salary_enc"))
        assert "0555123456" not in str(d.get("phone_enc"))

    def test_archive_hides(self, admin, setup_data):
        e = setup_data["emp"]
        body = {"full_name": e["full_name"], "phone": e["phone"], "email": e["email"], "position_id": e["position_id"],
                "base_salary": 50000, "status": "inactive"}
        assert admin.put(f"{API}/employees/{e['id']}", json=body).status_code == 200
        ids = [x["id"] for x in admin.get(f"{API}/employees", params={"include_inactive": "false"}).json()]
        assert e["id"] not in ids
        body["status"] = "active"
        assert admin.put(f"{API}/employees/{e['id']}", json=body).status_code == 200
        ids = [x["id"] for x in admin.get(f"{API}/employees", params={"include_inactive": "false"}).json()]
        assert e["id"] in ids


# --- Daily data + calc ---
class TestCalc:
    def test_score_and_deductions(self, admin, setup_data):
        e, p, t = setup_data["emp"], setup_data["pos"], setup_data["types"]
        k1, k2 = p["kpis"][0]["id"], p["kpis"][1]["id"]
        r = admin.post(f"{API}/performance/batch", json={"employee_id": e["id"], "date": DAY, "values": [
            {"kpi_id": k1, "target": 100, "achieved": 150}, {"kpi_id": k2, "target": 10, "achieved": 5}]})
        assert r.status_code == 200
        # upsert: resend same -> no duplication
        admin.post(f"{API}/performance/batch", json={"employee_id": e["id"], "date": DAY, "values": [
            {"kpi_id": k1, "target": 100, "achieved": 150}, {"kpi_id": k2, "target": 10, "achieved": 5}]})
        assert len(admin.get(f"{API}/performance", params={"employee_id": e["id"], "date": DAY}).json()) == 2
        for dt in ("points", "percent", "amount"):
            iid = f"TEST_{dt}_{uuid.uuid4().hex[:6]}"
            body = {"id": iid, "employee_id": e["id"], "type_id": t[dt]["id"], "date": DAY}
            assert admin.post(f"{API}/infractions", json=body).status_code == 200
            assert admin.post(f"{API}/infractions", json=body).status_code == 200  # idempotent
        assert len(admin.get(f"{API}/infractions", params={"employee_id": e["id"], "month": MONTH}).json()) == 3
        rep = admin.get(f"{API}/reports/employee/{e['id']}", params={"month": MONTH}).json()
        assert rep["score"] == 92.0  # 1.2*60 + 0.5*40
        assert rep["effective_score"] == 90.0
        assert rep["gross_bonus"] == 4500.0
        assert rep["net_bonus"] == 3750.0  # -10% -300
        assert rep["fund_share"] == 187.5
        comp = admin.get(f"{API}/reports/company", params={"month": MONTH}).json()
        row = [x for x in comp["employees"] if x["employee"]["id"] == e["id"]][0]
        assert row["competitive_bonus"] == 93.75 and row["final_bonus"] == 3656.25

    def test_settings_reflected(self, admin, setup_data):
        e = setup_data["emp"]
        s = {k: v for k, v in admin.get(f"{API}/settings").json().items() if k != "id"}
        admin.put(f"{API}/settings", json={**s, "point_value": 100, "bonus_cap": 5000})
        rep = admin.get(f"{API}/reports/employee/{e['id']}", params={"month": MONTH}).json()
        assert rep["capped"] is True and rep["net_bonus"] == 5000
        admin.put(f"{API}/settings", json={**s, "max_infractions": 2})
        rep = admin.get(f"{API}/reports/employee/{e['id']}", params={"month": MONTH}).json()
        assert rep["eligible"] is False and rep["net_bonus"] == 0
        admin.put(f"{API}/settings", json={**s, "min_score": 95})
        rep = admin.get(f"{API}/reports/employee/{e['id']}", params={"month": MONTH}).json()
        assert rep["eligible"] is False
        admin.put(f"{API}/settings", json=s)

    def test_type_delete_blocked_and_toggle(self, admin, setup_data):
        t = setup_data["types"]["points"]
        assert admin.delete(f"{API}/infraction-types/{t['id']}").status_code == 400
        r = admin.put(f"{API}/infraction-types/{t['id']}", json={**{k: v for k, v in t.items() if k != "id"}, "active": False})
        assert r.status_code == 200
        got = [x for x in admin.get(f"{API}/infraction-types").json() if x["id"] == t["id"]][0]
        assert got["active"] is False

    def test_delete_infraction(self, admin, setup_data):
        e = setup_data["emp"]
        infs = admin.get(f"{API}/infractions", params={"employee_id": e["id"], "month": MONTH}).json()
        assert admin.delete(f"{API}/infractions/{infs[0]['id']}").status_code == 200
        assert len(admin.get(f"{API}/infractions", params={"employee_id": e["id"], "month": MONTH}).json()) == 2

    def test_delete_employee_removes_records(self, admin, mongo, setup_data):
        e = setup_data["emp"]
        assert admin.delete(f"{API}/employees/{e['id']}").status_code == 200
        assert mongo.performance_entries.count_documents({"employee_id": e["id"]}) == 0
        assert mongo.infractions.count_documents({"employee_id": e["id"]}) == 0
        assert login(setup_data["email"], "Test@123").status_code == 401
