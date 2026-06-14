#!/usr/bin/env python3
"""Verify the audited USM doctoral import candidate."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


ALLOWED_DOMAINS = {"usm.my", "admission.usm.my", "ips.usm.my", "onlineips.usm.my"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    data = json.loads(args.manifest.read_text(encoding="utf-8"))
    records = data.get("records", [])
    errors: list[str] = []
    warnings: list[str] = []

    if data.get("schemaVersion") != "studymy-usm-phd-candidate-v1":
        errors.append("Unexpected schemaVersion.")
    if data.get("level") != "phd" or data.get("universityCode") != "USM":
        errors.append("Manifest scope must be USM phd.")
    if len(records) != 129:
        errors.append(f"Expected 129 canonical doctoral records, got {len(records)}.")
    if len({row.get("code") for row in records}) != len(records):
        errors.append("Record codes are not unique.")
    if len({row.get("officialSourceUrl") for row in records}) != len(records):
        errors.append("Official source URLs are not unique.")
    if any(row.get("level") != "phd" for row in records):
        errors.append("A non-doctoral record is present.")
    if any(row.get("studyMode") not in {"research", "mixed", "coursework"} for row in records):
        errors.append("An unresolved study mode remains.")
    if any(not row.get("officialAcademicRequirement") for row in records):
        errors.append("An academic requirement is missing.")
    if any(not row.get("officialLanguageRequirement") for row in records):
        errors.append("A language requirement is missing.")
    if any(not row.get("applicationDocuments") for row in records):
        errors.append("Application documents are missing.")
    if any(not row.get("detailSha256") for row in records):
        errors.append("Detail evidence hash is missing.")
    if sum(row["publicDisplayStatus"] == "not-available-for-international" for row in records) != 1:
        errors.append("Expected exactly one Malaysian-only doctoral record.")

    audit = data.get("audit", {})
    if audit.get("directoryOccurrences") != 129:
        errors.append("Doctoral directory occurrence count must be 129.")
    if audit.get("uniqueOfficialEntries") != 129:
        errors.append("Unique doctoral official entry count must be 129.")
    if audit.get("canonicalProgrammes") != 129:
        errors.append("Canonical doctoral programme count must be 129.")
    if audit.get("doctoralNamedFeeRows") != 13:
        errors.append("All 13 named doctoral fee rows must be accounted for.")
    if sum(audit.get("statusCounts", {}).values()) != 129:
        errors.append("Status partition does not sum to 129.")
    for key, value in audit.get("coverage", {}).items():
        if value.get("covered", 0) + value.get("unpublished", 0) + value.get("review", 0) != 129:
            errors.append(f"Coverage partition for {key} does not sum to 129.")

    for source in data.get("sources", []):
        if urlparse(source.get("url", "")).hostname not in ALLOWED_DOMAINS:
            errors.append(f"Unexpected source domain: {source.get('url')}")
        path = Path(source.get("localPath", ""))
        if not path.exists():
            errors.append(f"Missing source artifact: {path}")
        elif source.get("sha256") != sha256(path):
            errors.append(f"Source hash mismatch: {source.get('id')}")

    if data.get("databaseWrite") != "not-performed":
        errors.append("Candidate collection must not write the database.")
    if audit.get("publicationDecision") != "blocked":
        errors.append("Publication must remain blocked.")
    needs_review = audit.get("statusCounts", {}).get("needs-review", 0)
    if needs_review:
        warnings.append(f"{needs_review} records remain in the exception queue.")

    result = {
        "manifest": str(args.manifest),
        "records": len(records),
        "statuses": audit.get("statusCounts"),
        "modes": audit.get("modeCounts"),
        "fees": audit.get("feeCounts"),
        "exceptions": audit.get("exceptionCount"),
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
