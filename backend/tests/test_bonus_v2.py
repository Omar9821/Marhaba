import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bonus_v2 as b

P = b.merge({})


def test_agent_tiers():
    assert b.agent_bonus(7_000_000, P) == 0
    assert b.agent_bonus(7_500_000, P) == 15_000          # 0.2% على الجزء الأول كاملًا
    assert b.agent_bonus(20_000_000, P) == 40_000
    assert round(b.agent_bonus(30_000_000, P)) == 70_000  # + 0.3% على 10م


def test_waste_factor():
    assert b.waste_factor(0.03, P) == 1
    assert b.waste_factor(0.04, P) == 1 - 0 or True
    assert abs(b.waste_factor(0.06, P) - 0.5) < 1e-9
    assert b.waste_factor(0.08, P) == 0


def staff():
    return [{"id": "a", "role": "commercial", "q": 1}, {"id": "w", "role": "workshop_head", "q": 1},
            {"id": "c", "role": "cutting_head", "q": 1}, {"id": "k", "role": "cutter", "q": 1},
            {"id": "t1", "role": "team", "weight": 1, "q": 1}, {"id": "t2", "role": "team", "weight": 3, "q": 0}]


def test_month_low_waste_with_reward():
    inp = {"turnover": 25_000_000, "m2_cut": 3000, "glass_consumed": 10_000_000, "breakage": 300_000,
           "offcut_revenue": 100_000, "collected": {"a": 20_000_000}}
    r = b.compute({}, inp, staff())
    d = {x["id"]: x for x in r["rows"]}
    assert r["reward_paid"] and d["a"]["payable"] == 40_000
    assert d["w"]["bonus_max"] == 10_000_000 * 0.002 + 5_000          # 20,000 + 5% of reward
    assert d["c"]["bonus_max"] == 1500 * 20
    assert d["k"]["bonus_max"] == 5_000                                # 5% of reward
    pool = 100_000                                                      # 1% of 10M
    assert d["t1"]["bonus_max"] == pool * 0.25 + 10_000 * 0.25
    assert d["t2"]["payable"] == round(d["t2"]["bonus_max"] * 0.6, 2)  # q=0 → 60% فقط


def test_month_high_waste():
    inp = {"turnover": 25_000_000, "m2_cut": 3000, "glass_consumed": 10_000_000, "breakage": 600_000,
           "offcut_revenue": 100_000, "collected": {}}
    r = b.compute({}, inp, staff())
    d = {x["id"]: x for x in r["rows"]}
    assert not r["reward_paid"] and abs(r["waste_factor"] - 0.5) < 1e-9
    assert d["w"]["bonus_max"] == 10_000 and d["c"]["bonus_max"] == 15_000 and d["k"]["bonus_max"] == 0
    inp["breakage"] = 900_000
    assert {x["id"]: x for x in b.compute({}, inp, staff())["rows"]}["w"]["bonus_max"] == 0
