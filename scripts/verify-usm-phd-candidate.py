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
    if len(records) != 95:
        errors.append(f"Expected 95 current canonical doctoral records, got {len(records)}.")
    if len({row.get("code") for row in records}) != len(records):
        errors.append("Record codes are not unique.")
    official_identities = {
        (
            row.get("officialSourceUrl"),
            row.get("degreeType"),
            row.get("nameEnOfficial"),
            row.get("facultyEn"),
        )
        for row in records
    }
    if len(official_identities) != len(records):
        errors.append("Official URL/application-code identities are not unique.")
    if any(row.get("level") != "phd" for row in records):
        errors.append("A non-doctoral record is present.")
    if any(
        row.get("studyMode") not in {"research", "mixed", "coursework", "online"}
        for row in records
    ):
        errors.append("An unresolved study mode remains.")
    if any(not row.get("officialAcademicRequirement") for row in records):
        errors.append("An academic requirement is missing.")
    if any(not row.get("officialLanguageRequirement") for row in records):
        errors.append("A language requirement is missing.")
    if any(not row.get("applicationDocuments") for row in records):
        errors.append("Application documents are missing.")
    if any(not row.get("detailSha256") for row in records):
        errors.append("Evidence hash is missing.")
    if sum(row["publicDisplayStatus"] == "not-available-for-international" for row in records) != 2:
        errors.append("Expected exactly two Malaysian-only doctoral records.")

    audit = data.get("audit", {})
    if audit.get("currentOfficialCatalogueRows") != 95:
        errors.append("Current official doctoral catalogue count must be 95.")
    if audit.get("currentOfficialUniqueUrls") != 91:
        errors.append("Current official doctoral URL count must be 91.")
    if audit.get("legacyDirectoryDetailOccurrences") != 129:
        errors.append("Legacy doctoral detail occurrence count must be 129.")
    if audit.get("offshoreApplicationCodeOccurrences") != 24:
        errors.append("Doctoral offshore application-code count must be 24.")
    if audit.get("directoryOccurrences") != 95:
        errors.append("Canonical doctoral directory occurrence count must be 95.")
    if audit.get("uniqueOfficialEntries") != 95:
        errors.append("Unique doctoral official entry count must be 95.")
    if audit.get("canonicalProgrammes") != 95:
        errors.append("Canonical doctoral programme count must be 95.")
    if audit.get("currentDetailsAddedBeyondLegacyDirectory") != 9:
        errors.append("Expected nine current detail URLs beyond the legacy directory.")
    if audit.get("applicationCodeOnlyOfferings") != 5:
        errors.append("Expected five application-code-only doctoral offerings.")
    if audit.get("offshoreApplicationCodesReconciled") != 24:
        errors.append("All 24 offshore application codes must be reconciled.")
    if audit.get("doctoralNamedFeeRows") != 13:
        errors.append("All 13 named doctoral fee rows must be accounted for.")
    if sum(audit.get("statusCounts", {}).values()) != 95:
        errors.append("Status partition does not sum to 95.")
    for key, value in audit.get("coverage", {}).items():
        if value.get("covered", 0) + value.get("unpublished", 0) + value.get("review", 0) != 95:
            errors.append(f"Coverage partition for {key} does not sum to 95.")

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
    if audit.get("publicationDecision") != "publish-international-eligible-catalogue":
        errors.append("Publication decision must allow the audited international-eligible catalogue.")
    expected_statuses = {
        "ready": 93,
        "needs-review": 0,
        "not-available-for-international": 2,
    }
    actual_statuses = {
        key: audit.get("statusCounts", {}).get(key, 0) for key in expected_statuses
    }
    if actual_statuses != expected_statuses:
        errors.append(
            f"Expected doctoral status partition {expected_statuses}, got {actual_statuses}."
        )
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
