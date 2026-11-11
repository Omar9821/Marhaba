"""محرك «جدول الأداء والمردودية المبسط» — نسخة طبق الأصل من معادلات ملف Excel المعتمد.

دوال نقية (بدون قاعدة بيانات) كي يمكن اختبارها ومقارنتها مباشرة بنتائج Excel.
مفاتيح المعاملات تقابل خلايا صف «المعاملات» في الملف (B6..O6) وخلايا G2/G3.
"""
from typing import Optional

# ---- المعاملات (تُضبط مرة واحدة) — القيم الافتراضية هي نفسها في ملف Excel ----
DEFAULT_PARAMS = {
    "pass_threshold": 0.85,    # B6  حدّ النجاح (الهندام والنظافة)
    "w_hygiene": 0.06,         # C6  وزن الهندام والنظافة
    "w_respect": 0.04,         # E6  وزن الاحترام
    "loss_limit": 20000.0,     # F6  حدّ الخسائر (دج)
    "w_loss": 0.12,            # G6  وزن الخسائر
    "days_limit": 4.0,         # H6  حدّ الأيام (تأخرات/غيابات)
    "w_days": 0.08,            # I6  وزن التأخرات والغيابات
    "rate_commercial": 0.004,  # J6  نسبة عمولة التجاريين
    "share_commercial": 0.4,   # K6  الحصة المشروطة بالأداء (تجاري)
    "rate_finance": 0.008,     # L6  نسبة عمولة المالية
    "share_finance": 0.4,      # M6  الحصة المشروطة بالأداء (مالية)
    "price_meter": 0.0,        # N6  سعر المتر (التقطيع) — فارغ عمدًا
    "share_cutting": 0.4,      # O6  الحصة المشروطة بالأداء (تقطيع)
    "fund_ratio": 1.0,         # G2  نسبة الفرق للصندوق الترفيهي
    "pool_rate": 0.01,         # G3  نسبة المجمَّع الموزَّع على العمال
}

# أنواع العمولة مرنة: كل نوع {id, label, kind: rate|pool, rate, share, base_label, unit}
#   rate = عمولة على أساس يُدخله المسير (رقم أعمال/مبالغ مستردة/أمتار/…): المنحة القصوى = الأساس × rate
#          والحصة المشروطة بالأداء = share
#   pool = بلا أساس: يوزَّع عليه المجمَّع (رقم الأعمال × pool_rate) حسب وزن المنصب
# القيم الافتراضية هي الأنواع الأربعة الأصلية في ملف Excel.
DEFAULT_COMMISSION_TYPES = [
    {"id": "commercial", "label": "تجاري", "kind": "rate", "rate": 0.004, "share": 0.4,
     "base_label": "رقم الأعمال المحصَّل الصافي", "unit": "دج"},
    {"id": "finance", "label": "مالية", "kind": "rate", "rate": 0.008, "share": 0.4,
     "base_label": "المبالغ المستردة", "unit": "دج"},
    {"id": "cutting", "label": "تقطيع", "kind": "rate", "rate": 0.0, "share": 0.4,
     "base_label": "الأمتار المقطوعة", "unit": "متر"},
    {"id": "pool", "label": "عامل (مجمَّع)", "kind": "pool", "rate": 0.0, "share": 0.0, "base_label": "", "unit": ""},
]
LEGACY_TYPE_KEYS = {"commercial": ("rate_commercial", "share_commercial"),
                    "finance": ("rate_finance", "share_finance"),
                    "cutting": ("price_meter", "share_cutting")}


def clean_commission_types(lst) -> list:
    """ينظّف قائمة الأنواع القادمة من الإعدادات (معرّفات فريدة، kind صالح، نسب ضمن الحدود). يضمن وجود نوع «pool»."""
    out, seen = [], set()
    for t in lst or []:
        tid = str(t.get("id") or "").strip()
        if not tid or tid in seen:
            continue
        seen.add(tid)
        kind = "pool" if t.get("kind") == "pool" else "rate"
        out.append({"id": tid, "label": str(t.get("label") or tid).strip() or tid, "kind": kind,
                    "rate": max(0.0, _n(t.get("rate"))), "share": min(1.0, max(0.0, _n(t.get("share")))),
                    "base_label": str(t.get("base_label") or "").strip(), "unit": str(t.get("unit") or "").strip()})
    if not any(t["kind"] == "pool" for t in out):
        out.append(dict(DEFAULT_COMMISSION_TYPES[3]))
    return out


def type_map(p: dict) -> dict:
    return {t["id"]: t for t in p["commission_types"]}


def _num(v) -> Optional[float]:
    """ISNUMBER: None/'' => None (خلية فارغة)، وإلا رقم."""
    if v is None or v == "" or isinstance(v, bool):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _n(v) -> float:
    """N(): غير الرقم => 0."""
    x = _num(v)
    return 0.0 if x is None else x


