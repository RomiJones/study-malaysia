#!/usr/bin/env python3
"""Validate a StudyMY one-pass delivery envelope."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import urlparse


REQUIRED_COVERAGE = {
    "identity",
    "faculty",
    "studyMode",
    "campus",
    "duration",
    "intake",
    "internationalEligibility",
    "academicRequirement",
    "languageRequirement",
    "applicationDocuments",
    "fee",
    "evidence",
}
VALID_VERIFICATION = {"passed", "failed", "pending", "not-required"}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("delivery", type=Path)
    parser.add_argument("--summary-only", action="store_true")
    args = parser.parse_args()
    data = json.loads(args.delivery.read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings: list[str] = []
    counts = data.get("counts", {})
    canonical = counts.get("canonicalProgrammes", 0)

    if data.get("schemaVersion") != 1:
        errors.append("schemaVersion must be 1.")
    if data.get("authorization") not in {"collect", "publish"}:
        errors.append("authorization must be collect or publish.")
    if canonical != sum(
        counts.get(key, 0)
        for key in ("ready", "needsReview", "notAvailableForInternational")
    ):
        errors.append("Canonical count does not equal the status partition.")

    coverage = data.get("coverage", {})
    missing = REQUIRED_COVERAGE - set(coverage)
    if missing:
        errors.append(f"Missing coverage keys: {', '.join(sorted(missing))}.")
    for key, value in coverage.items():
        if sum(value.get(part, 0) for part in ("covered", "unpublished", "review")) != canonical:
            errors.append(f"Coverage partition for {key} does not sum to canonical count.")

    official_domains = set(data.get("officialDomains", []))
    for source in data.get("sources", []):
        domain = urlparse(source.get("url", "")).hostname or ""
        if domain not in official_domains and not any(domain.endswith(f".{item}") for item in official_domains):
            errors.append(f"Source domain is outside officialDomains: {domain}")

    roles = set()
    for artifact in data.get("artifacts", []):
        roles.add(artifact.get("role"))
        path = Path(artifact.get("path", ""))
        if not path.exists():
            errors.append(f"Missing artifact: {path}")
        elif artifact.get("sha256") != sha256(path):
            errors.append(f"Artifact hash mismatch: {path}")
    if not {"manifest", "audit"}.issubset(roles):
        errors.append("Delivery requires manifest and audit artifacts.")
    if data.get("authorization") == "publish" and "backup" not in roles:
        errors.append("Publication delivery requires a backup artifact.")

    for key, value in data.get("verification", {}).items():
        if value not in VALID_VERIFICATION:
            errors.append(f"Invalid verification status for {key}: {value}")
        if value in {"failed", "pending"}:
            warnings.append(f"Verification {key} is {value}.")
    if data.get("authorization") == "collect" and data.get("decision") == "published":
        errors.append("Collect authorization cannot produce a published decision.")

    result = {
        "delivery": str(args.delivery),
        "scope": data.get("scope"),
        "counts": counts,
        "decision": data.get("decision"),
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
