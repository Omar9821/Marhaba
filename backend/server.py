import asyncio
import logging
import os
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone, date as date_cls
from pathlib import Path
from typing import List, Literal, Optional

import bcrypt
import httpx
import jwt
from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.middleware.cors import CORSMiddleware

import sheet_engine as sheet

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
FERNET = Fernet(os.environ["ENCRYPTION_KEY"].encode())
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Database schema (collections) — every document uses a string `id`, `_id` never leaves the API
#   users              {id, email, name, role: admin|inspector|employee, password_hash?, employee_id?, picture?}
#   user_sessions      {session_token, user_id, expires_at}   (Google login sessions)
#   settings           {id:"global", currency, bonus_mode, point_value, multiplier, salary_rate,
#                       max_ratio, bonus_cap, fund_percent, competitive_percent, competitive_winners,
#                       max_infractions, min_score}
#   positions          {id, name, point_value?, kpis:[{id, name, weight, target, unit}]}
#   employees          {id, full_name, phone_enc, email?, position_id, hire_date, base_salary_enc, status,
#                       perf_type: commercial|finance|cutting|pool, post_weight?}
#   settings (id:"sheet_params")  معاملات «جدول الأداء والمردودية» (انظر sheet_engine.DEFAULT_PARAMS)
#   sheet_months       {month, turnover}                              رقم أعمال الشركة المحصَّل الصافي
#   sheet_entries      {employee_id, month, hygiene, respect, losses, days, base}  unique(employee_id,month)
#   violation_entries  {employee_id, month, counts:{code:int}, note, follow_date}  unique(employee_id,month)
#   infraction_types   {id, name, deduction_type: points|percent|amount, value, active}
#   performance_entries{id, employee_id, date, kpi_id, target, achieved}  unique(employee_id,date,kpi_id)
#   infractions        {id, employee_id, type_id, date, note}
# ---------------------------------------------------------------------------
INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("id", ASCENDING)], name="id", unique=True),
              IndexModel([("email", ASCENDING)], name="email", unique=True)],
    "user_sessions": [IndexModel([("session_token", ASCENDING)], name="token", unique=True),
                      IndexModel([("expires_at", ASCENDING)], name="ttl", expireAfterSeconds=0)],
    "positions": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "employees": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "infraction_types": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "performance_entries": [
        IndexModel([("employee_id", ASCENDING), ("date", ASCENDING), ("kpi_id", ASCENDING)], name="emp_date_kpi", unique=True),
        IndexModel([("date", ASCENDING)], name="date")],
    "sheet_months": [IndexModel([("month", ASCENDING)], name="month", unique=True)],
    "sheet_entries": [IndexModel([("employee_id", ASCENDING), ("month", ASCENDING)], name="emp_month", unique=True)],
    "violation_entries": [IndexModel([("employee_id", ASCENDING), ("month", ASCENDING)], name="emp_month", unique=True)],
    "infractions": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                    IndexModel([("employee_id", ASCENDING), ("date", DESCENDING)], name="emp_date"),
                    IndexModel([("date", DESCENDING)], name="date")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


def new_id() -> str:
    return uuid.uuid4().hex


def enc(value) -> str:
    return FERNET.encrypt(str(value if value is not None else "").encode()).decode()


