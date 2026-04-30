#!/usr/bin/env python3
"""
Fetch item data from Deadlock API assets endpoints and cache whitelist-filtered output.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

API_BASE = "https://assets.deadlock-api.com/v2/items/by-slot-type"
DEFAULT_WHITELIST = Path("scripts/item_whitelist.json")
DEFAULT_OUTPUT_DIR = Path("src/lib/data/cache")
SLOT_TYPES = ("weapon", "vitality", "spirit")
CSV_FIELDS = [
    "slot_type",
    "whitelist_bucket",
    "name",
    "class_name",
    "api_id",
    "cost",
    "item_tier",
    "shopable",
    "is_active_item",
    "type",
    "description",
]


def normalize_name(name: str) -> str:
    lowered = name.casefold()
    no_punct = re.sub(r"[^a-z0-9]+", "", lowered)
    return no_punct


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def fetch_slot_items(slot_type: str, timeout_sec: int) -> list[dict[str, Any]]:
    request = urllib.request.Request(
        f"{API_BASE}/{slot_type}",
        headers={"User-Agent": "deadlock-optimizer-item-sync/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout_sec) as response:
        payload = json.load(response)
    if not isinstance(payload, list):
        raise ValueError(f"Unexpected payload for slot '{slot_type}': expected list, got {type(payload).__name__}")
    return [item for item in payload if isinstance(item, dict)]


def make_whitelist_lookup(whitelist: dict[str, Any]) -> dict[str, dict[str, str]]:
    lookup: dict[str, dict[str, str]] = {}
    for slot, buckets in whitelist.items():
        slot_lookup: dict[str, str] = {}
        for bucket, names in buckets.items():
            for name in names:
                normalized = normalize_name(name)
                slot_lookup[normalized] = bucket
        lookup[slot] = slot_lookup
    return lookup


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch and cache whitelist-filtered Deadlock item data.")
    parser.add_argument("--whitelist", default=str(DEFAULT_WHITELIST), help="Path to whitelist JSON file.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for output artifacts.")
    parser.add_argument("--timeout-sec", type=int, default=30, help="HTTP timeout per request.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    whitelist_path = Path(args.whitelist)
    output_dir = Path(args.output_dir)

    if not whitelist_path.exists():
        print(f"Whitelist file not found: {whitelist_path}", file=sys.stderr)
        return 1

    whitelist = load_json(whitelist_path)
    whitelist_lookup = make_whitelist_lookup(whitelist)

    output_dir.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc).isoformat()

    selected_rows: list[dict[str, Any]] = []
    full_records: list[dict[str, Any]] = []
    missing_by_slot: dict[str, list[str]] = {}

    try:
        for slot_type in SLOT_TYPES:
            expected_lookup = whitelist_lookup.get(slot_type, {})
            expected_names = set(expected_lookup.keys())
            found_names: set[str] = set()
            items = fetch_slot_items(slot_type, timeout_sec=args.timeout_sec)

            for item in items:
                name = str(item.get("name", "")).strip()
                if not name:
                    continue
                normalized = normalize_name(name)
                if normalized not in expected_lookup:
                    continue

                found_names.add(normalized)
                bucket = expected_lookup[normalized]

                raw_description = item.get("description", "")
                if isinstance(raw_description, dict):
                    description = str(
                        raw_description.get("desc")
                        or raw_description.get("text")
                        or raw_description.get("value")
                        or ""
                    )
                else:
                    description = str(raw_description or "")

                row = {
                    "slot_type": slot_type,
                    "whitelist_bucket": bucket,
                    "name": name,
                    "class_name": item.get("class_name", ""),
                    "api_id": item.get("id", ""),
                    "cost": item.get("cost", ""),
                    "item_tier": item.get("item_tier", ""),
                    "shopable": item.get("shopable", ""),
                    "is_active_item": item.get("is_active_item", ""),
                    "type": item.get("type", ""),
                    "description": description.replace("\n", " ").strip(),
                }
                selected_rows.append(row)
                full_records.append(
                    {
                        "slot_type": slot_type,
                        "whitelist_bucket": bucket,
                        "name": name,
                        "normalized_name": normalized,
                        "fetched_at": fetched_at,
                        "raw": item,
                    }
                )

            missing_normalized = expected_names - found_names
            missing_by_slot[slot_type] = sorted(
                (name for name in sum(whitelist.get(slot_type, {}).values(), []) if normalize_name(name) in missing_normalized),
                key=str.casefold,
            )
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError) as exc:
        print(f"Failed to fetch items: {exc}", file=sys.stderr)
        return 1

    selected_rows.sort(key=lambda row: (row["slot_type"], str(row["whitelist_bucket"]), row["name"]))
    full_records.sort(key=lambda row: (row["slot_type"], str(row["whitelist_bucket"]), row["name"]))

    csv_path = output_dir / "deadlock_items.csv"
    json_path = output_dir / "deadlock_items.json"
    report_path = output_dir / "deadlock_items_report.json"

    with csv_path.open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(selected_rows)

    with json_path.open("w", encoding="utf-8") as json_file:
        json.dump(
            {
                "fetched_at": fetched_at,
                "source": API_BASE,
                "record_count": len(full_records),
                "items": full_records,
            },
            json_file,
            indent=2,
        )
        json_file.write("\n")

    report = {
        "fetched_at": fetched_at,
        "source": API_BASE,
        "selected_count": len(selected_rows),
        "missing_by_slot": missing_by_slot,
    }
    with report_path.open("w", encoding="utf-8") as report_file:
        json.dump(report, report_file, indent=2)
        report_file.write("\n")

    print(f"Wrote {csv_path}")
    print(f"Wrote {json_path}")
    print(f"Wrote {report_path}")
    total_missing = sum(len(values) for values in missing_by_slot.values())
    if total_missing:
        print(f"Whitelist entries missing from API response: {total_missing}")
        for slot_type in SLOT_TYPES:
            slot_missing = missing_by_slot.get(slot_type, [])
            if slot_missing:
                print(f"  - {slot_type}: {', '.join(slot_missing)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
