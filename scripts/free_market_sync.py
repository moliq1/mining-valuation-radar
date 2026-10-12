#!/usr/bin/env python3
"""Free-market EOD research collector for ORE Radar.

Uses AKShare (primary), efinance (backup for stocks), SGE Au99.99 for gold.
No API key. No data redistribution or public Pages publication without explicit
rights confirmation. An absent/failed provider never causes synthetic prices.
"""
from __future__ import annotations

import argparse
import copy
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data" / "snapshot.json"
HISTORY = ROOT / "data" / "market-history.json"
OZ_PER_GRAM = 1 / 31.1034768
MAX_STALE_DAYS = 9
STOCKS = {
    "601899.SH": ("601899", "A", "CNY"),
    "02899.HK": ("02899", "H", "HKD"),
    "02259.HK": ("02259", "H", "HKD"),
    "600547.SH": ("600547", "A", "CNY"),
    "01787.HK": ("01787", "H", "HKD"),
    "000426.SZ": ("000426", "A", "CNY"),
    "000603.SZ": ("000603", "A", "CNY"),
    "600988.SH": ("600988", "A", "CNY"),
    "06693.HK": ("06693", "H", "HKD"),
    "02099.HK": ("02099", "H", "HKD"),
    "603993.SH": ("603993", "A", "CNY"),
    "03993.HK": ("03993", "H", "HKD"),
}
TRENDS = {"601899.SH": "zijinA", "02899.HK": "zijinH"}


def iso_date(value):
    if isinstance(value, (dt.date, dt.datetime)):
        return value.date().isoformat() if isinstance(value, dt.datetime) else value.isoformat()
    s = str(value).strip()[:10]
    d = dt.date.fromisoformat(s)
    if d.isoformat() != s:
        raise ValueError("Date must be YYYY-MM-DD")
    return s


def parse_rows(rows, *, code=None):
    """Strict common format; no forward fill, zero prices or silent code mismatches."""
    if not isinstance(rows, list) or not rows:
        raise ValueError("Provider returned no daily bars")
    out = {}
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Provider row is not a dictionary")
        supplied = row.get("股票代码", row.get("code"))
        if code and supplied is not None:
            got = str(supplied).strip().upper().replace("HK", "").replace(".0", "")
            if not got.isdigit() or got.zfill(len(code)) != code:
                raise ValueError(f"Wrong stock code {supplied} for {code}")
        day = iso_date(row.get("日期", row.get("date")))
        value = row.get("收盘", row.get("close"))
        try:
            price = float(str(value).replace(",", ""))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Bad close at {day}") from exc
        if not math.isfinite(price) or price <= 0:
            raise ValueError(f"Nonpositive/invalid close {day}")
        if day in out:
            raise ValueError(f"Duplicate daily bar {day}")
        out[day] = round(price, 6)
    return [[d, out[d]] for d in sorted(out)]


def frame_rows(frame):
    if frame is None or not hasattr(frame, "to_dict"):
        raise ValueError("Missing provider DataFrame")
    return frame.to_dict("records")


def fetch_akshare(code, board, start, end):
    import akshare as ak
    if board == "A":
        df = ak.stock_zh_a_hist(symbol=code, period="daily",
                                start_date=start, end_date=end, adjust="")
    else:
        df = ak.stock_hk_hist(symbol=code, period="daily",
                              start_date=start, end_date=end, adjust="")
    return parse_rows(frame_rows(df), code=code)


def fetch_efinance(code, board, start, end):
    import efinance as ef
    # fqt=0 is essential: this dashboard uses nominal unadjusted EOD quotes.
    df = ef.stock.get_quote_history(
        code, beg=start, end=end, klt=101, fqt=0,
        suppress_error=False, use_id_cache=False
    )
    rows = frame_rows(df)
    # Ambiguous stock codes must never silently map to the wrong market.
    if not rows or "股票代码" not in rows[0]:
        raise ValueError("Backup provider cannot verify instrument identity")
    return parse_rows(rows, code=code)


def fetch_sge_gold():
    """Shanghai Au99.99 close in CNY/gram, NOT international spot XAU/USD."""
    import akshare as ak
    df = ak.spot_hist_sge(symbol="Au99.99")
    return parse_rows(frame_rows(df))


