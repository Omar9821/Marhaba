# اختبار تكاملي لواجهة الفروع/الصلاحيات/التفتيشات/الإعلانات (يتطلب mongomock-motor)
import os
import sys
from pathlib import Path

import pytest

pytest.importorskip("mongomock_motor")
from cryptography.fernet import Fernet  # noqa: E402

os.environ.update(MONGO_URL="mongodb://x", DB_NAME="t", JWT_SECRET="s", ENCRYPTION_KEY=Fernet.generate_key().decode(),
                  ADMIN_EMAIL="admin@company.dz", ADMIN_PASSWORD="Admin@123", OWNER_EMAIL="owner@company.dz", OWNER_PASSWORD="Owner@123456")
import motor.motor_asyncio as m  # noqa: E402
import mongomock_motor  # noqa: E402

m.AsyncIOMotorClient = lambda *a, **k: mongomock_motor.AsyncMongoMockClient()
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402


@pytest.fixture(scope="module")
def c():
    with TestClient(server.app) as cl:
        yield cl


def login(c, email, pw):
    r = c.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["token"]}


def test_roles_and_permissions(c):
    adm = login(c, "admin@company.dz", "Admin@123")
    insp = login(c, "inspector@company.dz", "Inspector@123")
    emp = login(c, "employee@company.dz", "Employee@123")
    sh = c.get("/api/sheet", headers=insp).json()
    assert sh["turnover"] is None and sh["totals"] is None and all(r["base"] is None for r in sh["rows"])
    full = c.get("/api/sheet", headers=adm).json()
    assert full["turnover"] == 4000000 and full["totals"]["gross"] > 0
    # المسير يمنح المراقب رؤية رقم الأعمال والأساس
    p = c.get("/api/permissions", headers=adm).json()["perms"]
    p["inspector"]["view_turnover"] = True
    p["inspector"]["view_base"] = True
    assert c.put("/api/permissions", json=p, headers=adm).status_code == 200
    sh = c.get("/api/sheet", headers=insp).json()
    assert sh["turnover"] == 4000000 and sh["rows"][0]["base"] is not None
    assert c.put("/api/sheet/turnover", json={"month": full["month"], "turnover": 1}, headers=insp).status_code == 403
    # إخفاء رقم الأعمال المحقق عن العمال
    me = c.get("/api/me/sheet", headers=emp).json()
    assert me["row"]["base"] is not None
    p["employee"]["view_base"] = False
    c.put("/api/permissions", json=p, headers=adm)
    assert c.get("/api/me/sheet", headers=emp).json()["row"]["base"] is None


def test_commission_types_positions_violations(c):
    adm = login(c, "admin@company.dz", "Admin@123")
    prm = c.get("/api/sheet/params", headers=adm).json()
    assert {t["id"] for t in prm["commission_types"]} >= {"commercial", "finance", "cutting", "pool"}
    prm["commission_types"].append({"id": "sqm", "label": "متر مربع", "kind": "rate", "rate": 50, "share": 0.5, "base_label": "الأمتار المربعة", "unit": "م²"})
    prm["violation_types"].append({"code": "dirty_van", "label": "تنظيف الشاحنة", "impact": "hygiene", "active": True})
    r = c.put("/api/sheet/params", json=prm, headers=adm)
    assert r.status_code == 200, r.text
    assert any(t["id"] == "sqm" for t in r.json()["commission_types"])
    pos = c.post("/api/positions", json={"name": "فني م²", "perf_type": "sqm", "post_weight": 2}, headers=adm)
    assert pos.status_code == 200 and pos.json()["perf_type"] == "sqm"
    e = c.post("/api/employees", json={"full_name": "سالم", "position_id": pos.json()["id"], "perf_type": "sqm", "post_weight": 2}, headers=adm).json()
    mth = c.get("/api/sheet", headers=adm).json()["month"]
    assert c.put("/api/sheet/entry", json={"month": mth, "employee_id": e["id"], "base": 100}, headers=adm).status_code == 200
    row = next(x for x in c.get("/api/sheet", headers=adm).json()["rows"] if x["id"] == e["id"])
    assert row["s"] == 5000 and row["status"] == "✔"          # 100 × 50
    # لا يُحذف نوع عمولة مستعمل
    prm2 = c.get("/api/sheet/params", headers=adm).json()
    prm2["commission_types"] = [t for t in prm2["commission_types"] if t["id"] != "sqm"]
    assert c.put("/api/sheet/params", json=prm2, headers=adm).status_code == 400
    # عدة تفتيشات في الشهر + خسارة تدخل في النتيجة
    for d, cnt, loss in ((f"{mth}-05", {"late": 1}, 0), (f"{mth}-12", {"late": 2, "dirty_van": 1}, 10000)):
        assert c.put("/api/violations-log/entry", json={"employee_id": e["id"], "date": d, "counts": cnt, "loss": loss}, headers=adm).status_code == 200
    log = c.get(f"/api/violations-log?month={mth}&date={mth}-12", headers=adm).json()
    assert len(log["inspections"]) >= 2 and log["loss_total"] >= 10000
    row = next(x for x in log["rows"] if x["employee_id"] == e["id"])
    assert row["counts"]["late"] == 3 and row["day_counts"]["late"] == 2 and row["loss"] == 10000
    row = next(x for x in c.get("/api/sheet", headers=adm).json()["rows"] if x["id"] == e["id"])
    assert row["days"] == 3 and row["hygiene"] == 0 and row["losses"] == 10000
    # حذف تفتيش بإفراغه
    assert c.put("/api/violations-log/entry", json={"employee_id": e["id"], "date": f"{mth}-05", "counts": {}, "loss": 0}, headers=adm).json().get("deleted")


