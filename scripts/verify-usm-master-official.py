#!/usr/bin/env python3
"""Verify a reproducible USM postgraduate collection manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


ALLOWED_DOMAINS = {"usm.my", "admission.usm.my", "ips.usm.my"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []

    if manifest.get("universityCode") != "USM":
        errors.append("universityCode must be USM.")
    level = manifest.get("level")
    if level not in {"master", "phd"}:
        errors.append("level must be master or phd.")
    if manifest.get("applicantScope") != "international":
        errors.append("applicantScope must be international.")
    if manifest.get("academicSession") != "2025/2026":
        errors.append("academicSession must be 2025/2026.")

    records = manifest.get("records", [])
    details = manifest.get("details", [])
    offshore = manifest.get("offshoreOfferings", [])
    fee_schedule = manifest.get("feeSchedule", {})
    audit = manifest.get("audit", {})
    directory_audit = audit.get("directory", {})

    expected_counts = {
        "allDirectoryOccurrences": 405,
        "masterOccurrences": 276,
        "uniqueMasterDetailPages": 274,
        "uniqueDoctorDetailPages": 129,
        "doctorOccurrences": 129,
        "duplicateMasterOccurrences": 2,
        "duplicateDoctorOccurrences": 0,
    }
    for key, expected in expected_counts.items():
        if level == "master" and key in {
            "uniqueDoctorDetailPages",
            "duplicateDoctorOccurrences",
        } and key not in directory_audit:
            continue
        if directory_audit.get(key) != expected:
            errors.append(
                f"Directory count {key} expected {expected}, got {directory_audit.get(key)}."
            )

    expected_records = 274 if level == "master" else 129
    if len(records) != expected_records:
        errors.append(
            f"Expected {expected_records} {level} directory records, got {len(records)}."
        )
    if len({record.get("code") for record in records}) != len(records):
        errors.append("Master record codes are not unique.")
    if len({record.get("officialSourceUrl") for record in records}) != len(records):
        errors.append("Master officialSourceUrl values are not unique.")

    if len(offshore) != 54:
        errors.append(f"Expected 54 current offshore offerings, got {len(offshore)}.")
    expected_offshore = 30 if level == "master" else 24
    offshore_level_count = sum(item.get("level") == level for item in offshore)
    if offshore_level_count != expected_offshore:
        errors.append(
            f"Expected {expected_offshore} offshore {level} offerings, "
            f"got {offshore_level_count}."
        )

    research_fees = fee_schedule.get("researchAcademicUnitFees", [])
    named_fees = fee_schedule.get("namedProgrammeFees", [])
    master_named_fees = fee_schedule.get("masterNamedProgrammeFees", [])
    doctoral_named_fees = fee_schedule.get("doctoralNamedProgrammeFees", [])
    if len(research_fees) != 47:
        errors.append(f"Expected 47 research academic-unit fee rows, got {len(research_fees)}.")
    if len(named_fees) != 123:
        errors.append(f"Expected 123 named fee rows, got {len(named_fees)}.")
    if len(master_named_fees) != 110:
        errors.append(f"Expected 110 master named fee rows, got {len(master_named_fees)}.")
    if level == "phd" and len(doctoral_named_fees) != 13:
        errors.append(
            f"Expected 13 doctoral named fee rows, got {len(doctoral_named_fees)}."
        )

    for source in manifest.get("sources", []):
        domain = urlparse(source.get("url", "")).hostname
        if domain not in ALLOWED_DOMAINS:
            errors.append(f"Non-USM source domain found: {source.get('url')}")
        local_path = source.get("localPath")
        expected_hash = source.get("sha256")
        if local_path and expected_hash and Path(local_path).exists():
            actual_hash = sha256(Path(local_path))
            if actual_hash != expected_hash:
                errors.append(f"Source hash mismatch for {source.get('id')}.")

    if details:
        if len(details) != expected_records:
            errors.append(
                f"Expected {expected_records} detail audit rows, got {len(details)}."
            )
        if len({detail.get("code") for detail in details}) != len(details):
            errors.append("Detail audit codes are not unique.")
        blocked_details = [detail for detail in details if detail.get("status") == "blocked"]
        if blocked_details:
            errors.append(f"{len(blocked_details)} detail pages were blocked during collection.")
        review_details = [
            detail for detail in details if detail.get("status") == "review-required"
        ]
        if review_details:
            warnings.append(
                f"{len(review_details)} detail pages are collected but have missing official sections."
            )
    else:
        warnings.append("Detail pages were not fetched in this manifest.")

    if manifest.get("publicationDecision") != "blocked":
        errors.append("Collection manifest must remain blocked until all commercial gates pass.")
    if not audit.get("blockingReasons"):
        errors.append("Blocked publication decision must include blocking reasons.")
    if any("isPublished" in record for record in records):
        errors.append("Collection dry-run records must not contain isPublished.")

    result = {
        "manifest": str(args.manifest),
        "records": len(records),
        "details": len(details),
        "offshoreOfferings": len(offshore),
        "masterNamedFeeRows": len(master_named_fees),
        "doctoralNamedFeeRows": len(doctoral_named_fees),
        "publicationDecision": manifest.get("publicationDecision"),
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