def dec(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        return FERNET.decrypt(value.encode()).decode()
    except InvalidToken:
        return ""


def now_utc():
    return datetime.now(timezone.utc)


app = FastAPI()


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


api = APIRouter(prefix="/api")

# ------------------------------- Models -----------------------------------
DeductionType = Literal["points", "percent", "amount"]


class KPI(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    weight: float = Field(ge=0, le=100)
    target: float = Field(ge=0)
    unit: str = ""


class PositionIn(BaseModel):
    name: str = Field(min_length=1)
    point_value: Optional[float] = None
    kpis: List[KPI] = []


class EmployeeIn(BaseModel):
    full_name: str = Field(min_length=1)
    phone: str = ""
    email: Optional[str] = None
    password: Optional[str] = None
    position_id: str
    hire_date: str = ""
    base_salary: float = 0
    status: Literal["active", "inactive"] = "active"
    perf_type: Literal["commercial", "finance", "cutting", "pool"] = "pool"
    post_weight: Optional[float] = Field(default=None, ge=0)


class InfractionTypeIn(BaseModel):
    name: str = Field(min_length=1)
    deduction_type: DeductionType
    value: float = Field(ge=0)
    active: bool = True


class SettingsIn(BaseModel):
    currency: str = "دج"
    bonus_mode: Literal["points", "salary"] = "points"
    point_value: float = Field(ge=0)
    multiplier: float = Field(ge=0)
    salary_rate: float = Field(ge=0, le=100)
    max_ratio: float = Field(ge=100, le=300)
    bonus_cap: float = Field(ge=0)
    fund_percent: float = Field(ge=0, le=100)
    competitive_percent: float = Field(ge=0, le=100)
    competitive_winners: int = Field(ge=0, le=20)
    max_infractions: int = Field(ge=0)
    min_score: float = Field(ge=0, le=300)


class PerfValue(BaseModel):
    kpi_id: str
    target: float = Field(ge=0)
    achieved: float = Field(ge=0)


class PerfBatch(BaseModel):
    employee_id: str
    date: str
    values: List[PerfValue]


class InfractionIn(BaseModel):
    id: str = Field(default_factory=new_id)  # client-generated for offline idempotency
    employee_id: str
    type_id: str
    date: str
    note: str = ""


class LoginIn(BaseModel):
    email: str
    password: str


class SessionIn(BaseModel):
    session_id: str


DEFAULT_SETTINGS = {
    "id": "global", "currency": "دج", "bonus_mode": "points", "point_value": 50.0, "multiplier": 1.0,
    "salary_rate": 30.0, "max_ratio": 120.0, "bonus_cap": 15000.0, "fund_percent": 5.0,
    "competitive_percent": 50.0, "competitive_winners": 1, "max_infractions": 5, "min_score": 50.0,
}

# ------------------------------- Auth -------------------------------------


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def make_jwt(user_id: str) -> str:
    n = now_utc()
    return jwt.encode({"sub": user_id, "iat": n, "exp": n + timedelta(days=7), "typ": "access"}, JWT_SECRET, algorithm="HS256")


def public_user(u: dict) -> dict:
    return {k: u.get(k) for k in ("id", "email", "name", "role", "employee_id", "picture")}


async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "غير مصرح")
    token = auth[7:]
    user_id = None
    try:
        user_id = jwt.decode(token, JWT_SECRET, algorithms=["HS256"]).get("sub")
    except jwt.InvalidTokenError:
        s = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if s:
            exp = s["expires_at"]
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now_utc():
                user_id = s["user_id"]
    if not user_id:
        raise HTTPException(401, "انتهت الجلسة")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(401, "المستخدم غير موجود")
    if user["role"] == "employee" and user.get("employee_id"):
        emp = await db.employees.find_one({"id": user["employee_id"]}, {"_id": 0, "status": 1})
        if emp and emp.get("status") != "active":
            raise HTTPException(401, "الحساب معطل")
    return user


async def admin_only(user=Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "صلاحيات غير كافية")
    return user


async def staff_only(user=Depends(current_user)) -> dict:
    """المسير أو المراقب."""
    if user["role"] not in ("admin", "inspector"):
        raise HTTPException(403, "صلاحيات غير كافية")
    return user


@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email.strip().lower()}, {"_id": 0})
    ok = bool(user and user.get("password_hash") and bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()))
    if not ok:
        raise HTTPException(401, "البريد الإلكتروني أو كلمة المرور غير صحيحة")
    return {"token": make_jwt(user["id"]), "user": public_user(user)}


@api.post("/auth/session")
async def google_session(data: SessionIn):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": data.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "فشل تسجيل الدخول عبر Google")
    info = r.json()
    email = info["email"].strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        emp = await db.employees.find_one({"email": email}, {"_id": 0, "id": 1})
        user = {"id": new_id(), "email": email, "name": info.get("name") or email, "role": "employee",
                "employee_id": emp["id"] if emp else None, "picture": info.get("picture"), "created_at": now_utc()}
        await db.users.insert_one(dict(user))
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"picture": info.get("picture")}})
    token = info["session_token"]
    await db.user_sessions.update_one({"session_token": token}, {"$set": {
        "session_token": token, "user_id": user["id"], "expires_at": now_utc() + timedelta(days=7), "created_at": now_utc()}}, upsert=True)
    return {"session_token": token, "user": public_user(user)}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request):
    token = request.headers.get("Authorization", "")[7:]
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}

# ------------------------------- Settings ---------------------------------


async def get_settings_doc() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return {**DEFAULT_SETTINGS, **(s or {})}


@api.get("/settings")
async def get_settings(_=Depends(current_user)):
    return await get_settings_doc()


@api.put("/settings")
async def put_settings(data: SettingsIn, _=Depends(admin_only)):
    doc = {"id": "global", **data.model_dump()}
    await db.settings.update_one({"id": "global"}, {"$set": doc}, upsert=True)
    return doc

# ------------------------------- Positions --------------------------------


def check_weights(kpis: List[KPI]):
    if kpis and abs(sum(k.weight for k in kpis) - 100) > 0.01:
        raise HTTPException(400, "يجب أن يكون مجموع أوزان المؤشرات 100%")


@api.get("/positions")
async def list_positions(_=Depends(current_user)):
    return await db.positions.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/positions")
async def create_position(data: PositionIn, _=Depends(admin_only)):
    check_weights(data.kpis)
    doc = {"id": new_id(), **data.model_dump()}
    await db.positions.insert_one(dict(doc))
    return doc


@api.put("/positions/{pid}")
async def update_position(pid: str, data: PositionIn, _=Depends(admin_only)):
    check_weights(data.kpis)
    res = await db.positions.update_one({"id": pid}, {"$set": data.model_dump()})
    if not res.matched_count:
        raise HTTPException(404, "المنصب غير موجود")
    return {"id": pid, **data.model_dump()}