def test_announcements(c):
    adm = login(c, "admin@company.dz", "Admin@123")
    emp = login(c, "employee@company.dz", "Employee@123")
    insp = login(c, "inspector@company.dz", "Inspector@123")
    emps = c.get("/api/employees", headers=adm).json()
    me_id = c.get("/api/auth/me", headers=emp).json()["employee_id"]
    assert c.post("/api/announcements", json={"title": "للمراقبين", "audience": "inspectors"}, headers=adm).status_code == 200
    assert c.post("/api/announcements", json={"title": "لكم", "audience": "selected", "employee_ids": [me_id]}, headers=adm).status_code == 200
    other = next(e for e in emps if e["id"] != me_id)
    assert c.post("/api/announcements", json={"title": "لغيركم", "audience": "selected", "employee_ids": [other["id"]]}, headers=adm).status_code == 200
    titles = lambda h: {a["title"] for a in c.get("/api/announcements", headers=h).json()}
    assert titles(emp) == {"لكم"} and "للمراقبين" in titles(insp) and "لغيركم" not in titles(insp)
    aid = c.get("/api/announcements", headers=emp).json()[0]["id"]
    c.post(f"/api/announcements/{aid}/read", headers=emp)
    assert c.get("/api/announcements", headers=emp).json()[0]["read"] is True
    assert c.post("/api/announcements", json={"title": "x"}, headers=insp).status_code == 403   # صلاحية الإرسال مغلقة افتراضيًا


def test_branches(c):
    owner = login(c, "owner@company.dz", "Owner@123456")
    assert c.get("/api/sheet", headers=owner).status_code in (400, 403)      # بلا فرع محدّد
    r = c.post("/api/hub/branches", json={"name": "فرع الخدمات", "activity": "services", "admin_email": "svc@x.dz", "admin_password": "Secret123"}, headers=owner)
    assert r.status_code == 200, r.text
    bid = r.json()["id"]
    svc = login(c, "svc@x.dz", "Secret123")
    prm = c.get("/api/sheet/params", headers=svc).json()
    assert any(t["id"] == "service" for t in prm["commission_types"]) and not any(t["id"] == "commercial" for t in prm["commission_types"])
    assert c.get("/api/employees", headers=svc).json() == []                  # بيانات الفرع معزولة
    assert len(c.get("/api/positions", headers=svc).json()) == 2
    # المسؤول العام يدخل الفرع بصلاحيات المسيّر
    assert c.get("/api/sheet", headers={**owner, "X-Branch": bid}).status_code == 200
    ov = c.get("/api/hub/overview", headers=owner).json()
    assert {b["id"] for b in ov["branches"]} == {"main", bid} and ov["totals"]["employees"] >= 8
    assert c.get("/api/hub/overview", headers=login(c, "admin@company.dz", "Admin@123")).status_code == 403
    assert c.post("/api/hub/branches", json={"name": "مكرر", "admin_email": "svc@x.dz", "admin_password": "Secret123"}, headers=owner).status_code == 400
    assert c.put(f"/api/hub/branches/{bid}", json={"active": False}, headers=owner).status_code == 200
    assert c.get("/api/sheet", headers=svc).status_code == 403
