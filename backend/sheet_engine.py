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

# نوع المنصب -> (مفتاح النسبة/السعر، مفتاح الحصة المشروطة)
PERF_TYPES = {
    "commercial": ("rate_commercial", "share_commercial"),
    "finance": ("rate_finance", "share_finance"),
    "cutting": ("price_meter", "share_cutting"),
}
PERF_TYPE_LABELS = {"commercial": "تجاري", "finance": "مالية", "cutting": "تقطيع", "pool": "عامل (مجمَّع)"}


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


def _has_base(e: dict) -> bool:
    """الصف صف عمولة فقط إذا كان نوعه تجاري/مالية/تقطيع وأُدخل الأساس (J/L/N رقم)."""
    return (e.get("perf_type") or "pool") in PERF_TYPES and _num(e.get("base")) is not None


def merge_params(p: Optional[dict]) -> dict:
    out = dict(DEFAULT_PARAMS)
    for k in DEFAULT_PARAMS:
        if p and p.get(k) is not None:
            out[k] = float(p[k])
    return out


def calc_row(p: dict, e: dict, pool_total_w: float, pool: float) -> dict:
    """e: name, perf_type, hygiene, respect, losses, days, base, post_weight.
    يعيد المعاملات (C,E,G,I) والنتيجة Q والمضاعف R والمنحة القصوى S والمستحقة T والفرق U والحالة V."""
    hyg, resp = _num(e.get("hygiene")), e.get("respect")
    loss, days = _num(e.get("losses")), _num(e.get("days"))
    ptype = e.get("perf_type") or "pool"
    base = _num(e.get("base")) if ptype in PERF_TYPES else None
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

    rate_key = share = None
    if ptype in PERF_TYPES:
        rate_key, share_key = PERF_TYPES[ptype]
        share = p[share_key]
    r = None
    if q is not None:
        r = (1 - share) + share * q if base is not None else q

    s = None
    if base is not None:
        s = base * p[rate_key]
    elif pw is not None and pool_total_w > 0 and pool > 0:
        s = pool * pw / pool_total_w
    t = s * r if (s is not None and r is not None) else None
    u = s - t if t is not None else None

    if q is None:
        status = "أدخل نتائج المؤشرات"
    elif base is not None:
        status = "حدّد النسبة / سعر المتر في صف المعاملات" if _n(p[rate_key]) == 0 else "✔"
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
    pool_w = sum(_n(e.get("post_weight")) for e in employees if not _has_base(e))
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
VIOLATION_TYPES = [
    ("late", "تأخر"), ("unauth_exit", "خروج غير مرخص"), ("phone", "هاتف"),
    ("cleanliness", "نظافة/ترتيب"), ("ppe", "معدات حماية"), ("absence", "غياب غير مبرر"),
    ("left_no_permission", "مغادرة دون إذن"), ("negligence", "إهمال متعمد"),
    ("verbal_violence", "عنف لفظي"), ("smoking", "تدخين"),
]
VIOLATION_CODES = [c for c, _ in VIOLATION_TYPES]
# أثر كل نوع مخالفة على مؤشرات الجدول (قابل للتعديل من الإعدادات):
#   days = التأخرات والغيابات (كل مخالفة = يوم) · hygiene = الهندام والنظافة · respect = الاحترام · none = لا يؤثر
IMPACT_GROUPS = ("days", "hygiene", "respect", "none")
DEFAULT_VIOLATION_MAP = {
    "late": "days", "unauth_exit": "days", "absence": "days", "left_no_permission": "days",
    "cleanliness": "hygiene", "ppe": "hygiene", "smoking": "hygiene",
    "verbal_violence": "respect", "negligence": "respect", "phone": "respect",
}


def merge_violation_map(m: Optional[dict]) -> dict:
    out = dict(DEFAULT_VIOLATION_MAP)
    for k, v in (m or {}).items():
        if k in out and v in IMPACT_GROUPS:
            out[k] = v
    return out


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


def violations_summary(rows: list) -> dict:
    """rows: [{employee_id, counts:{code:int}}]. يطابق L (المجموع) وصف 20 والملخص الشهري."""
    out_rows, col = [], {c: 0 for c in VIOLATION_CODES}
    for r in rows:
        counts = {c: int(_n((r.get("counts") or {}).get(c))) for c in VIOLATION_CODES}
        total = sum(counts.values())
        for c, v in counts.items():
            col[c] += v
        out_rows.append({**r, "counts": counts, "total": total})
    grand = sum(col.values())
    return {"rows": out_rows, "by_type": [{"code": c, "label": l, "count": col[c]} for c, l in VIOLATION_TYPES],
            "total": grand, "employees_with": sum(1 for r in out_rows if r["total"] > 0),
            "expected_alerts": sum(1 for r in out_rows if r["total"] >= ALERT_THRESHOLD)}