@api.delete("/positions/{pid}")
async def delete_position(pid: str, _=Depends(admin_only)):
    if await db.employees.count_documents({"position_id": pid}):
        raise HTTPException(400, "لا يمكن حذف منصب مرتبط بموظفين")
    await db.positions.delete_one({"id": pid})
    return {"ok": True}

# ------------------------------- Employees --------------------------------


def employee_out(e: dict, positions: dict) -> dict:
    return {"id": e["id"], "full_name": e["full_name"], "phone": dec(e.get("phone_enc")), "email": e.get("email"),
            "position_id": e["position_id"], "position_name": positions.get(e["position_id"], {}).get("name", "—"),
            "hire_date": e.get("hire_date", ""), "base_salary": float(dec(e.get("base_salary_enc")) or 0),
            "status": e.get("status", "active"), "perf_type": e.get("perf_type", "pool"), "post_weight": e.get("post_weight")}


async def positions_map() -> dict:
    return {p["id"]: p for p in await db.positions.find({}, {"_id": 0}).to_list(500)}


async def sync_employee_user(emp_id: str, name: str, email: Optional[str], password: Optional[str]):
    if not email:
        return
    email = email.strip().lower()
    other = await db.users.find_one({"email": email}, {"_id": 0})
    if other and other.get("employee_id") not in (None, emp_id):
        raise HTTPException(400, "البريد الإلكتروني مستخدم لموظف آخر")
    if other and other["role"] == "admin":
        raise HTTPException(400, "البريد الإلكتروني مستخدم لحساب المسير")
    await db.users.update_many({"employee_id": emp_id, "email": {"$ne": email}}, {"$set": {"employee_id": None}})
    upd = {"email": email, "name": name, "role": "employee", "employee_id": emp_id}
    if password:
        if len(password) < 6:
            raise HTTPException(400, "كلمة المرور قصيرة جداً (6 أحرف على الأقل)")
        upd["password_hash"] = hash_pw(password)
    await db.users.update_one({"email": email}, {"$set": upd, "$setOnInsert": {"id": new_id(), "created_at": now_utc()}}, upsert=True)


@api.get("/employees")
async def list_employees(include_inactive: bool = True, user=Depends(staff_only)):
    q = {} if include_inactive else {"status": "active"}
    pm = await positions_map()
    emps = await db.employees.find(q, {"_id": 0}).sort("full_name", 1).to_list(2000)
    out = [employee_out(e, pm) for e in emps]
    if user["role"] != "admin":  # المراقب لا يرى الرواتب ولا الهواتف
        for o in out:
            o["base_salary"], o["phone"] = 0, ""
    return out


@api.post("/employees")
async def create_employee(data: EmployeeIn, _=Depends(admin_only)):
    if not await db.positions.find_one({"id": data.position_id}):
        raise HTTPException(400, "المنصب غير موجود")
    eid = new_id()
    await sync_employee_user(eid, data.full_name, data.email, data.password)
    doc = {"id": eid, "full_name": data.full_name, "phone_enc": enc(data.phone), "email": (data.email or "").strip().lower() or None,
           "position_id": data.position_id, "hire_date": data.hire_date, "base_salary_enc": enc(data.base_salary),
           "status": data.status, "perf_type": data.perf_type, "post_weight": data.post_weight, "created_at": now_utc()}
    await db.employees.insert_one(dict(doc))
    return employee_out(doc, await positions_map())


@api.put("/employees/{eid}")
async def update_employee(eid: str, data: EmployeeIn, _=Depends(admin_only)):
    if not await db.employees.find_one({"id": eid}):
        raise HTTPException(404, "الموظف غير موجود")
    await sync_employee_user(eid, data.full_name, data.email, data.password)
    upd = {"full_name": data.full_name, "phone_enc": enc(data.phone), "email": (data.email or "").strip().lower() or None,
           "position_id": data.position_id, "hire_date": data.hire_date, "base_salary_enc": enc(data.base_salary), "status": data.status,
           "perf_type": data.perf_type, "post_weight": data.post_weight}
    await db.employees.update_one({"id": eid}, {"$set": upd})
    return employee_out({"id": eid, **upd}, await positions_map())


@api.delete("/employees/{eid}")
async def delete_employee(eid: str, _=Depends(admin_only)):
    await db.employees.delete_one({"id": eid})
    await db.performance_entries.delete_many({"employee_id": eid})
    await db.infractions.delete_many({"employee_id": eid})
    await db.sheet_entries.delete_many({"employee_id": eid})
    await db.violation_entries.delete_many({"employee_id": eid})
    await db.users.delete_many({"employee_id": eid, "role": "employee"})
    return {"ok": True}

# ------------------------------- Infraction types -------------------------


