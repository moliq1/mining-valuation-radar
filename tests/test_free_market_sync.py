"""Unit tests use synthetic quotes only; no network or third-party API keys."""
import copy
import csv
import tempfile
from unittest.mock import patch
import datetime as dt
import importlib.util
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location(
    "free_market_sync", Path(__file__).resolve().parents[1] / "scripts" / "free_market_sync.py"
)
fm = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fm)
TODAY = dt.date(2026, 10, 12)
DAYS = [(TODAY - dt.timedelta(days=i)).isoformat() for i in range(14, -1, -1)]


def bars(start=20):
    return [[day, float(start + i)] for i, day in enumerate(DAYS)]


def fixture():
    snapshot = {
        "schemaVersion": 1,
        "updatedAt": "2026-10-08",
        "stocks": [
            {"ticker": "601899.SH", "asOf": "2026-10-08", "price": 29.37,
             "previous5d": None, "event": "none", "cashflow": "pass", "quality": "complete"},
            {"ticker": "02899.HK", "asOf": "2026-10-08", "price": 31.28,
             "previous5d": None, "event": "unknown", "cashflow": "pending", "quality": "pending"},
        ],
        "market": {"metal5d": {"gold": 0.5, "silver": 0.5, "copper": 0.5}},
    }
    history = {
        "schemaVersion": 1, "updatedAt": None, "provider": "unset",
        "status": "unconfigured", "series": {"gold": [], "zijinA": [], "zijinH": []},
    }
    return snapshot, history