def recent_valid(bars, today, min_points=6):
    if len(bars) < min_points:
        raise ValueError(f"Only {len(bars)} bars; require {min_points}")
    age = (today - dt.date.fromisoformat(bars[-1][0])).days
    if age < 0 or age > MAX_STALE_DAYS:
        raise ValueError(f"Latest EOD is future/stale ({bars[-1][0]}; age={age}d)")
    if abs(bars[-1][1] / bars[-6][1] - 1) > .55:
        raise ValueError("Five-session move >55%; possible adjustment or instrument mismatch")
    return bars


def merge_bars(existing, incoming, *, mismatch=.075, limit=1000):
    old = {iso_date(x[0]): float(x[1]) for x in existing}
    for day, close in incoming:
        if day in old and abs(float(close) / old[day] - 1) > mismatch:
            raise ValueError(f"Provider disagrees with published price on {day}")
    old.update((d, float(p)) for d, p in incoming)
    merged = [[d, old[d]] for d in sorted(old)]
    return merged[-limit:]


def pick_stock_history(code, board, start, end, today, primary, backup):
    failures = []
    for name, call in [("AKShare", primary), ("efinance", backup)]:
        try:
            rows = recent_valid(call(code, board, start, end), today)
            return rows, name, failures
        except Exception as exc:
            failures.append(f"{name}: {str(exc)[:180]}")
    raise ValueError("; ".join(failures))


def apply_daily_data(snapshot, history, quotes, gold_bars, *, today, gold_name="SGE Au99.99"):
    """Pure merge; no network. Invalid market bars do not alter existing data."""
    result = copy.deepcopy(snapshot)
    market_history = copy.deepcopy(history)
    report = {"updated": [], "unchanged": [], "failed": [], "goldUpdated": False, "checkedAt": today.isoformat()}
    stockmap = {s["ticker"]: s for s in result["stocks"]}
    latest_snapshot_day = result["updatedAt"]
    for ticker, info in quotes.items():
        if ticker not in STOCKS or ticker not in stockmap:
            continue
        bars, source = info
        try:
            recent_valid(bars, today)
            obj = stockmap[ticker]
            newday, close = bars[-1]
            if newday < obj["asOf"]:
                report["unchanged"].append(ticker + ": older date")
                continue
            if newday == obj["asOf"] and abs(close / obj["price"] - 1) > .075:
                raise ValueError("Same-day source differs from stored closing price >7.5%")
            histkey = TRENDS.get(ticker)
            if histkey:
                oldseries = market_history["series"].get(histkey, [])
                market_history["series"][histkey] = merge_bars(oldseries, bars)
            old_day = obj["asOf"]
            obj["price"], obj["asOf"] = close, newday
            obj["previous5d"] = bars[-6][1]
            if newday > old_day:
                # Changing the quote invalidates any old company-risk checklist.
                obj["event"], obj["cashflow"], obj["quality"] = "unknown", "pending", "pending"
            obj["quoteSource"] = {"provider": source, "underlying": "Eastmoney", "kind": "unadjusted_EOD",
                                  "currency": STOCKS[ticker][2], "asOf": newday}
            latest_snapshot_day = max(latest_snapshot_day, newday)
            report["updated"].append(ticker)
        except Exception as exc:
            report["failed"].append(f"{ticker}: {str(exc)[:180]}")
    # Gold is a separate Shanghai market benchmark. Never overwrite an XAU/USD series.
    if gold_bars:
        try:
            recent_valid(gold_bars, today)
            previous = market_history.get("goldInstrument")
            existing = market_history.get("series", {}).get("gold", [])
            if existing and previous not in ("SGE Au99.99",):
                raise ValueError("Existing international XAU/USD data cannot be mixed with Shanghai Au99.99")
            market_history["series"]["gold"] = merge_bars(existing, gold_bars)
            market_history["goldInstrument"] = gold_name
            market_history["goldUnit"] = "CNY/g"
            report["goldUpdated"] = True
        except Exception as exc:
            report["failed"].append("SGE Au99.99: " + str(exc)[:180])
    # EOD alone never verifies metal-sensitive risk conditions or company disclosures.
    result["market"]["metal5d"] = {"gold": None, "silver": None, "copper": None}
    result["updatedAt"] = latest_snapshot_day
    result["marketFeed"] = {
        "provider": "AKShare / efinance fallback",
        "checkedAt": today.isoformat(),
        "updatedTickers": report["updated"],
        "errors": report["failed"],
        "licenseNote": "Free availability does not equal redistribution rights; published only with explicit upstream clearance",
    }
    if report["goldUpdated"] or any(t in TRENDS for t in report["updated"]):
        market_history["provider"] = "AKShare · Eastmoney A/H unadjusted EOD + Shanghai Gold Exchange Au99.99"
        market_history["status"] = "free-eod"
        market_history["updatedAt"] = today.isoformat()
        market_history["notes"] = "Gold Au99.99 CNY per gram is not international XAU/USD. No corporate-action adjustments or forward-fill."
    return result, market_history, report


