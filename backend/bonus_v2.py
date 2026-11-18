"""نظام منح الأداء المعتمد (v2) — دوال نقية، كل المبالغ بالدينار الجزائري وشهرية.

الأدوار: commercial (عون تجاري) · workshop_head (مسؤول الورشة) · cutting_head (مسؤول التقطيع)
         · cutter (عون تقطيع) · team (بقية الفريق بما فيهم محصّل الأموال، بحسب الوزن الوظيفي)
"""
DEFAULTS = {
    "agent_threshold": 7_500_000.0,   # بداية منحة العون التجاري (محصّل كاملًا)
    "agent_tier_cap": 20_000_000.0,   # نهاية الشريحة الأولى
    "agent_rate_1": 0.002,
    "agent_rate_2": 0.003,
    "turnover_threshold": 15_000_000.0,  # عتبة رقم الأعمال لمسؤول الورشة والفريق
    "workshop_rate": 0.002,
    "team_pool_rate": 0.01,
    "cut_m2_threshold": 1500.0,
    "cut_price_m2": 20.0,
    "waste_full": 0.04,               # أقل منه: منحة كاملة + مكافأة الهدر المباع
    "waste_zero": 0.08,               # عنده تنعدم المنحة
    "reward_company": 0.80, "reward_head": 0.05, "reward_team": 0.10, "reward_cutters": 0.05,
    "guaranteed": 0.6,                # الحصة المضمونة؛ الباقي مرتبط بالأداء
}
ROLES = ("commercial", "workshop_head", "cutting_head", "cutter", "team")


def merge(p):
    out = dict(DEFAULTS)
    for k in DEFAULTS:
        if p and p.get(k) is not None:
            out[k] = float(p[k])
    return out


def agent_bonus(collected, p):
    """تُحسب فقط على الجزء الذي يفوق العتبة: 0.2% من العتبة إلى سقف الشريحة، و0.3% فوقه."""
    c = max(0.0, float(collected or 0))
    t, cap = p["agent_threshold"], p["agent_tier_cap"]
    return p["agent_rate_1"] * max(0.0, min(c, cap) - t) + p["agent_rate_2"] * max(0.0, c - max(cap, t))


def waste_ratio(breakage, consumed):
    b, c = float(breakage or 0), float(consumed or 0)
    return b / c if c > 0 else 0.0


def waste_factor(w, p):
    if w < p["waste_full"]:
        return 1.0
    if w >= p["waste_zero"]:
        return 0.0
    return (p["waste_zero"] - w) / (p["waste_zero"] - p["waste_full"])


def adjusted_q(q, s, factor, p):
    """أثر الهدر على مسؤولي الورشة والتقطيع: ينقص معيار الخسائر وحده (وزنه من مجموع المعايير)،
    ولا يمس المنحة القصوى. s: {g: نقاط الخسائر الحالية، wsum: مجموع أوزان المعايير المعبّأة}."""
    if q is None:
        return None
    g, wsum = s.get("g"), s.get("wsum") or 0
    if g is None or wsum <= 0:
        return q
    return max(0.0, q - g * (1 - factor) / wsum)


def _perf(p, q):
    return p["guaranteed"] + (1 - p["guaranteed"]) * (1.0 if q is None else max(0.0, min(1.0, q)))


def compute(params, inp, staff):
    """inp: turnover, m2_cut, glass_consumed, breakage, offcut_revenue, collected{emp_id: دج}.
    staff: [{id,name,role,weight,q}] — q = نتيجة الأداء 0..1 (None = لم تُقيَّم → تُعامَل كاملة)."""
    p = merge(params)
    turnover = float(inp.get("turnover") or 0)
    over = max(0.0, turnover - p["turnover_threshold"])
    w = waste_ratio(inp.get("breakage"), inp.get("glass_consumed"))
    g = waste_factor(w, p)
    reward_ok = w < p["waste_full"] and float(inp.get("offcut_revenue") or 0) > 0
    reward = float(inp.get("offcut_revenue") or 0) if reward_ok else 0.0
    team = [s for s in staff if s["role"] == "team"]
    tw = sum(float(s.get("weight") or 0) for s in team)
    cutters = [s for s in staff if s["role"] == "cutter"]
    heads = [s for s in staff if s["role"] == "workshop_head"]
    pool = over * p["team_pool_rate"]
    rows = []
    for s in staff:
        role, q = s["role"], s.get("q")
        ref = 0.0
        base = None
        if role == "commercial":
            base = float((inp.get("collected") or {}).get(s["id"]) or 0)
            ref = agent_bonus(base, p)
        elif role == "workshop_head":
            ref = over * p["workshop_rate"]
            q = adjusted_q(q, s.get("s") or {}, g, p)
        elif role in ("cutting_head", "cutter"):
            m2 = (inp.get("m2_by_emp") or {}).get(s["id"])
            if m2 is None and role == "cutting_head":
                m2 = inp.get("m2_cut")
            ref = max(0.0, float(m2 or 0) - p["cut_m2_threshold"]) * p["cut_price_m2"]
            if role == "cutting_head":
                q = adjusted_q(q, s.get("s") or {}, g, p)
        elif role == "team" and tw > 0:
            ref = pool * float(s.get("weight") or 0) / tw
        rw = 0.0
        if reward:
            if role == "workshop_head" and heads:
                rw = reward * p["reward_head"] / len(heads)
            elif role == "team" and tw > 0:
                rw = reward * p["reward_team"] * float(s.get("weight") or 0) / tw
            elif role == "cutter" and cutters:
                rw = reward * p["reward_cutters"] / len(cutters)
        mx = ref + rw
        pay = mx * _perf(p, q)
        rows.append({"id": s["id"], "name": s.get("name"), "role": role, "base": base, "q": q,
                     "bonus_max": round(mx, 2), "reward_part": round(rw, 2), "payable": round(pay, 2)})
    paid = sum(r["payable"] for r in rows)
    return {"params": p, "turnover_over": over, "waste_ratio": w, "waste_factor": g, "reward_paid": reward_ok,
            "reward_total": reward, "reward_company": reward * p["reward_company"] if reward_ok else 0.0,
            "pool": pool, "rows": rows, "total_payable": round(paid, 2),
            "total_max": round(sum(r["bonus_max"] for r in rows), 2)}