def _is_rate_type(types: dict, ptype) -> bool:
    t = types.get(ptype or "pool")
    return bool(t and t["kind"] == "rate")


def _has_base(e: dict, types: dict) -> bool:
    """الصف صف عمولة فقط إذا كان نوعه من نوع «عمولة على أساس» وأُدخل الأساس."""
    return _is_rate_type(types, e.get("perf_type")) and _num(e.get("base")) is not None


def merge_params(p: Optional[dict]) -> dict:
    out = dict(DEFAULT_PARAMS)
    for k in DEFAULT_PARAMS:
        if p and p.get(k) is not None:
            out[k] = float(p[k])
    if p and p.get("commission_types"):
        out["commission_types"] = clean_commission_types(p["commission_types"])
    else:  # توافق مع الإصدار السابق: الأنواع الثلاثة تأخذ نسبها من المفاتيح القديمة
        types = []
        for t in DEFAULT_COMMISSION_TYPES:
            t = dict(t)
            if t["id"] in LEGACY_TYPE_KEYS:
                rk, sk = LEGACY_TYPE_KEYS[t["id"]]
                t["rate"], t["share"] = out[rk], out[sk]
            types.append(t)
        out["commission_types"] = types
    return out


def calc_row(p: dict, e: dict, pool_total_w: float, pool: float) -> dict:
    """e: name, perf_type, hygiene, respect, losses, days, base, post_weight.
    يعيد المعاملات (C,E,G,I) والنتيجة Q والمضاعف R والمنحة القصوى S والمستحقة T والفرق U والحالة V."""
    hyg, resp = _num(e.get("hygiene")), e.get("respect")
    loss, days = _num(e.get("losses")), _num(e.get("days"))
    types = type_map(p)
    ptype = e.get("perf_type") or "pool"
    ctype = types.get(ptype) if _is_rate_type(types, ptype) else None
    base = _num(e.get("base")) if ctype else None
    pw = _num(e.get("post_weight"))

    c = None if hyg is None else (p["w_hygiene"] if hyg >= p["pass_threshold"] else 0.0)
    ee = None if resp in (None, "") else (p["w_respect"] if resp == "نعم" else 0.0)
    g = None if loss is None else (
        (p["w_loss"] if loss == 0 else 0.0) if p["loss_limit"] == 0
        else p["w_loss"] * max(0.0, 1 - loss / p["loss_limit"]))
    i = None if days is None else (
        (p["w_days"] if days == 0 else 0.0) if p["days_limit"] == 0
        else p["w_days"] * max(0.0, 1 - days / p["days_limit"]))

    parts = [(c, p["w_hygiene"]), (ee, p["w_respect"]), (g, p["w_loss"]), (i, p["w_days"])]
    filled = [(v, w) for v, w in parts if v is not None]
    q = None if not filled else sum(v for v, _ in filled) / sum(w for _, w in filled)

    rate = share = None
    if ctype:
        rate, share = ctype["rate"], ctype["share"]
    r = None
    if q is not None:
        r = (1 - share) + share * q if base is not None else q

    s = None
    if base is not None:
        s = base * rate
    elif pw is not None and pool_total_w > 0 and pool > 0:
        s = pool * pw / pool_total_w
    t = s * r if (s is not None and r is not None) else None
    u = s - t if t is not None else None

    if q is None:
        status = "أدخل نتائج المؤشرات"
    elif base is not None:
        status = "حدّد النسبة / سعر المتر في صف المعاملات" if _n(rate) == 0 else "✔"
    elif pw is None:
        status = "أدخل وزن المنصب"
    elif pool == 0:
        status = "حدّد رقم الأعمال ونسبة المجمَّع"
    else:
        status = "✔"
    return {"c": c, "e": ee, "g": g, "i": i, "q": q, "r": r, "s": s, "t": t, "u": u, "status": status}


def calc_sheet(params: Optional[dict], turnover, employees: list) -> dict:
    """employees: قائمة صفوف بنفس مفاتيح calc_row (+ id)."""
    p = merge_params(params)
    pool = _n(turnover) * p["pool_rate"]                                   # K3
    # O3: مجموع أوزان الصفوف التي ليس لها أساس عمولة
    tmap = type_map(p)
    pool_w = sum(_n(e.get("post_weight")) for e in employees if not _has_base(e, tmap))
    rows = []
    for e in employees:
        res = calc_row(p, e, pool_w, pool)
        rows.append({**e, **res})
    sum_s = sum(r["s"] for r in rows if r["s"] is not None)
    sum_t = sum(r["t"] for r in rows if r["t"] is not None)
    sum_u = sum(r["u"] for r in rows if r["u"] is not None)
    fund = sum_u * p["fund_ratio"]
    return {"params": p, "pool": pool, "pool_weights": pool_w, "rows": rows,
            "totals": {"gross": sum_s, "payable": sum_t, "gap": sum_u, "fund": fund, "company_keeps": sum_u - fund}}


