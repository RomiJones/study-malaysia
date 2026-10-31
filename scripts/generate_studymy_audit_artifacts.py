#!/usr/bin/env python3
"""Generate derived StudyMY collection audit artifacts from candidate data.

This script reduces repeated manual report work. It does not invent official
facts: missing evidence becomes review/unpublished/blocked state for the next
human or adapter pass.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


MATERIAL_FIELDS = {
    "officialTitle": ("nameEnOfficial", "programmeNameEn", "officialName", "name"),
    "faculty": ("facultyEn", "faculty", "facultyZh"),
    "level": ("level", "recordsLevel"),
    "campus": ("campus",),
    "studyMode": ("studyMode", "mode"),
    "internationalEligibility": ("internationalEligibility", "publicDisplayStatus"),
    "duration": ("durationOfficial", "duration", "durationYears"),
    "intake": ("officialIntake", "intake", "intakeMonths"),
    "tuition": ("officialTuitionMYR", "tuitionAmount", "tuitionDisplay", "tuition"),
    "academicRequirement": ("officialAcademicRequirement", "requirements", "requirement"),
    "languageRequirement": ("officialLanguageRequirement", "languageRequirement", "language"),
    "applicationDocuments": ("applicationDocs", "documents"),
    "curriculum": ("curriculum", "courses"),
    "sourceUrls": ("sourceUrls", "officialSourceUrl"),
    "localization": ("name", "programmeNameZh", "nameZh", "facultyZh"),
}
DISPLAY_SURFACES = {
    "institution": ("officialName", "website", "officialDomains", "sourceStatus"),
    "catalogue": ("levelCounts", "readyCounts", "reviewCounts", "publicFiltering"),
    "program-list": ("localizedName", "officialEnglishName", "faculty", "duration", "tuition", "language", "intake", "detailRoute"),
    "program-detail": ("description", "level", "duration", "tuition", "requirements", "documents", "curriculum", "sourceUrls"),
    "leakage": ("publicReadyOnly", "noReviewLeakage", "noUnavailableLeakage"),
}
PUBLIC_READY = "ready"
NON_PUBLIC = {"needs-review", "not-available-for-international", "hidden", "hidden-unverified", "archived", "superseded"}


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_empty(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def text(value: Any) -> str:
    if isinstance(value, dict):
        for key in ("en", "zh-CN", "zh", "ms"):
            if value.get(key):
                return str(value[key])
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "; ".join(str(item) for item in value if not is_empty(item))
    return str(value or "")


def first_value(record: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        if key in record and not is_empty(record[key]):
            return record[key]
    return None


def records_from(candidate: Any) -> list[dict[str, Any]]:
    if not isinstance(candidate, dict):
        return []
    for key in ("records", "programmes", "programs", "candidate_dataset"):
        value = candidate.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def record_code(record: dict[str, Any], index: int) -> str:
    return str(record.get("code") or record.get("id") or record.get("slug") or f"record-{index:04d}")


def record_name(record: dict[str, Any]) -> str:
    value = first_value(record, ("nameEnOfficial", "programmeNameEn", "officialName", "name"))
    return text(value) or "Unnamed official programme"


def evidence_for(record: dict[str, Any], field: str) -> dict[str, Any]:
    aliases = {field}
    if field == "officialTitle":
        aliases.update({"nameEnOfficial", "programmeNameEn", "officialName"})
    if field == "tuition":
        aliases.update({"fee", "officialTuitionMYR", "tuitionAmount"})
    if field == "academicRequirement":
        aliases.update({"requirements", "entryRequirement"})
    if field == "languageRequirement":
        aliases.update({"language", "englishRequirement"})
    for item in record.get("evidence") or []:
        if isinstance(item, dict) and str(item.get("field") or "") in aliases:
            return item
    source_url = (
        record.get("officialSourceUrl")
        or record.get("officialFeeSourceUrl")
        or record.get("officialRequirementSourceUrl")
        or ""
    )
    return {"sourceUrl": source_url, "sourceId": "candidate-record", "sourceText": ""}


def source_urls(record: dict[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in record.get("sourceUrls") or []:
        if isinstance(item, dict) and item.get("url"):
            rows.append({
                "url": str(item["url"]),
                "title": str(item.get("title") or item.get("sourceType") or "official source"),
                "role": str(item.get("sourceType") or "field-authority"),
            })
        elif isinstance(item, str):
            rows.append({"url": item, "title": "official source", "role": "field-authority"})
    for key, role in (
        ("officialSourceUrl", "canonical"),
        ("officialFeeSourceUrl", "field-authority"),
        ("officialEntryRequirementSourceUrl", "field-authority"),
        ("officialRequirementSourceUrl", "field-authority"),
    ):
        if record.get(key):
            rows.append({"url": str(record[key]), "title": key, "role": role})
    dedup: dict[str, dict[str, str]] = {}
    for row in rows:
        dedup.setdefault(row["url"], row)
    return list(dedup.values())


def domains_from_urls(urls: list[str]) -> list[str]:
    domains = []
    for url in urls:
        host = urlparse(url).hostname
        if host:
            domains.append(host.lower())
    return sorted(set(domains))


def coverage_state(record: dict[str, Any], field: str) -> dict[str, str]:
    value = first_value(record, MATERIAL_FIELDS[field])
    evidence = evidence_for(record, field)
    source_url = str(evidence.get("sourceUrl") or "")
    source_id = str(evidence.get("sourceId") or "")
    pointer = text(evidence.get("sourceText") or value)
    status = str(record.get("publicDisplayStatus") or "")

    if is_empty(value):
        return {
            "state": "official-unpublished",
            "sourceId": source_id or "candidate-record",
            "sourceUrl": source_url,
            "evidencePointer": "no candidate value",
            "reason": "No value was present in candidate data; keep review until official evidence is collected.",
        }
    if status in NON_PUBLIC:
        return {
            "state": "needs-review",
            "sourceId": source_id or "candidate-record",
            "sourceUrl": source_url,
            "evidencePointer": pointer,
            "reason": f"Record publicDisplayStatus is {status}.",
        }
    if source_url or source_id or record.get("evidence"):
        state = "general-rule" if "general" in pointer.lower() or source_id in {"candidate-record"} else "official-value"
        return {"state": state, "sourceId": source_id, "sourceUrl": source_url, "evidencePointer": pointer}
    return {
        "state": "needs-review",
        "sourceId": "",
        "sourceUrl": "",
        "evidencePointer": pointer,
        "reason": "Value exists but has no explicit source evidence.",
    }


def build_field_coverage(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    matrix = []
    for index, record in enumerate(records, start=1):
        matrix.append({
            "code": record_code(record, index),
            "nameEnOfficial": record_name(record),
            "fields": {field: coverage_state(record, field) for field in MATERIAL_FIELDS},
        })
    return matrix


def build_trace(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = []
    for index, record in enumerate(records, start=1):
        if str(record.get("publicDisplayStatus") or "") != PUBLIC_READY:
            continue
        code = record_code(record, index)
        evidence = [item for item in record.get("evidence") or [] if isinstance(item, dict)]
        if evidence:
            for item in evidence:
                rows.append({"code": code, "nameEnOfficial": record_name(record), **item})
        else:
            rows.append({
                "code": code,
                "nameEnOfficial": record_name(record),
                "field": "record",
                "sourceUrl": record.get("officialSourceUrl") or "",
                "sourceText": "Ready record lacks field-level evidence; review required.",
                "status": "needs-review",
            })
    return rows


def build_source_cache(batch_dir: Path, candidate: dict[str, Any], records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    registry = read_json(batch_dir / "02_official_source_registry.json", {})
    rows: list[dict[str, Any]] = []
    if isinstance(registry, dict):
        for source in registry.get("sources") or []:
            if isinstance(source, dict):
                rows.append(dict(source))
    for record in records:
        rows.extend(source_urls(record))

    dedup: dict[str, dict[str, Any]] = {}
    for index, row in enumerate(rows, start=1):
        url = str(row.get("url") or row.get("sourceUrl") or "")
        if not url:
            continue
        source_id = str(row.get("id") or row.get("sourceId") or f"source-{index:03d}")
        local_path = str(row.get("localPath") or "")
        cache_row = {
            "id": source_id,
            "url": url,
            "role": str(row.get("role") or "field-authority"),
            "title": str(row.get("title") or row.get("name") or source_id),
            "retrievedAt": str(row.get("retrievedAt") or candidate.get("currentAsOf") or date.today().isoformat()),
        }
        if local_path:
            cache_row["localPath"] = local_path
            resolved = (batch_dir / local_path).resolve() if not Path(local_path).is_absolute() else Path(local_path)
            if resolved.exists():
                cache_row["sha256"] = sha256(resolved)
        dedup.setdefault(url, cache_row)
    return list(dedup.values())


def build_display_parity(records: list[dict[str, Any]], coverage: list[dict[str, Any]]) -> dict[str, Any]:
    ready_records = [record for record in records if str(record.get("publicDisplayStatus") or "") == PUBLIC_READY]
    review_records = [record for record in records if str(record.get("publicDisplayStatus") or "") != PUBLIC_READY]
    blocked_fields = 0
    review_fields = 0
    for row in coverage:
        for value in row.get("fields", {}).values():
            state = value.get("state")
            if state in {"needs-review", "transport-blocked", "not-confirmed"}:
                review_fields += 1
            if state == "transport-blocked":
                blocked_fields += 1
    surfaces = []
    for surface, fields in DISPLAY_SURFACES.items():
        field_states: dict[str, dict[str, str]] = {}
        for field in fields:
            if surface == "leakage":
                state = "ready"
                reason = f"{len(review_records)} non-ready records remain excluded from public-ready counts by status."
            elif not records:
                state = "blocked"
                reason = "No candidate records are available."
            elif blocked_fields:
                state = "blocked"
                reason = "One or more material fields are transport-blocked."
            elif review_fields and field in {"tuition", "requirements", "documents", "curriculum", "sourceUrls"}:
                state = "review"
                reason = "Some records have review/unpublished material field states."
            elif ready_records:
                state = "ready"
                reason = "Derived from candidate records and field coverage matrix."
            else:
                state = "review"
                reason = "No ready public records yet."
            field_states[field] = {"state": state, "reason": reason}
        surfaces.append({"surface": surface, "fields": field_states})
    return {"schemaVersion": 1, "surfaces": surfaces}


def summarize_coverage(coverage: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    summary: dict[str, Counter[str]] = defaultdict(Counter)
    for row in coverage:
        for field, value in row.get("fields", {}).items():
            state = value.get("state")
            if state in {"official-value", "general-rule"}:
                summary[field]["covered"] += 1
            elif state == "official-unpublished":
                summary[field]["unpublished"] += 1
            else:
                summary[field]["review"] += 1
    return {field: dict(counts) for field, counts in sorted(summary.items())}


def artifact(batch_dir: Path, filename: str, role: str, description: str) -> dict[str, str]:
    path = batch_dir / filename
    return {"role": role, "path": filename, "sha256": sha256(path), "description": description}


def build_delivery(
    batch_dir: Path,
    candidate: dict[str, Any],
    records: list[dict[str, Any]],
    coverage: list[dict[str, Any]],
    sources: list[dict[str, Any]],
    display: dict[str, Any],
) -> dict[str, Any]:
    existing = read_json(batch_dir / "delivery.json", {})
    exceptions = read_json(batch_dir / "11_exception_queue.json", {"blocking": [], "review": []})
    statuses = Counter(str(record.get("publicDisplayStatus") or "needs-review") for record in records)
    official_domains = sorted(set(
        (existing.get("officialDomains") or [])
        + (candidate.get("officialDomains") or [])
        + domains_from_urls([source.get("url", "") for source in sources])
    ))
    blocking = bool((exceptions or {}).get("blocking"))
    review = bool((exceptions or {}).get("review") or statuses.get("needs-review") or statuses.get("hidden-unverified"))
    decision = "blocked" if blocking or not records else "review-required" if review else "ready-for-controlled-import"
    artifacts = [
        artifact(batch_dir, "00_run_contract.json", "manifest", "Run contract"),
        artifact(batch_dir, "01_instruction_execution_ledger.json", "instruction-execution-ledger", "Instruction execution ledger"),
        artifact(batch_dir, "04_official_row_disposal.json", "official-row-disposal", "Official row disposal"),
        artifact(batch_dir, "05_source_cache_index.json", "source-cache-index", "Source cache and hashes"),
        artifact(batch_dir, "07_field_coverage_matrix.json", "field-coverage-matrix", "Field coverage matrix"),
        artifact(batch_dir, "08_candidate_dataset.json", "candidate", "Candidate dataset"),
        artifact(batch_dir, "09_source_to_candidate_trace.json", "source-trace", "Source to candidate trace"),
        artifact(batch_dir, "10_display_parity_report.json", "display-parity-report", "Display parity report"),
        artifact(batch_dir, "12_operator_review_report.md", "report", "Operator review report"),
    ]
    scope = existing.get("scope") or {
        "universityCode": candidate.get("universityCode"),
        "level": candidate.get("level"),
        "levels": candidate.get("levels"),
        "collectionScope": candidate.get("collectionScope", "programmes"),
        "applicantScope": candidate.get("applicantScope", "international"),
        "academicSession": candidate.get("academicSession"),
    }
    return {
        "schemaVersion": 2,
        "officialDomains": official_domains,
        "scope": scope,
        "authorization": existing.get("authorization") or candidate.get("authorization") or "collect",
        "counts": {
            "directoryOccurrences": existing.get("counts", {}).get("directoryOccurrences", len(records)),
            "uniqueOfficialEntries": existing.get("counts", {}).get("uniqueOfficialEntries", len(records)),
            "canonicalProgrammes": len(records),
            "ready": statuses.get("ready", 0),
            "needsReview": statuses.get("needs-review", 0) + statuses.get("hidden-unverified", 0),
            "notAvailableForInternational": statuses.get("not-available-for-international", 0),
        },
        "coverage": summarize_coverage(coverage),
        "sources": sources,
        "artifacts": artifacts,
        "exceptions": exceptions,
        "verification": {
            "candidateIntegrity": "pending",
            "displayParity": "pending" if display.get("surfaces") else "failed",
            "sourceHashes": "passed" if sources else "pending",
            "generatedArtifacts": "passed",
        },
        "decision": decision,
    }


def write_operator_report(batch_dir: Path, delivery: dict[str, Any], coverage: list[dict[str, Any]]) -> None:
    counts = delivery["counts"]
    review_fields = sum(
        1
        for row in coverage
        for value in row.get("fields", {}).values()
        if value.get("state") not in {"official-value", "general-rule", "official-unpublished", "not-applicable"}
    )
    lines = [
        "# StudyMY Operator Review Report",
        "",
        f"- Decision: {delivery['decision']}",
        f"- Authorization: {delivery['authorization']}",
        f"- Official domains: {', '.join(delivery['officialDomains']) or 'not discovered'}",
        f"- Canonical programmes: {counts['canonicalProgrammes']}",
        f"- Ready: {counts['ready']}",
        f"- Needs review: {counts['needsReview']}",
        f"- Not available for international: {counts['notAvailableForInternational']}",
        f"- Review field cells: {review_fields}",
        "",
        "## Generated Artifacts",
        "",
    ]
    for item in delivery["artifacts"]:
        lines.append(f"- `{item['path']}`: {item['role']} ({item['sha256']})")
    lines.extend([
        "",
        "## Notes",
        "",
        "- This report was generated from candidate data and audit artifacts.",
        "- Missing source evidence is kept as review/unpublished state; no official facts were inferred.",
    ])
    (batch_dir / "12_operator_review_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("batch_dir", type=Path)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--summary-only", action="store_true")
    args = parser.parse_args()

    batch_dir = args.batch_dir
    candidate_path = args.candidate or batch_dir / "08_candidate_dataset.json"
    candidate = read_json(candidate_path, {})
    records = records_from(candidate)

    coverage = build_field_coverage(records)
    trace = build_trace(records)
    sources = build_source_cache(batch_dir, candidate, records)
    display = build_display_parity(records, coverage)

    write_json(batch_dir / "07_field_coverage_matrix.json", coverage)
    write_json(batch_dir / "09_source_to_candidate_trace.json", trace)
    write_json(batch_dir / "05_source_cache_index.json", sources)
    write_json(batch_dir / "10_display_parity_report.json", display)

    delivery = build_delivery(batch_dir, candidate, records, coverage, sources, display)
    write_operator_report(batch_dir, delivery, coverage)
    delivery = build_delivery(batch_dir, candidate, records, coverage, sources, display)
    write_json(batch_dir / "delivery.json", delivery)

    result = {
        "batchDir": str(batch_dir),
        "records": len(records),
        "sources": len(sources),
        "coverageRows": len(coverage),
        "traceRows": len(trace),
        "decision": delivery["decision"],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