@api.get("/infraction-types")
async def list_types(_=Depends(current_user)):
    return await db.infraction_types.find({}, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/infraction-types")
async def create_type(data: InfractionTypeIn, _=Depends(admin_only)):
    doc = {"id": new_id(), **data.model_dump()}
    await db.infraction_types.insert_one(dict(doc))
    return doc


@api.put("/infraction-types/{tid}")
async def update_type(tid: str, data: InfractionTypeIn, _=Depends(admin_only)):
    await db.infraction_types.update_one({"id": tid}, {"$set": data.model_dump()})
    return {"id": tid, **data.model_dump()}


@api.delete("/infraction-types/{tid}")
async def delete_type(tid: str, _=Depends(admin_only)):
    if await db.infractions.count_documents({"type_id": tid}):
        raise HTTPException(400, "هذه المخالفة مسجلة سابقاً، يمكنك إلغاء تفعيلها بدلاً من حذفها")
    await db.infraction_types.delete_one({"id": tid})
    return {"ok": True}

# ------------------------------- Daily data -------------------------------


@api.post("/performance/batch")
async def save_performance(data: PerfBatch, _=Depends(admin_only)):
    for v in data.values:
        await db.performance_entries.update_one(
            {"employee_id": data.employee_id, "date": data.date, "kpi_id": v.kpi_id},
            {"$set": {"target": v.target, "achieved": v.achieved, "updated_at": now_utc()},
             "$setOnInsert": {"id": new_id()}}, upsert=True)
    return {"ok": True, "count": len(data.values)}


@api.get("/performance")
async def get_performance(employee_id: str, date: str, _=Depends(admin_only)):
    return await db.performance_entries.find({"employee_id": employee_id, "date": date}, {"_id": 0, "updated_at": 0}).to_list(200)


@api.post("/infractions")
async def add_infraction(data: InfractionIn, _=Depends(admin_only)):
    doc = {**data.model_dump(), "created_at": now_utc()}
    await db.infractions.update_one({"id": data.id}, {"$setOnInsert": doc}, upsert=True)
    return data.model_dump()


@api.delete("/infractions/{iid}")
async def delete_infraction(iid: str, _=Depends(admin_only)):
    await db.infractions.delete_one({"id": iid})
    return {"ok": True}


@api.get("/infractions")
async def list_infractions(month: Optional[str] = None, date: Optional[str] = None, employee_id: Optional[str] = None, _=Depends(admin_only)):
    q: dict = {}
    if date:
        q["date"] = date
    elif month:
        q["date"] = {"$regex": f"^{month}"}
    if employee_id:
        q["employee_id"] = employee_id
    return await db.infractions.find(q, {"_id": 0, "created_at": 0}).sort("date", -1).to_list(2000)

# ------------------------------- Calculation engine -----------------------


def calc_employee(emp: dict, pos: dict, s: dict, entries: list, infs: list, types: dict) -> dict:
    max_ratio = s["max_ratio"] / 100
    kpis = pos.get("kpis", []) if pos else []
    kpi_rows, score = [], 0.0
    for k in kpis:
        es = [e for e in entries if e["kpi_id"] == k["id"]]
        t = sum(e["target"] for e in es)
        a = sum(e["achieved"] for e in es)
        ratio = min(a / t, max_ratio) if t > 0 else 0.0
        weighted = ratio * k["weight"]
        score += weighted
        kpi_rows.append({"kpi_id": k["id"], "name": k["name"], "unit": k.get("unit", ""), "weight": k["weight"],
                         "target": round(t, 2), "achieved": round(a, 2), "ratio": round(ratio * 100, 1), "weighted": round(weighted, 2)})
    # daily score series
    days = sorted({e["date"] for e in entries})
    daily = []
    for d in days:
        ds = 0.0
        for k in kpis:
            es = [e for e in entries if e["kpi_id"] == k["id"] and e["date"] == d]
            t = sum(e["target"] for e in es)
            a = sum(e["achieved"] for e in es)
            ds += (min(a / t, max_ratio) if t > 0 else 0) * k["weight"]
        daily.append({"date": d, "score": round(ds, 1)})

    inf_rows, pts_ded, pct_ded, amt_ded = [], 0.0, 0.0, 0.0
    for i in infs:
        ty = types.get(i["type_id"], {"name": "مخالفة محذوفة", "deduction_type": "points", "value": 0})
        if ty["deduction_type"] == "points":
            pts_ded += ty["value"]
        elif ty["deduction_type"] == "percent":
            pct_ded += ty["value"]
        else:
            amt_ded += ty["value"]
        inf_rows.append({"id": i["id"], "date": i["date"], "type_id": i["type_id"], "type_name": ty["name"],
                         "deduction_type": ty["deduction_type"], "value": ty["value"], "note": i.get("note", "")})

    effective = max(0.0, score - pts_ded)
    point_value = (pos or {}).get("point_value") or s["point_value"]
    base_salary = float(dec(emp.get("base_salary_enc")) or 0)
    if s["bonus_mode"] == "salary":
        gross = base_salary * s["salary_rate"] / 100 * effective / 100 * s["multiplier"]
    else:
        gross = effective * point_value * s["multiplier"]
    pct_amount = gross * min(pct_ded, 100) / 100
    net = max(0.0, gross - pct_amount - amt_ded)
    capped = bool(s["bonus_cap"] > 0 and net > s["bonus_cap"])
    if capped:
        net = s["bonus_cap"]
    eligible, reason = True, None
    if len(infs) > s["max_infractions"]:
        eligible, reason = False, f"تجاوز عدد المخالفات الحد المسموح ({s['max_infractions']})"
    elif score < s["min_score"]:
        eligible, reason = False, f"نسبة الأداء أقل من الحد الأدنى ({s['min_score']:g}%)"
    if not eligible:
        net = 0.0
    fund_share = net * s["fund_percent"] / 100
    return {
        "employee": {"id": emp["id"], "full_name": emp["full_name"], "position_name": (pos or {}).get("name", "—"),
                     "base_salary": base_salary, "status": emp.get("status", "active")},
        "kpis": kpi_rows, "daily": daily, "days_recorded": len(days),
        "score": round(score, 1), "points_deduction": pts_ded, "effective_score": round(effective, 1),
        "point_value": point_value, "multiplier": s["multiplier"], "bonus_mode": s["bonus_mode"],
        "gross_bonus": round(gross, 2), "percent_deduction": pct_ded, "percent_amount": round(pct_amount, 2),
        "amount_deduction": amt_ded, "infractions": inf_rows, "infractions_count": len(infs),
        "capped": capped, "eligible": eligible, "ineligible_reason": reason,
        "net_bonus": round(net, 2), "fund_share": round(fund_share, 2), "competitive_bonus": 0.0,
        "final_bonus": round(net - fund_share, 2),
    }


async def company_report(month: str, include_inactive: bool = False) -> dict:
    s = await get_settings_doc()
    pm = await positions_map()
    types = {t["id"]: t for t in await db.infraction_types.find({}, {"_id": 0}).to_list(500)}
    emps = await db.employees.find({} if include_inactive else {"status": "active"}, {"_id": 0}).to_list(2000)
    entries = await db.performance_entries.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(100000)
    infs = await db.infractions.find({"date": {"$regex": f"^{month}"}}, {"_id": 0}).to_list(100000)
    rows = [calc_employee(e, pm.get(e["position_id"]), s,
                          [x for x in entries if x["employee_id"] == e["id"]],
                          [x for x in infs if x["employee_id"] == e["id"]], types) for e in emps]
    fund_pool = round(sum(r["fund_share"] for r in rows), 2)
    comp_pool = round(fund_pool * s["competitive_percent"] / 100, 2)
    winners = sorted([r for r in rows if r["eligible"] and r["days_recorded"] > 0], key=lambda r: -r["score"])[: s["competitive_winners"]]
    if winners and comp_pool > 0:
        each = round(comp_pool / len(winners), 2)
        for w in winners:
            w["competitive_bonus"] = each
            w["final_bonus"] = round(w["final_bonus"] + each, 2)
    rows.sort(key=lambda r: -r["score"])
    return {
        "month": month, "settings": s, "employees": rows,
        "totals": {"employees": len(rows), "final_bonus": round(sum(r["final_bonus"] for r in rows), 2),
                   "avg_score": round(sum(r["score"] for r in rows) / len(rows), 1) if rows else 0,
                   "infractions": sum(r["infractions_count"] for r in rows), "fund_pool": fund_pool,
                   "competitive_pool": comp_pool, "recreation_fund": round(fund_pool - (comp_pool if winners else 0), 2),
                   "base_salaries": round(sum(r["employee"]["base_salary"] for r in rows), 2)},
    }


def current_month() -> str:
    return date_cls.today().strftime("%Y-%m")


@api.get("/reports/company")
async def report_company(month: Optional[str] = None, _=Depends(admin_only)):
    return await company_report(month or current_month())


async def employee_report(eid: str, month: str) -> dict:
    rep = await company_report(month, include_inactive=True)
    for r in rep["employees"]:
        if r["employee"]["id"] == eid:
            return {**r, "month": month, "currency": rep["settings"]["currency"]}
    raise HTTPException(404, "الموظف غير موجود")


@api.get("/reports/employee/{eid}")
async def report_employee(eid: str, month: Optional[str] = None, _=Depends(admin_only)):
    return await employee_report(eid, month or current_month())


@api.get("/me/report")
async def my_report(month: Optional[str] = None, user=Depends(current_user)):
    if not user.get("employee_id"):
        raise HTTPException(404, "حسابك غير مرتبط بملف موظف بعد")
    return await employee_report(user["employee_id"], month or current_month())

# ------------------------------- Monthly sheet (Excel model) --------------
MONTH_RE = r"^\d{4}-(0[1-9]|1[0-2])$"


class SheetParamsIn(BaseModel):
    pass_threshold: float = Field(ge=0, le=1)
    w_hygiene: float = Field(ge=0)
    w_respect: float = Field(ge=0)
    loss_limit: float = Field(ge=0)
    w_loss: float = Field(ge=0)
    days_limit: float = Field(ge=0)
    w_days: float = Field(ge=0)
    rate_commercial: float = Field(ge=0)
    share_commercial: float = Field(ge=0, le=1)
    rate_finance: float = Field(ge=0)
    share_finance: float = Field(ge=0, le=1)
    price_meter: float = Field(ge=0)
    share_cutting: float = Field(ge=0, le=1)
    fund_ratio: float = Field(ge=0, le=1)
    pool_rate: float = Field(ge=0, le=1)
    violation_map: Optional[dict[str, str]] = None


class SheetTurnoverIn(BaseModel):
    month: str = Field(pattern=MONTH_RE)
    turnover: Optional[float] = Field(default=None, ge=0)


class SheetEntryIn(BaseModel):
    month: str = Field(pattern=MONTH_RE)
    employee_id: str
    hygiene: Optional[float] = Field(default=None, ge=0, le=1)     # نسبة تفتيش 0..1
    respect: Optional[Literal["نعم", "لا"]] = None
    losses: Optional[float] = Field(default=None, ge=0)            # دج
    days: Optional[float] = Field(default=None, ge=0)              # تأخرات + غيابات (أيام)
    base: Optional[float] = Field(default=None, ge=0)              # رقم أعمال / مبالغ مستردة / أمتار


class ViolationEntryIn(BaseModel):
    month: str = Field(pattern=MONTH_RE)
    employee_id: str
    counts: dict[str, int] = {}
    note: str = ""
    follow_date: str = ""


async def sheet_params_doc() -> dict:
    d = await db.settings.find_one({"id": "sheet_params"}, {"_id": 0, "id": 0})
    return {**sheet.merge_params(d), "violation_map": sheet.merge_violation_map((d or {}).get("violation_map"))}


@api.get("/sheet/params")
async def get_sheet_params(_=Depends(staff_only)):
    return {**await sheet_params_doc(), "violation_types": [{"code": c, "label": l} for c, l in sheet.VIOLATION_TYPES]}


@api.put("/sheet/params")
async def put_sheet_params(data: SheetParamsIn, _=Depends(admin_only)):
    doc = data.model_dump()
    doc["violation_map"] = sheet.merge_violation_map(doc.get("violation_map"))
    await db.settings.update_one({"id": "sheet_params"}, {"$set": {"id": "sheet_params", **doc}}, upsert=True)
    return await sheet_params_doc()


async def build_sheet(month: str, only_employee: Optional[str] = None) -> dict:
    params = await sheet_params_doc()
    m = await db.sheet_months.find_one({"month": month}, {"_id": 0})
    turnover = (m or {}).get("turnover")
    emps = await db.employees.find({"$or": [{"status": "active"}, {"id": only_employee}]} if only_employee else {"status": "active"}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    entries = {x["employee_id"]: x for x in await db.sheet_entries.find({"month": month}, {"_id": 0}).to_list(2000)}
    vio = {x["employee_id"]: x for x in await db.violation_entries.find({"month": month}, {"_id": 0}).to_list(2000)}
    rows_in = []
    for e in emps:
        x = entries.get(e["id"], {})
        counts = vio.get(e["id"], {}).get("counts") or {}
        auto = sheet.derive_inputs(params["violation_map"], counts)  # الهندام/الاحترام/الأيام تُحسب تلقائيًا من سجل المخالفات
        rows_in.append({"id": e["id"], "name": e["full_name"], "perf_type": e.get("perf_type", "pool"),
                        "post_weight": e.get("post_weight"), "hygiene": auto["hygiene"], "respect": auto["respect"],
                        "losses": x.get("losses"), "days": auto["days"], "base": x.get("base"), "hits": auto["hits"],
                        "violations": sum(int(v) for v in counts.values())})
    res = sheet.calc_sheet(params, turnover, rows_in)
    res["month"], res["turnover"] = month, turnover
    return res


@api.get("/sheet")
async def get_sheet(month: Optional[str] = None, user=Depends(staff_only)):
    res = await build_sheet(month or current_month())
    if user["role"] != "admin":  # المراقب يرى النتائج والحالة دون المبالغ بالدينار
        for r in res["rows"]:
            for k in ("s", "t", "u"):
                r[k] = None
        res["totals"], res["pool"], res["turnover"] = None, None, None
    return res


@api.put("/sheet/turnover")
async def put_sheet_turnover(data: SheetTurnoverIn, _=Depends(admin_only)):
    await db.sheet_months.update_one({"month": data.month}, {"$set": {"month": data.month, "turnover": data.turnover}}, upsert=True)
    return {"month": data.month, "turnover": data.turnover}


@api.put("/sheet/entry")
async def put_sheet_entry(data: SheetEntryIn, user=Depends(staff_only)):
    emp = await db.employees.find_one({"id": data.employee_id}, {"_id": 0, "perf_type": 1})
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    doc = data.model_dump()
    if emp.get("perf_type", "pool") == "pool":
        doc["base"] = None  # العامل لا أساس عمولة له (يبقى عمود الأساس فارغًا كما في Excel)
    if user["role"] != "admin":  # الأساس (رقم الأعمال/المسترد/الأمتار) من اختصاص المسير
        old = await db.sheet_entries.find_one({"employee_id": data.employee_id, "month": data.month}, {"_id": 0, "base": 1})
        doc["base"] = (old or {}).get("base")
    doc["updated_at"] = now_utc()
    await db.sheet_entries.update_one({"employee_id": data.employee_id, "month": data.month}, {"$set": doc}, upsert=True)
    return {"ok": True}


@api.get("/violations-log")
async def get_violations_log(month: Optional[str] = None, _=Depends(staff_only)):
    month = month or current_month()
    emps = await db.employees.find({"status": "active"}, {"_id": 0}).sort("created_at", 1).to_list(2000)
    ents = {x["employee_id"]: x for x in await db.violation_entries.find({"month": month}, {"_id": 0}).to_list(2000)}
    rows = [{"employee_id": e["id"], "name": e["full_name"], "counts": ents.get(e["id"], {}).get("counts", {}),
             "note": ents.get(e["id"], {}).get("note", ""), "follow_date": ents.get(e["id"], {}).get("follow_date", "")} for e in emps]
    res = sheet.violations_summary(rows)
    res.update(month=month, types=[{"code": c, "label": l} for c, l in sheet.VIOLATION_TYPES], alert_threshold=sheet.ALERT_THRESHOLD)
    return res


@api.put("/violations-log/entry")
async def put_violation_entry(data: ViolationEntryIn, _=Depends(staff_only)):
    if not await db.employees.find_one({"id": data.employee_id}, {"_id": 1}):
        raise HTTPException(404, "الموظف غير موجود")
    counts = {c: max(0, int(data.counts.get(c, 0) or 0)) for c in sheet.VIOLATION_CODES if int(data.counts.get(c, 0) or 0) > 0}
    doc = {"employee_id": data.employee_id, "month": data.month, "counts": counts, "note": data.note, "follow_date": data.follow_date, "updated_at": now_utc()}
    await db.violation_entries.update_one({"employee_id": data.employee_id, "month": data.month}, {"$set": doc}, upsert=True)
    return {"ok": True, "counts": counts}


@api.get("/me/sheet")
async def my_sheet(month: Optional[str] = None, user=Depends(current_user)):
    if not user.get("employee_id"):
        raise HTTPException(404, "حسابك غير مرتبط بملف موظف بعد")
    month = month or current_month()
    res = await build_sheet(month, only_employee=user["employee_id"])
    row = next((r for r in res["rows"] if r["id"] == user["employee_id"]), None)
    if not row:
        raise HTTPException(404, "الموظف غير موجود")
    return {"month": month, "row": row, "params": res["params"]}

# ------------------------------- Seed -------------------------------------


async def seed():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin = await db.users.find_one({"email": admin_email})
    if not admin:
        await db.users.insert_one({"id": new_id(), "email": admin_email, "name": "المسير العام", "role": "admin",
                                   "password_hash": hash_pw(os.environ["ADMIN_PASSWORD"]), "created_at": now_utc()})
    elif not bcrypt.checkpw(os.environ["ADMIN_PASSWORD"].encode(), admin["password_hash"].encode()):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_pw(os.environ["ADMIN_PASSWORD"])}})
    insp_email = os.environ.get("INSPECTOR_EMAIL", "inspector@company.dz").lower()
    if not await db.users.find_one({"email": insp_email}):
        await db.users.insert_one({"id": new_id(), "email": insp_email, "name": "المراقب", "role": "inspector",
                                   "password_hash": hash_pw(os.environ.get("INSPECTOR_PASSWORD", "Inspector@123")), "created_at": now_utc()})
    if not await db.settings.find_one({"id": "global"}):
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
    if await db.positions.count_documents({}):
        return
    positions = [
        {"id": new_id(), "name": "تجاري", "point_value": None, "kpis": [
            {"id": new_id(), "name": "رقم المبيعات اليومي", "weight": 50, "target": 40000, "unit": "دج"},
            {"id": new_id(), "name": "عدد الزبائن المخدومين", "weight": 30, "target": 25, "unit": "زبون"},
            {"id": new_id(), "name": "الانضباط والحضور", "weight": 20, "target": 1, "unit": "يوم"}]},
        {"id": new_id(), "name": "مالية", "point_value": None, "kpis": [
            {"id": new_id(), "name": "دقة الصندوق", "weight": 40, "target": 100, "unit": "%"},
            {"id": new_id(), "name": "عدد العمليات", "weight": 35, "target": 120, "unit": "عملية"},
            {"id": new_id(), "name": "الانضباط والحضور", "weight": 25, "target": 1, "unit": "يوم"}]},
        {"id": new_id(), "name": "تقطيع", "point_value": None, "kpis": [
            {"id": new_id(), "name": "عدد القطع المنجزة", "weight": 50, "target": 200, "unit": "قطعة"},
            {"id": new_id(), "name": "جودة القص (بدون عيوب)", "weight": 30, "target": 100, "unit": "%"},
            {"id": new_id(), "name": "الانضباط والحضور", "weight": 20, "target": 1, "unit": "يوم"}]},
        {"id": new_id(), "name": "عامل", "point_value": None, "kpis": [
            {"id": new_id(), "name": "الانضباط والحضور", "weight": 100, "target": 1, "unit": "يوم"}]},
    ]
    await db.positions.insert_many([dict(p) for p in positions])
    types = [
        {"id": new_id(), "name": "تأخر عن موعد العمل", "deduction_type": "points", "value": 2, "active": True},
        {"id": new_id(), "name": "غياب غير مبرر", "deduction_type": "percent", "value": 10, "active": True},
        {"id": new_id(), "name": "مغادرة قبل الوقت", "deduction_type": "points", "value": 2, "active": True},
        {"id": new_id(), "name": "عدم ارتداء الزي الرسمي", "deduction_type": "points", "value": 1, "active": True},
        {"id": new_id(), "name": "عجز في الصندوق", "deduction_type": "amount", "value": 500, "active": True},
        {"id": new_id(), "name": "سوء معاملة الزبون", "deduction_type": "percent", "value": 5, "active": True},
    ]
    await db.infraction_types.insert_many([dict(t) for t in types])
    # الموظفون كما في جدول الأداء المعتمد: (الاسم، الهاتف، البريد، المنصب، الراتب، نوع الأداء، وزن المنصب)
    emps_spec = [("أحمد (تجاري)", "0550123456", "employee@company.dz", 0, 45000, "commercial", None),
                 ("محمد (تجاري)", "0661234567", None, 0, 42000, "commercial", None),
                 ("عمر (مالية)", "0770345678", None, 1, 45000, "finance", None),
                 ("يوسف (تقطيع)", "0555987654", None, 2, 40000, "cutting", None),
                 ("عادل (تقطيع)", "0555111222", None, 2, 40000, "cutting", None),
                 ("عون الصقل (عامل)", "0555333444", None, 3, 38000, "pool", 1),
                 ("السائق (عامل)", "0555555666", None, 3, 38000, "pool", 1),
                 ("عون الشحن (عامل)", "0555777888", None, 3, 38000, "pool", 1)]
    sheet_sample = [  # (النظافة، الاحترام، الخسائر، الأيام، الأساس) — من أمثلة ملف Excel
        (0.9, "نعم", 0, 0, 1500000), (1, "نعم", 0, 0, 2500000), (1, "نعم", 0, 0, 1500000),
        (0.8, "نعم", 0, 1, 450), (1, "نعم", 0, 0, 380), (0.95, "نعم", 6000, 1, None),
        (1, "نعم", 0, 0, None), (0.9, "لا", 12000, 2, None)]
    import random
    rnd = random.Random(7)
    today = date_cls.today()
    month = current_month()
    await db.sheet_months.update_one({"month": month}, {"$set": {"month": month, "turnover": 4000000.0}}, upsert=True)
    for (name, phone, email, pi, sal, ptype, pweight), sm in zip(emps_spec, sheet_sample):
        eid = new_id()
        await db.employees.insert_one({"id": eid, "full_name": name, "phone_enc": enc(phone), "email": email,
                                       "position_id": positions[pi]["id"], "hire_date": "2023-03-01",
                                       "base_salary_enc": enc(sal), "status": "active", "perf_type": ptype,
                                       "post_weight": pweight, "created_at": now_utc()})
        await db.sheet_entries.insert_one({"employee_id": eid, "month": month, "hygiene": sm[0], "respect": sm[1],
                                           "losses": sm[2], "days": sm[3], "base": sm[4], "updated_at": now_utc()})
        if sm[3] >= 1:
            await db.violation_entries.insert_one({"employee_id": eid, "month": month, "counts": {"late": int(sm[3])},
                                                   "note": "", "follow_date": "", "updated_at": now_utc()})
        if email:
            await sync_employee_user(eid, name, email, "Employee@123")
        for back in range(min(today.day - 1, 10), -1, -1):
            d = (today - timedelta(days=back)).isoformat()
            for k in positions[pi]["kpis"]:
                f = rnd.uniform(0.7, 1.15)
                ach = 1 if k["unit"] == "يوم" and rnd.random() > 0.1 else (0 if k["unit"] == "يوم" else round(k["target"] * f))
                await db.performance_entries.insert_one({"id": new_id(), "employee_id": eid, "date": d, "kpi_id": k["id"],
                                                         "target": k["target"], "achieved": min(ach, k["target"] * 1.2) if k["unit"] == "%" else ach})
            if rnd.random() < 0.2:
                await db.infractions.insert_one({"id": new_id(), "employee_id": eid, "type_id": rnd.choice(types)["id"],
                                                 "date": d, "note": "", "created_at": now_utc()})


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await seed()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