# ------------------------------ سجل المخالفات ------------------------------
# أنواع المخالفات قابلة للتعديل من الإعدادات: [{code, label, impact, active}]
# impact: days = التأخرات والغيابات (كل مخالفة = يوم) · hygiene = الهندام والنظافة · respect = الاحترام · none = لا يؤثر
IMPACT_GROUPS = ("days", "hygiene", "respect", "none")
_DEFAULT_V = [
    ("late", "تأخر", "days"), ("unauth_exit", "خروج غير مرخص", "days"), ("phone", "هاتف", "respect"),
    ("cleanliness", "نظافة/ترتيب", "hygiene"), ("ppe", "معدات حماية", "hygiene"), ("absence", "غياب غير مبرر", "days"),
    ("left_no_permission", "مغادرة دون إذن", "days"), ("negligence", "إهمال متعمد", "respect"),
    ("verbal_violence", "عنف لفظي", "respect"), ("smoking", "تدخين", "hygiene"),
]
DEFAULT_VIOLATION_TYPES = [{"code": c, "label": l, "impact": g, "active": True} for c, l, g in _DEFAULT_V]
VIOLATION_TYPES = [(c, l) for c, l, _ in _DEFAULT_V]          # للتوافق مع الاختبارات
VIOLATION_CODES = [c for c, _ in VIOLATION_TYPES]
DEFAULT_VIOLATION_MAP = {c: g for c, _, g in _DEFAULT_V}


def merge_violation_map(m: Optional[dict]) -> dict:
    out = dict(DEFAULT_VIOLATION_MAP)
    for k, v in (m or {}).items():
        if k in out and v in IMPACT_GROUPS:
            out[k] = v
    return out


def clean_violation_types(lst) -> list:
    out, seen = [], set()
    for t in lst or []:
        code = str(t.get("code") or "").strip()
        if not code or code in seen:
            continue
        seen.add(code)
        out.append({"code": code, "label": str(t.get("label") or code).strip() or code,
                    "impact": t.get("impact") if t.get("impact") in IMPACT_GROUPS else "none",
                    "active": t.get("active") is not False})
    return out


def merge_violation_types(stored: Optional[list], legacy_map: Optional[dict] = None) -> list:
    if stored:
        return clean_violation_types(stored)
    vm = merge_violation_map(legacy_map)
    return [{**t, "impact": vm.get(t["code"], t["impact"])} for t in DEFAULT_VIOLATION_TYPES]


def impact_map(vtypes: list) -> dict:
    return {t["code"]: t["impact"] for t in vtypes}


def derive_inputs(vmap: dict, counts: Optional[dict]) -> dict:
    """يحوّل عدّاد المخالفات الشهري إلى مدخلات الجدول: أيام، هندام/نظافة (نجاح كامل أو صفر)، احترام (نعم/لا)."""
    hits = {"days": 0, "hygiene": 0, "respect": 0}
    for code, n in (counts or {}).items():
        g = vmap.get(code, "none")
        if g in hits:
            hits[g] += int(_n(n))
    return {"days": float(hits["days"]), "hygiene": 0.0 if hits["hygiene"] else 1.0,
            "respect": "لا" if hits["respect"] else "نعم", "hits": hits}


ALERT_THRESHOLD = 3  # تنبيهات متوقعة (≥3 مخالفات)


def violations_summary(rows: list, vtypes: Optional[list] = None) -> dict:
    """rows: [{employee_id, counts:{code:int}}]. يطابق L (المجموع) وصف 20 والملخص الشهري."""
    vtypes = vtypes or DEFAULT_VIOLATION_TYPES
    codes = [t["code"] for t in vtypes]
    labels = {t["code"]: t["label"] for t in vtypes}
    out_rows, col = [], {c: 0 for c in codes}
    for r in rows:
        counts = {c: int(_n((r.get("counts") or {}).get(c))) for c in codes}
        total = sum(counts.values())
        for c, v in counts.items():
            col[c] += v
        out_rows.append({**r, "counts": counts, "total": total})
    grand = sum(col.values())
    return {"rows": out_rows, "by_type": [{"code": c, "label": labels[c], "count": col[c]} for c in codes],
            "total": grand, "employees_with": sum(1 for r in out_rows if r["total"] > 0),
            "expected_alerts": sum(1 for r in out_rows if r["total"] >= ALERT_THRESHOLD)}
