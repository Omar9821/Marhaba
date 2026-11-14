# اختبار الطلبات والنماذج والمراسلة
import os
import sys
from pathlib import Path

import pytest

pytest.importorskip("mongomock_motor")
from cryptography.fernet import Fernet  # noqa: E402

os.environ.update(MONGO_URL="mongodb://x", DB_NAME="t2", JWT_SECRET="s", ENCRYPTION_KEY=Fernet.generate_key().decode(),
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


@pytest.fixture(scope="module")
def H(c):
    return {"adm": login(c, "admin@company.dz", "Admin@123"), "insp": login(c, "inspector@company.dz", "Inspector@123"),
            "emp": login(c, "employee@company.dz", "Employee@123")}


def test_leave_exit_flow(c, H):
    r = c.post("/api/requests", json={"kind": "leave_exit", "to": "supervisor", "body": "موعد طبي", "fields": {"date": "2027-03-01", "from_time": "10:00", "to_time": "12:00"}}, headers=H["emp"])
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    assert r.json()["ref"].startswith("REQ-")
    # يظهر للمراقب (موجّه لمسؤول الورشة) وللمسيّر وللعامل
    for k in ("insp", "adm", "emp"):
        assert any(x["id"] == rid for x in c.get("/api/requests", headers=H[k]).json())
    assert c.get("/api/requests/summary", headers=H["insp"]).json()["requests"] >= 1
    d = c.get(f"/api/requests/{rid}", headers=H["insp"]).json()
    assert d["fields"]["date"] == "2027-03-01" and d["can_decide"] and d["status"] == "new"
    assert c.post(f"/api/requests/{rid}/decide", json={"decision": "approved", "note": "اذهب"}, headers=H["insp"]).status_code == 200
    d = c.get(f"/api/requests/{rid}", headers=H["emp"]).json()
    assert d["status"] == "approved" and d["thread"][-1]["type"] == "decision"
    assert c.get("/api/requests/summary", headers=H["emp"]).json()["requests"] == 0  # قرأه بفتحه
    # لا سحب بعد القرار
    assert c.post(f"/api/requests/{rid}/withdraw", headers=H["emp"]).status_code == 400
    # الخروج بلا ساعة مرفوض
    assert c.post("/api/requests", json={"kind": "leave_exit", "fields": {"date": "2027-03-01"}}, headers=H["emp"]).status_code == 400


def test_complaint_is_manager_only(c, H):
    r = c.post("/api/requests", json={"kind": "complaint", "to": "supervisor", "subject": "معاملة", "body": "نص الشكوى"}, headers=H["emp"])
    rid = r.json()["id"]
    assert c.get(f"/api/requests/{rid}", headers=H["insp"]).status_code == 404   # سرّية: للمسيّر فقط
    assert c.get(f"/api/requests/{rid}", headers=H["adm"]).json()["to"] == "manager"
    assert c.post(f"/api/requests/{rid}/reply", json={"text": "تم الاستلام وسنحقّق"}, headers=H["adm"]).status_code == 200
    d = c.get(f"/api/requests/{rid}", headers=H["emp"]).json()
    assert d["status"] == "answered" and len(d["thread"]) == 2 and not d["can_decide"]
    assert c.post(f"/api/requests/{rid}/decide", json={"decision": "closed"}, headers=H["adm"]).status_code == 200
    assert c.post(f"/api/requests/{rid}/reply", json={"text": "x"}, headers=H["emp"]).status_code == 400


def test_materials_not_in_app(c, H):
    # طلب المواد من المخزن يبقى على الورقة وليس في التطبيق
    r = c.post("/api/requests", json={"kind": "materials", "fields": {"items": [{"name": "x", "qty": 1}]}}, headers=H["emp"])
    assert r.status_code == 422
    assert "materials" not in [k["kind"] for k in c.get("/api/requests/kinds", headers=H["emp"]).json()]


def test_written_inquiry(c, H):
    emp_id = c.get("/api/auth/me", headers=H["emp"]).json()["employee_id"]
    assert c.post("/api/requests", json={"kind": "written_inquiry", "employee_id": emp_id, "subject": "تأخر", "body": "اشرح سبب التأخر"}, headers=H["emp"]).status_code == 403
    r = c.post("/api/requests", json={"kind": "written_inquiry", "employee_id": emp_id, "subject": "تأخر", "body": "اشرح سبب التأخر", "deadline_hours": 24}, headers=H["adm"])
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    mine = [x for x in c.get("/api/requests", headers=H["emp"]).json() if x["id"] == rid][0]
    assert mine["unread"] and mine["kind_label"] == "استفسار كتابي" and mine["due_at"]
    assert c.post(f"/api/requests/{rid}/reply", json={"text": "كان عطل في الحافلة"}, headers=H["emp"]).status_code == 200
    adm = [x for x in c.get("/api/requests", headers=H["adm"]).json() if x["id"] == rid][0]
    assert adm["status"] == "answered" and adm["unread"]


def test_permissions_toggle(c, H):
    p = c.get("/api/permissions", headers=H["adm"]).json()["perms"]
    p["employee"]["send_requests"] = False
    c.put("/api/permissions", json=p, headers=H["adm"])
    assert c.post("/api/requests", json={"kind": "question", "body": "؟"}, headers=H["emp"]).status_code == 403
    p["employee"]["send_requests"] = True
    p["inspector"]["handle_requests"] = False
    c.put("/api/permissions", json=p, headers=H["adm"])
    assert c.get("/api/requests", headers=H["insp"]).json() == []
    p["inspector"]["handle_requests"] = True
    c.put("/api/permissions", json=p, headers=H["adm"])


def test_chat(c, H):
    contacts = c.get("/api/chat/contacts", headers=H["emp"]).json()
    assert {x["role"] for x in contacts} == {"admin", "inspector"}
    insp = [x for x in contacts if x["role"] == "inspector"][0]
    assert c.post("/api/chat/send", json={"to_user_id": insp["user_id"], "text": "السلام عليكم، الآلة متعطلة"}, headers=H["emp"]).status_code == 200
    lst = c.get("/api/chat", headers=H["insp"]).json()
    assert lst[0]["unread"] == 1 and lst[0]["role"] == "employee"
    emp_uid = lst[0]["user_id"]
    assert c.get("/api/requests/summary", headers=H["insp"]).json()["chat"] == 1
    conv = c.get(f"/api/chat/with/{emp_uid}", headers=H["insp"]).json()
    assert len(conv["messages"]) == 1 and not conv["messages"][0]["mine"]
    assert c.get("/api/chat", headers=H["insp"]).json()[0]["unread"] == 0
    assert c.post("/api/chat/send", json={"to_user_id": emp_uid, "text": "جاري التدخل"}, headers=H["insp"]).status_code == 200
    mine = c.get(f"/api/chat/with/{insp['user_id']}", headers=H["emp"]).json()["messages"]
    assert [x["mine"] for x in mine] == [True, False]
    # العامل لا يراسل عاملًا آخر
    assert c.post("/api/chat/send", json={"to_user_id": emp_uid, "text": "x"}, headers=H["emp"]).status_code == 404
    # إيقاف المراسلة للعامل
    p = c.get("/api/permissions", headers=H["adm"]).json()["perms"]
    p["employee"]["use_messages"] = False
    c.put("/api/permissions", json=p, headers=H["adm"])
    assert c.get("/api/chat/contacts", headers=H["emp"]).status_code == 403
    p["employee"]["use_messages"] = True
    c.put("/api/permissions", json=p, headers=H["adm"])


def test_push_notifications(c, H, monkeypatch):
    import time
    sent = []
    monkeypatch.setattr(server, "VAPID_PUBLIC", "pub")
    monkeypatch.setattr(server, "VAPID_PRIVATE", "priv")
    monkeypatch.setattr(server, "_send_one", lambda sub, payload: sent.append((sub["endpoint"], payload)) and None)
    assert c.get("/api/push/key", headers=H["emp"]).json()["key"] == "pub"
    for k, ep in (("emp", "https://push.example/emp"), ("insp", "https://push.example/insp"), ("adm", "https://push.example/adm")):
        assert c.post("/api/push/subscribe", json={"endpoint": ep, "keys": {"p256dh": "a", "auth": "b"}}, headers=H[k]).status_code == 200
    assert c.post("/api/push/subscribe", json={"endpoint": "https://push.example/x", "keys": {}}, headers=H["emp"]).status_code == 400
    # طلب موجّه لمسؤول الورشة: يصل المراقب والمسيّر ولا يصل العامل
    sent.clear()
    r = c.post("/api/requests", json={"kind": "leave_exit", "to": "supervisor", "fields": {"date": "2027-03-02", "from_time": "09:00"}}, headers=H["emp"]).json()
    time.sleep(0.4)
    eps = {e for e, _ in sent}
    assert eps == {"https://push.example/insp", "https://push.example/adm"}
    # شكوى: المسيّر وحده
    sent.clear()
    c.post("/api/requests", json={"kind": "complaint", "subject": "س", "body": "ن"}, headers=H["emp"])
    time.sleep(0.4)
    assert {e for e, _ in sent} == {"https://push.example/adm"}
    # قرار المراقب يصل العامل
    sent.clear()
    c.post(f"/api/requests/{r['id']}/decide", json={"decision": "approved"}, headers=H["insp"])
    time.sleep(0.4)
    assert {e for e, _ in sent} == {"https://push.example/emp"}
    # رسالة مراسلة تصل المستلم فقط
    sent.clear()
    me = c.get("/api/auth/me", headers=H["emp"]).json()
    c.post("/api/chat/send", json={"to_user_id": me["id"], "text": "مرحبا"}, headers=H["insp"])
    time.sleep(0.4)
    assert {e for e, _ in sent} == {"https://push.example/emp"}
    assert c.post("/api/push/unsubscribe", json={"endpoint": "https://push.example/emp"}, headers=H["emp"]).status_code == 200
    sent.clear()
    c.post("/api/chat/send", json={"to_user_id": me["id"], "text": "مرة أخرى"}, headers=H["insp"])
    time.sleep(0.4)
    assert sent == []