class FreeMarketTest(unittest.TestCase):
    def test_parse_chinese_and_english_source(self):
        x = [{"日期": "2026-10-09", "收盘": "30.52", "股票代码": "601899"},
             {"日期": "2026-10-08", "收盘": 29.37, "股票代码": "601899"}]
        out = fm.parse_rows(x, code="601899")
        self.assertEqual(out[0], ["2026-10-08", 29.37])
        self.assertEqual(len(out), 2)
        self.assertEqual(fm.parse_rows([{"date": "2026-10-08", "close": 20}])[0][1], 20)

    def test_wrong_code_and_bad_prices_fail(self):
        with self.assertRaises(ValueError):
            fm.parse_rows([{"股票代码": "000001", "日期": "2026-10-09", "收盘": 30}], code="601899")
        with self.assertRaises(ValueError):
            fm.parse_rows([{"日期": "2026-10-09", "收盘": 0}])
        with self.assertRaises(ValueError):
            fm.parse_rows([{"日期": "2026-10-09", "收盘": 1},
                           {"日期": "2026-10-09", "收盘": 1}])

    def test_fallback_after_primary_fails(self):
        logs = []
        def primary(*args):
            logs.append("primary")
            raise RuntimeError("provider down")
        def backup(*args):
            logs.append("backup")
            return bars(20)
        result, source, warnings = fm.pick_stock_history(
            "601899", "A", "20260901", "20261012", TODAY, primary, backup
        )
        self.assertEqual(source, "efinance")
        self.assertEqual(logs, ["primary", "backup"])
        self.assertTrue(warnings)
        self.assertEqual(result[-1][0], TODAY.isoformat())

    def test_cmoc_tertiary_fallback_only_for_cmoc(self):
        attempts = []
        def bad_primary(*args):
            attempts.append("akshare")
            raise ValueError("disconnected")
        def bad_secondary(*args):
            attempts.append("efinance")
            raise ValueError("disconnected")
        def working_third(*args):
            attempts.append("third")
            return bars(15)
        for code, board in [("603993", "A"), ("03993", "H")]:
            attempts.clear()
            data, source, warnings = fm.pick_stock_history(
                code, board, "20260901", "20261012", TODAY,
                bad_primary, bad_secondary, working_third,
            )
            self.assertEqual(attempts, ["akshare", "efinance", "third"])
            self.assertEqual(source, "BaoStock" if board == "A" else "yfinance")
            self.assertEqual(data[-1][0], TODAY.isoformat())
            self.assertEqual(len(warnings), 2)
        attempts.clear()
        with self.assertRaises(ValueError):
            fm.pick_stock_history(
                "601899", "A", "20260901", "20261012", TODAY,
                bad_primary, bad_secondary, working_third,
            )
        self.assertEqual(attempts, ["akshare", "efinance"])

    def test_third_source_fails_closed_if_stale(self):
        def fail(*args):
            raise RuntimeError("blocked")
        def stale(*args):
            return [[(TODAY - dt.timedelta(days=40-i)).isoformat(), float(i+20)] for i in range(15)]
        with self.assertRaisesRegex(ValueError, "stale"):
            fm.pick_stock_history(
                "03993", "H", "20260901", "20261012", TODAY,
                fail, fail, stale,
            )

    def test_csv_artifact_gold_identity_and_sparse_calendar(self):
        history = {
            "schemaVersion": 1, "goldInstrument": "SGE Au99.99",
            "goldUnit": "CNY/g",
            "series": {
                "gold": [["2026-10-12", 902.9], ["2026-10-09", 895.0]],
                "zijinA": [["2026-10-09", 30.0], ["2026-10-12", 30.22]],
                "zijinH": [["2026-10-12", 32.58]],
            },
        }
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "market-history.csv"
            n = fm.history_to_csv(history, target)
            with target.open(encoding="utf-8-sig", newline="") as file:
                records = list(csv.DictReader(file))
            self.assertEqual(n, 2)
            self.assertEqual(records[0]["gold_unit"], "CNY/g")
            self.assertEqual(records[0]["gold_instrument"], "SGE Au99.99")
            self.assertEqual(records[0]["zijin_h"], "")
            self.assertEqual(records[1]["zijin_h"], "32.58")

    def test_csv_artifact_rejects_unknown_gold_units(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                fm.history_to_csv({
                    "series": {"gold": [["2026-10-12", 900]]},
                    "goldInstrument": "XAU/USD", "goldUnit": "CNY/g",
                }, Path(folder) / "wrong.csv")

    def test_stale_rejected(self):
        old = [[(TODAY - dt.timedelta(days=20-i)).isoformat(), 20+i] for i in range(6)]
        with self.assertRaises(ValueError):
            fm.recent_valid(old, TODAY)

    def test_conflicting_same_day_prevents_merge(self):
        with self.assertRaises(ValueError):
            fm.merge_bars([["2026-10-08", 20]], [["2026-10-08", 35]])

    def test_sge_separate_gold_unit_never_labels_xau(self):
        stock, history = fixture()
        s, h, report = fm.apply_daily_data(
            stock, history, {}, bars(500), today=TODAY
        )
        self.assertTrue(report["goldUpdated"])
        self.assertEqual(h["goldInstrument"], "SGE Au99.99")
        self.assertEqual(h["goldUnit"], "CNY/g")
        self.assertEqual(s["market"]["metal5d"]["gold"], None)
        history["goldInstrument"] = "XAU/USD"
        history["series"]["gold"] = [["2026-10-08", 4500.0]]
        _, old, res = fm.apply_daily_data(stock, history, {}, bars(500), today=TODAY)
        self.assertFalse(res["goldUpdated"])
        self.assertEqual(old["series"]["gold"], [["2026-10-08", 4500.0]])

    def test_new_date_invalidates_old_checks(self):
        stock, history = fixture()
        s, h, report = fm.apply_daily_data(
            stock, history, {"601899.SH": (bars(30), "AKShare")}, None, today=TODAY
        )
        self.assertIn("601899.SH", report["updated"])
        new = s["stocks"][0]
        self.assertEqual(new["asOf"], "2026-10-12")
        self.assertEqual(new["previous5d"], bars(30)[-6][1])
        self.assertEqual(new["event"], "unknown")
        self.assertEqual(new["cashflow"], "pending")
        self.assertEqual(len(h["series"]["zijinA"]), 15)
        self.assertEqual(s["market"]["metal5d"]["gold"], None)

    def test_same_day_unchanged_check_preserved(self):
        stock, history = fixture()
        original = stock["stocks"][0]
        one = bars(20)
        one[-1] = ["2026-10-08", 29.37]
        one = [[(dt.date(2026, 9, 24)+dt.timedelta(days=i)).isoformat(), 20+i] for i in range(14)]
        one[-1] = ["2026-10-08", 29.37]
        s, _, _ = fm.apply_daily_data(stock, history, {"601899.SH": (one, "AKShare")}, None, today=TODAY)
        self.assertEqual(original["event"], "none")
        self.assertEqual(s["stocks"][0]["event"], "none")

    def test_failure_does_not_overwrite_history(self):
        stock, history = fixture()
        _, _, report = fm.apply_daily_data(
            stock, history, {"601899.SH": (bars(22), "AKShare")}, None, today=TODAY
        )
        self.assertEqual(len(report["updated"]), 1)
        # Force same-day conflicting historical bar.
        history["series"]["zijinA"] = [["2026-10-12", 999]]
        _, out, report = fm.apply_daily_data(
            stock, history, {"601899.SH": (bars(22), "AKShare")}, None, today=TODAY
        )
        self.assertTrue(report["failed"])
        self.assertEqual(out["series"]["zijinA"], history["series"]["zijinA"])


if __name__ == "__main__":
    unittest.main()
