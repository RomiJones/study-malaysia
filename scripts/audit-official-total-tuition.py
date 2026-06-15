#!/usr/bin/env python3
"""Block inferred tuition totals and ranges from StudyMY publication data."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from urllib.request import urlopen


RANGE_PATTERN = re.compile(r"\d[\d,]*(?:\.\d+)?\s*[-–]\s*\d[\d,]*(?:\.\d+)?")
ESTIMATED_DISPLAY_PATTERN = re.compile(r"estimated|估算|估計", re.IGNORECASE)
RATE_DISPLAY_PATTERN = re.compile(
    r"(?:USD|MYR|RM|CNY)\s+\d[\d,]*(?:\.\d+)?\s+(?:per[\s-]semester|/\s*(?:semester|学期|學期))",
    re.IGNORECASE,
)


def positive_scalar(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0


def audit_undergraduate(data: dict, errors: list[str], counts: Counter) -> None:
    programmes = data.get("programmes", [])
    counts["undergraduate"] += len(programmes)
    for row in programmes:
        label = row.get("code") or row.get("nameEnOfficial")
        if not positive_scalar(row.get("totalTuitionUSD")):
            errors.append(f"{label}: undergraduate official total tuition is missing.")
        if isinstance(row.get("totalTuitionUSD"), dict):
            errors.append(f"{label}: undergraduate total tuition must be a scalar.")
        note = str(row.get("feeNote") or "")
        if "calculated" in note.lower() or "estimated" in note.lower():
            errors.append(f"{label}: undergraduate fee note claims a calculated total.")


def audit_postgraduate(data: dict, errors: list[str], counts: Counter) -> None:
    records = data.get("records", [])
    level = str(data.get("level") or "master")
    counts[level] += len(records)
    for row in records:
        label = row.get("code") or row.get("nameEnOfficial") or row.get("officialName")
        fee = row.get("fee") or {}
        status = str(fee.get("status") or "")
        if "calculated" in status.lower() or "estimated" in status.lower():
            errors.append(f"{label}: calculated fee status is forbidden.")

        if "tuitionAmount" in fee:
            amount = fee.get("tuitionAmount")
            basis = fee.get("tuitionBasis")
            if isinstance(amount, dict):
                errors.append(f"{label}: tuition amount ranges are forbidden.")
            if status == "verified-current-official-fee":
                if not positive_scalar(amount) or basis != "total-programme":
                    errors.append(
                        f"{label}: verified fee must be a scalar official total-programme amount."
                    )
                counts["official-total"] += 1
            elif status == "official-rate-only":
                if amount is not None or basis != "per-semester-rate-only":
                    errors.append(f"{label}: rate-only evidence must not contain a total.")
                counts["rate-only"] += 1
            elif amount is not None:
                errors.append(f"{label}: unpublished fee status contains a tuition amount.")
            continue

        international = fee.get("international") or {}
        amount = international.get("amount")
        rate = international.get("fullTimePerSemester")
        basis = international.get("basis")
        if rate:
            if status != "official-rate-only":
                errors.append(f"{label}: per-semester evidence must use official-rate-only.")
            if amount is not None:
                errors.append(f"{label}: rate-only evidence also contains a total amount.")
            counts["rate-only"] += 1
        elif amount is not None:
            if status != "verified-current-official-fee" or basis != "total-programme":
                errors.append(f"{label}: numeric fee is not an official total-programme amount.")
            counts["official-total"] += 1
        elif status == "verified-current-official-fee":
            errors.append(f"{label}: verified official fee status has no numeric total.")


def audit_api(data: dict, errors: list[str], counts: Counter) -> None:
    programmes = data.get("programs", [])
    counts["api-public"] += len(programmes)
    for row in programmes:
        label = row.get("code") or row.get("nameEnOfficial")
        display = str(row.get("tuitionDisplay") or "")
        amount = row.get("tuitionAmount")
        status = row.get("officialFeeAuditStatus")
        if RANGE_PATTERN.search(display):
            errors.append(f"{label}: public tuition display contains a range.")
        if ESTIMATED_DISPLAY_PATTERN.search(display):
            errors.append(f"{label}: public tuition display contains an estimate.")
        if isinstance(amount, dict):
            errors.append(f"{label}: public tuition amount is not scalar.")
        if status == "matched-official":
            if not positive_scalar(amount) or "total tuition" not in display.lower():
                errors.append(f"{label}: matched fee is not a single official total.")
            counts["api-official-total"] += 1
        elif status == "official-rate-verified":
            tuition_info = row.get("tuitionInfo") or {}
            if amount is not None or tuition_info.get("amount") is not None:
                errors.append(f"{label}: verified rate must not populate the primary total.")
            if not RATE_DISPLAY_PATTERN.search(display):
                errors.append(f"{label}: verified rate is missing its numeric per-semester display.")
            note = str(tuition_info.get("note") or "")
            if "per semester" not in note.lower():
                errors.append(f"{label}: verified rate is missing official per-semester evidence.")
            counts["api-rate-verified"] += 1
        elif status == "not-published":
            tuition_info = row.get("tuitionInfo") or {}
            if amount is not None or tuition_info.get("amount") is not None:
                errors.append(f"{label}: unpublished public fee contains an amount.")
            counts["api-unpublished"] += 1
        else:
            errors.append(f"{label}: unsupported public fee audit status {status}.")


def load_json(path_or_url: str) -> tuple[str, dict]:
    if path_or_url.startswith(("http://", "https://")):
        with urlopen(path_or_url, timeout=15) as response:
            return path_or_url, json.load(response)
    path = Path(path_or_url)
    return str(path), json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("inputs", nargs="+", help="Candidate JSON files or public API URLs.")
    parser.add_argument("--summary-only", action="store_true")
    args = parser.parse_args()

    errors: list[str] = []
    counts: Counter = Counter()
    audited: list[str] = []
    for source, data in map(load_json, args.inputs):
        audited.append(source)
        if isinstance(data.get("programs"), list):
            audit_api(data, errors, counts)
        elif isinstance(data.get("programmes"), list):
            audit_undergraduate(data, errors, counts)
        elif isinstance(data.get("records"), list):
            audit_postgraduate(data, errors, counts)
        else:
            errors.append(f"{source}: unsupported tuition audit shape.")

    result = {
        "policy": "official-standard-total-only",
        "audited": audited,
        "counts": dict(sorted(counts.items())),
        "errors": errors,
        "decision": "passed" if not errors else "blocked",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