def run(args):
    today = dt.date.fromisoformat(args.today) if args.today else dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    start = (today - dt.timedelta(days=args.lookback)).strftime("%Y%m%d")
    end = today.strftime("%Y%m%d")
    snapshot = json.loads(SNAPSHOT.read_text("utf-8"))
    history = json.loads(HISTORY.read_text("utf-8"))
    quotes = {}
    errors = []
    for ticker, (code, board, currency) in STOCKS.items():
        try:
            rows, source, fallback_errors = pick_stock_history(code, board, start, end, today, fetch_akshare, fetch_efinance)
            quotes[ticker] = (rows, source)
            print(f"OK {ticker} {source} {len(rows)} bars latest {rows[-1][0]} {rows[-1][1]} {currency}")
        except Exception as exc:
            errors.append(ticker + ": " + str(exc))
            print("SKIP", errors[-1], file=sys.stderr)
    gold = None
    try:
        gold = recent_valid(fetch_sge_gold(), today, min_points=6)[-min(args.limit, 1000):]
        print(f"OK SGE Au99.99 {len(gold)} bars latest {gold[-1][0]} {gold[-1][1]} CNY/g")
    except Exception as exc:
        errors.append("SGE Au99.99: " + str(exc))
        print("SKIP", errors[-1], file=sys.stderr)
    next_snapshot, next_history, report = apply_daily_data(snapshot, history, quotes, gold, today=today)
    report["fetchFailures"] = errors
    report["mode"] = "publish" if args.publish else "dry-run"
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if not report["updated"] and not report["goldUpdated"]:
        print("No valid new or same-day data; source files unchanged.", file=sys.stderr)
        return 1
    if args.publish:
        if os.getenv("MARKET_DATA_PUBLICATION_AUTHORIZED") != "true" or os.getenv("FREE_DATA_REDISPLAY_RIGHTS_VERIFIED") != "true":
            print("Publishing blocked: verify source redistribution rights and set both variables to true.", file=sys.stderr)
            return 2
        if args.output_dir:
            base = Path(args.output_dir)
            base.mkdir(parents=True, exist_ok=True)
            paths = [(base / "snapshot.json", next_snapshot), (base / "market-history.json", next_history)]
        else:
            paths = [(SNAPSHOT, next_snapshot), (HISTORY, next_history)]
        for path, body in paths:
            tmp = path.with_suffix(path.suffix + ".tmp")
            tmp.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", "utf-8")
            tmp.replace(path)
        print("Saved EOD files:", *[str(x[0]) for x in paths])
    elif args.output_dir:
        # Local-only files: never committed or uploaded by default.
        base = Path(args.output_dir)
        base.mkdir(parents=True, exist_ok=True)
        (base / "snapshot.json").write_text(json.dumps(next_snapshot, ensure_ascii=False, indent=2) + "\n", "utf-8")
        (base / "market-history.json").write_text(json.dumps(next_history, ensure_ascii=False, indent=2) + "\n", "utf-8")
        print("Private research files saved locally; no GitHub publication occurred.")
    return 0


def main():
    parser = argparse.ArgumentParser(description="AKShare→efinance research EOD sync; default is dry run")
    parser.add_argument("--publish", action="store_true", help="Write public repository data after two explicit legal gates")
    parser.add_argument("--output-dir", help="Write private local JSON to a separate directory")
    parser.add_argument("--today", help="Override date YYYY-MM-DD (testing only)")
    parser.add_argument("--lookback", type=int, default=460, help="Calendar days of history to fetch")
    parser.add_argument("--limit", type=int, default=500)
    args = parser.parse_args()
    if args.lookback<14 or args.lookback>3000 or args.limit<10 or args.limit>1000:
        parser.error("Invalid lookback/limit")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
