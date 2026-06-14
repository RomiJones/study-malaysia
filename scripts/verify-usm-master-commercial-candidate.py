#!/usr/bin/env python3
"""Verify the complete USM master's commercial candidate manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []
    records = data.get("records", [])

    if data.get("schemaVersion") != "studymy-usm-master-candidate-v1":
        errors.append("Unexpected schemaVersion.")
    if len(records) != 274:
        errors.append(f"Expected 274 directory records, got {len(records)}.")
    if len({item.get("code") for item in records}) != len(records):
        errors.append("Record codes are not unique.")
    if any(item.get("studyMode") == "official-title-unspecified" for item in records):
        errors.append("Unresolved study mode remains.")
    if any(not item.get("academicRequirement", {}).get("textEnOfficial") for item in records):
        errors.append("At least one record has no academic requirement.")
    if any(not item.get("languageRequirement", {}).get("textEnOfficial") for item in records):
        errors.append("At least one record has no language requirement.")
    if any(not item.get("duration", {}).get("status") for item in records):
        errors.append("At least one record has no duration status.")
    if any(not item.get("intake", {}).get("status") for item in records):
        errors.append("At least one record has no intake status.")
    if any(not item.get("fee", {}).get("status") for item in records):
        errors.append("At least one record has no fee status.")
    if any(not item.get("evidence", {}).get("detailSha256") for item in records):
        errors.append("At least one record has no detail evidence hash.")

    allocations = data.get("feeRowAllocations", [])
    if len(allocations) != 110:
        errors.append(f"Expected all 110 current named fee rows, got {len(allocations)}.")
    if len({item.get("feeRowKey") for item in allocations}) != len(allocations):
        errors.append("Named fee row allocation keys are not unique.")
    if len(data.get("feeOnlyOfferings", [])) != 2:
        errors.append("Expected two official fee-only pathology offerings.")
    if len(data.get("applicationDocuments", {}).get("items", [])) != 10:
        errors.append("Expected ten application-document rules.")

    for source in data.get("sources", []):
        path = Path(source["localPath"])
        if not path.exists():
            errors.append(f"Missing source file: {path}")
        elif sha256(path) != source["sha256"]:
            errors.append(f"Source hash mismatch: {source['id']}")

    if data.get("databaseWrite") != "not-performed":
        errors.append("Candidate build must not write the database.")
    if data.get("audit", {}).get("publicationDecision") != "blocked":
        errors.append("Publication must remain blocked until localisation and final review pass.")

    unpublished_fees = sum(
        item["fee"]["status"] != "verified-current-official-fee"
        and not item.get("specialisationOrVariantFees")
        for item in records
    )
    if unpublished_fees:
        warnings.append(
            f"{unpublished_fees} directory entries have no uniquely applicable current fee row."
        )
    result = {
        "manifest": str(args.manifest),
        "records": len(records),
        "modeCounts": data.get("audit", {}).get("modeCounts"),
        "namedFeeRowsAccountedFor": len(allocations),
        "feeOnlyOfferings": len(data.get("feeOnlyOfferings", [])),
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
