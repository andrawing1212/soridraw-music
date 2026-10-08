#!/usr/bin/env python3
"""SORIDRAW read-only Cloud Monitoring RTDB report. Run ONLY in a private repo."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError

PROJECT = "soridraw-app-866a5"
METRICS = {
    "network/sent_bytes_count": "DELTA",
    "network/sent_payload_bytes_count": "DELTA",
    "network/sent_payload_and_protocol_bytes_count": "DELTA",
    "io/sent_responses_count": "DELTA",
    "network/active_connections": "GAUGE",
    "network/broadcast_load": "GAUGE",
    "io/database_load": "GAUGE",
    "storage/total_bytes": "GAUGE",
}
GIB = 1024 ** 3


def aggregate(series, kind):
    result = {}
    for s in series:
        resource = s.get("resource", {})
        if resource.get("type") != "firebase_namespace":
            continue
        db = str(resource.get("labels", {}).get("table_name") or "unknown")
        values = []
        for pt in s.get("points", []):
            v = pt.get("value", {})
            raw = v.get("int64Value", v.get("doubleValue"))
            if raw is not None:
                values.append(float(raw))
        if not values:
            continue
        candidate = sum(values) if kind == "DELTA" else max(values)
        old = result.get(db, 0)
        result[db] = old + candidate if kind == "DELTA" else max(old, candidate)
    return result


def read_metric(project, token, name, kind, begin, end):
    if METRICS.get(name) != kind:
        raise ValueError("Metric not allowed")
    query = {
        "filter": 'metric.type="firebasedatabase.googleapis.com/' + name + '" AND resource.type="firebase_namespace"',
        "interval.startTime": begin,
        "interval.endTime": end,
        "aggregation.alignmentPeriod": "3600s",
        "aggregation.perSeriesAligner": "ALIGN_SUM" if kind == "DELTA" else "ALIGN_MAX",
        "view": "FULL",
        "pageSize": "1000",
    }
    url = "https://monitoring.googleapis.com/v3/projects/" + project + "/timeSeries"
    all_rows = []
    for _ in range(50):
        request = Request(url + "?" + urlencode(query), headers={
            "Authorization": "Bearer " + token, "Accept": "application/json"}, method="GET")
        try:
            with urlopen(request, timeout=40) as response:
                body = json.load(response)
        except HTTPError as error:
            raise RuntimeError("Monitoring HTTP " + str(error.code) + " for " + name) from None
        all_rows.extend(body.get("timeSeries") or [])
        page = body.get("nextPageToken")
        if not page:
            return all_rows
        query["pageToken"] = page
    raise RuntimeError("Incomplete metric pagination for " + name)


def iso(d):
    return d.isoformat(timespec="seconds").replace("+00:00", "Z")


def build_report(token):
    end = dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=45)
    report = {"project": PROJECT, "source": "Cloud Monitoring, not final invoice",
              "end_utc": iso(end), "windows": {}}
    for days in (1, 30):
        period = "24h" if days == 1 else "30d"
        metric_set = METRICS if days == 1 else {
            k: v for k, v in METRICS.items()
            if k.startswith("network/sent_") or k == "io/sent_responses_count"}
        window = {}
        for name, kind in metric_set.items():
            rows = read_metric(PROJECT, token, name, kind,
                               iso(end - dt.timedelta(days=days)), iso(end))
            window[name] = {"kind": kind, "per_database": aggregate(rows, kind),
                            "measured": bool(rows)}
        if not window["network/sent_bytes_count"]["per_database"]:
            raise RuntimeError("NO_DATA in " + period + ": download measurement NOT verified")
        report["windows"][period] = window
    return report


def as_markdown(report):
    lines = ["# Firebase RTDB private read-only usage", "",
             "Project: " + report["project"], "End UTC (45m lag): " + report["end_utc"],
             "Cloud Monitoring estimates are not final Billing invoices.", "",
             "| Window | Metric | Database | Value |", "|---|---|---|---:|"]
    for window, metrics in report["windows"].items():
        for metric, values in metrics.items():
            if not values["per_database"]:
                lines.append("| " + window + " | " + metric + " | no data | NOT VERIFIED |")
            for database, value in values["per_database"].items():
                display = ("%0.4f GiB" % (value / GIB)) if "bytes" in metric else ("%0.3f" % value)
                lines.append("| " + window + " | " + metric + " | " + database + " | " + display + " |")
    return "\n".join(lines) + "\n"


def self_test():
    s = {"resource": {"type": "firebase_namespace", "labels": {"table_name": "db"}},
         "points": [{"value": {"int64Value": "4"}}, {"value": {"int64Value": "6"}}]}
    assert aggregate([s], "DELTA") == {"db": 10.0}
    assert aggregate([s], "GAUGE") == {"db": 6.0}
    assert aggregate([{"resource": {"type": "unexpected"}}], "DELTA") == {}
    print("RTDB_METRICS_SELF_TEST=PASS")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--out", default="rtdb-report")
    args = ap.parse_args()
    if args.self_test:
        self_test()
        return
    token = os.environ.get("SORIDRAW_MONITORING_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("No short-lived read-only WIF token")
    report = build_report(token)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md = as_markdown(report)
    (out / "report.md").write_text(md, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(md)
    print("RTDB_METRICS_READ_ONLY=PASS; private artifact written")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("RTDB_METRICS_READ_ONLY=FAIL: " + str(exc))
        raise SystemExit(1)
