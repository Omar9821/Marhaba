# يقارن محرك sheet_engine بنتائج ملف Excel المعتمد (حالات عشوائية محسوبة بـ LibreOffice)
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sheet_engine import calc_sheet, violations_summary  # noqa: E402

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
