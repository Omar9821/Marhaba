# يقارن محرك sheet_engine بنتائج ملف Excel المعتمد (حالات عشوائية محسوبة بـ LibreOffice)
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sheet_engine import calc_sheet, derive_inputs, merge_violation_map, violations_summary  # noqa: E402

GOLDEN = json.loads((Path(__file__).parent / "sheet_golden.json").read_text(encoding="utf-8"))


def close(a, b):
    if a in (None, "") or b in (None, ""):
        return (a in (None, "")) and (b in (None, ""))
    return math.isclose(float(a), float(b), rel_tol=1e-9, abs_tol=1e-9)


def test_matches_excel():
    for ci, case in enumerate(GOLDEN):
        res = calc_sheet(case["params"], case["turnover"], case["rows"])
        assert close(res["pool"], case["expected_pool"]), ci
        assert close(res["pool_weights"], case["expected_pool_w"]), ci
        for ri, (row, exp) in enumerate(zip(res["rows"], case["expected"])):
            for k in ("c", "e", "g", "i", "q", "r", "s", "t", "u"):
                assert close(row[k], exp[k]), (ci, ri, k, row[k], exp[k])
            assert row["status"] == (exp["status"] or ""), (ci, ri, row["status"], exp["status"])
        for k, v in case["expected_totals"].items():
            assert close(res["totals"][k], v), (ci, k, res["totals"][k], v)


def test_violations_summary():
    s = violations_summary([{"employee_id": "a", "counts": {"late": 2, "phone": 1}},
                            {"employee_id": "b", "counts": {"smoking": 1}},
                            {"employee_id": "c", "counts": {}}])
    assert s["total"] == 4 and s["employees_with"] == 2 and s["expected_alerts"] == 1
    assert {t["code"]: t["count"] for t in s["by_type"]}["late"] == 2


def test_violations_feed_sheet():
    vm = merge_violation_map({"phone": "none"})
    d = derive_inputs(vm, {"late": 2, "absence": 1, "ppe": 1, "phone": 5})
    assert d["days"] == 3 and d["hygiene"] == 0.0 and d["respect"] == "نعم"
    assert derive_inputs(vm, {"verbal_violence": 1})["respect"] == "لا"
    clean = derive_inputs(vm, {})
    assert clean["days"] == 0 and clean["hygiene"] == 1.0 and clean["respect"] == "نعم"
    row = {"name": "x", "perf_type": "pool", "post_weight": 1, "hygiene": d["hygiene"], "respect": d["respect"], "days": d["days"], "losses": None}
    q = calc_sheet(None, 1000000, [row])["rows"][0]["q"]
    assert abs(q - (0 + 0.04 + 0.08 * (1 - 3 / 4)) / (0.06 + 0.04 + 0.08)) < 1e-9
