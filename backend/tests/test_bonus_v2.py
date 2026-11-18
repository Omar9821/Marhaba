import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bonus_v2 as b

P = b.merge({})


def test_agent_only_excess_over_threshold():
    assert b.agent_bonus(7_000_000, P) == 0
    assert b.agent_bonus(7_500_000, P) == 0
    assert round(b.agent_bonus(12_500_000, P)) == 10_000          # 0.2% × 5م
    assert round(b.agent_bonus(20_000_000, P)) == 25_000          # 0.2% × 12.5م
    assert round(b.agent_bonus(30_000_000, P)) == 55_000          # + 0.3% × 10م


def test_waste_factor():
    assert b.waste_factor(0.03, P) == 1
    assert abs(b.waste_factor(0.06, P) - 0.5) < 1e-9
    assert b.waste_factor(0.08, P) == 0


def staff():
    s = {"g": 0.12, "wsum": 0.30}   # نقاط الخسائر كاملة 12 من 30
    return [{"id": "a", "role": "commercial", "q": 1},
            {"id": "w", "role": "workshop_head", "q": 1, "s": s},
            {"id": "c", "role": "cutting_head", "q": 1, "s": s},
            {"id": "k", "role": "cutter", "q": 1, "s": s},
            {"id": "t1", "role": "team", "weight": 1, "q": 1}, {"id": "t2", "role": "team", "weight": 3, "q": 0}]


def run(breakage, extra=None):
    inp = {"turnover": 25_000_000, "m2_by_emp": {"c": 2500, "k": 2000}, "glass_consumed": 10_000_000,
           "breakage": breakage, "offcut_revenue": 100_000, "collected": {"a": 20_000_000}, **(extra or {})}
    r = b.compute({}, inp, staff())
    return r, {x["id"]: x for x in r["rows"]}


def test_low_waste():
    r, d = run(300_000)
    assert r["reward_paid"] and d["a"]["payable"] == 25_000
    assert d["w"]["bonus_max"] == 20_000 + 5_000 and d["w"]["payable"] == d["w"]["bonus_max"]
    assert d["c"]["bonus_max"] == 1000 * 20
    assert d["k"]["bonus_max"] == 500 * 20 + 5_000                # أمتاره فوق 1500 + 5% من المكافأة
    assert d["t1"]["bonus_max"] == 100_000 * 0.25 + 10_000 * 0.25
    assert d["t2"]["payable"] == round(d["t2"]["bonus_max"] * 0.6, 2)


def test_waste_hits_only_loss_points():
    r, d = run(600_000)                                            # 6% → المعامل 0.5
    assert not r["reward_paid"]
    assert d["w"]["bonus_max"] == 20_000                          # المنحة القصوى لا تتأثر
    # q: 1 - 0.12*0.5/0.30 = 0.8 → 0.6 + 0.4*0.8 = 0.92
    assert abs(d["w"]["payable"] - 20_000 * 0.92) < 1e-6
    r, d = run(900_000)                                            # 9% → معيار الخسائر صفر → q=0.6
    assert abs(d["w"]["payable"] - 20_000 * (0.6 + 0.4 * 0.6)) < 1e-6
    assert abs(d["k"]["payable"] - 10_000 * (0.6 + 0.4 * 0.6)) < 1e-6   # عون التقطيع يتأثر مثل مسؤول الورشة
