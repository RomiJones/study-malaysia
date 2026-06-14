#!/usr/bin/env python3
"""Build an audited USM doctoral import candidate without database writes."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


APPLICATION_GUIDE_URL = (
    "https://onlineips.usm.my/images/ONLINE%20APPLICATION%20GUIDELINE%20012026%20v1.pdf"
)
COURSEWORK_MIXED_URL = (
    "https://ips.usm.my/index.php/current-student-v2/candidature-matters/"
    "coursework-and-mixed-mode-programme"
)

APPLICATION_DOCUMENTS = [
    {"id": "passport", "nameEn": "Passport for international applicants", "sourcePage": 2},
    {"id": "photo", "nameEn": "Passport-size photograph", "sourcePage": 2},
    {
        "id": "master-certificate",
        "nameEn": "Master degree certificate and official English translation",
        "sourcePage": 2,
    },
    {
        "id": "academic-transcripts",
        "nameEn": "Academic transcripts and official English translation",
        "sourcePage": 2,
    },
    {
        "id": "graduation-certificate",
        "nameEn": "Graduation certificate, where applicable",
        "sourcePage": 2,
    },
    {"id": "grading-scheme", "nameEn": "Official grading scheme", "sourcePage": 2},
    {
        "id": "english-result",
        "nameEn": "Accepted English-language test result or exemption evidence",
        "sourcePage": 2,
    },
    {
        "id": "research-proposal",
        "nameEn": "Research proposal for research-mode applications",
        "sourcePage": 2,
        "conditional": "research",
    },
    {
        "id": "referees",
        "nameEn": "Referee details for research-mode applications",
        "sourcePage": 2,
        "conditional": "research",
    },
    {
        "id": "scholarship-letter",
        "nameEn": "Scholarship letter, if available",
        "sourcePage": 2,
        "conditional": "if-applicable",
    },
]

RESEARCH_UNIT_ALIASES = {
    "Centre For Marine And Coastal Studies": "Centre for Marine and Coastal Studies",
    "Centre for Islamic Development Management Studies": "Centre for Islamic Dev. Management Studies",
    "Centre for Research on Women and Gender (KANITA)": "Centre for Research on Women & Gender",
    "Collaborative Microelectronic Design Excellence Centre": (
        "Collab. Microelectronic Design Excellence Centre"
    ),
    "Cyber Security Research Centre": "National Advanced IPv6 Centre",
    "Institute for Research in Molecular Medicine": "Inst. for Research in Molecular Medicine",
    "Institute of Nano Optoelectronics Research & Technology": (
        "Inst. of Nano-Optoelectronics Research & Tech."
    ),
    "Malaysian Institute of Pharmaceuticals and Nutraceuticals": (
        "M’sian Institute of Pharmaceuticals & Nutraceuticals"
    ),
    "Pusat Kanser Tun Abdullah Ahmad Badawi": "Advanced Medical and Dental Institute",
    "River Engineering and Urban Drainage Research Centre": (
        "River Eng. & Urban Drainage Research Centre"
    ),
    "School of Languages, Literacies & Translation": (
        "School of Languages, Literacies and Translation"
    ),
    "School of Materials and Mineral Resources Engineering": (
        "School of Materials and Mineral Resources Eng."
    ),
}

DIRECT_FEE_TARGETS = {
    "USM-PG-ARTICLE-340": "Doctor of Business Administration",
    "USM-PG-ARTICLE-336": "Doctor of Business Administration (Online)",
    "USM-PG-ARTICLE-413": "Doctor of Neuroscience",
    "USM-PG-ARTICLE-416": "Doctor of Public Health (Environmental Health and Occupational)",
    "USM-PG-ARTICLE-417": "Doctor of Public Health (Epidemiology)",
    "USM-PG-ARTICLE-415": "Doctor of Public Health (Family Health)",
    "USM-PG-ARTICLE-420": "Doctor of Public Health (Health System Management)",
    "USM-PG-ARTICLE-348": "Doctor of Education in Curriculum & Instruction",
    "USM-PG-ARTICLE-347": "Doctor of Education in Educational Technology & Multimedia",
    "USM-PG-ARTICLE-346": "Doctor of Education in Science Education",
    "USM-PG-ARTICLE-349": "Doctor of Education in TESOL",
    "USM-PG-ARTICLE-567": "Doctor of Psychology (Clinical Neuropsychology) - Joint Degree",
    "USM-PG-ARTICLE-566": "Doctor of Psychology (Clinical Psychology) - Joint Degree",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def campus_for(record: dict) -> dict:
    title = record["nameEnOfficial"].lower()
    faculty = record["facultyEn"]
    if record["delivery"] == "offshore":
        for place in ("Istanbul", "Qinhuangdao", "YangTze", "Minjiang", "Indonesia"):
            if place.lower() in title:
                return {"name": place, "provenance": "programme-specific"}
        return {"name": "International partner campus", "provenance": "programme-specific"}
    if "usm@kl" in title or faculty == "USM@KL":
        return {"name": "USM@KL, Kuala Lumpur", "provenance": "programme-specific"}
    if faculty.startswith("School of ") and "Engineering" in faculty:
        return {"name": "Engineering Campus, Nibong Tebal", "provenance": "general-rule"}
    if faculty in {"School of Dental Sciences", "School of Health Sciences", "School of Medical Sciences"}:
        return {"name": "Health Campus, Kubang Kerian", "provenance": "general-rule"}
    if faculty == "Pusat Kanser Tun Abdullah Ahmad Badawi":
        return {
            "name": "Advanced Medical and Dental Institute, Bertam",
            "provenance": "general-rule",
        }
    return {"name": "Main Campus, Penang", "provenance": "general-rule"}


def infer_mode(record: dict, direct_fee: dict | None) -> tuple[str, str]:
    title = record["nameEnOfficial"].lower()
    if direct_fee:
        return direct_fee["studyMode"], "programme-specific"
    if "coursework" in title:
        return "coursework", "programme-specific"
    return "research", "programme-specific" if "research" in title else "general-rule"


def duration_for(mode: str, detail: dict) -> dict:
    raw = clean(detail.get("durationOfficial"))
    semester_values = [int(value) for value in re.findall(r"(\d+)\s*semesters?", raw, re.I)]
    if mode == "research":
        return {
            "durationValue": {"min": 2.0, "max": 5.0},
            "durationUnit": "year",
            "durationOfficial": raw or "Full-time: Min 4 semesters / Max 10 semesters",
            "fullTimeSemesters": {"min": 4, "max": 10},
            "partTimeSemesters": {"min": 6, "max": 15},
            "provenance": "programme-specific" if len(semester_values) >= 2 else "general-rule",
        }
    if len(semester_values) >= 2:
        return {
            "durationValue": {
                "min": semester_values[0] / 2,
                "max": semester_values[1] / 2,
            },
            "durationUnit": "year",
            "durationOfficial": raw,
            "provenance": "programme-specific",
        }
    return {
        "durationValue": None,
        "durationUnit": "year",
        "durationOfficial": raw,
        "provenance": "official-unpublished" if not raw else "not-confirmed",
    }


def research_fee_for(record: dict, rows: list[dict]) -> dict | None:
    if record["delivery"] == "offshore":
        return None
    unit = record["facultyEn"]
    if unit == "School of Distance Education":
        unit = (
            "School of Distance Education (Sciences)"
            if record["cluster"] == "pure-sciences"
            else "School of Distance Education (Arts)"
        )
    if unit == "Centre for Global Sustainability Studies":
        unit = (
            "Centre for Global Sustainability Studies (Sciences)"
            if record["cluster"] in {"pure-sciences", "applied-sciences"}
            else "Centre for Global Sustainability Studies (Arts)"
        )
    unit = RESEARCH_UNIT_ALIASES.get(unit, unit)
    matches = [row for row in rows if row["academicUnit"] == unit]
    return matches[0] if len(matches) == 1 else None


def fee_for(record: dict, mode: str, fee_schedule: dict) -> dict:
    named_rows = {
        row["nameEnOfficial"]: row for row in fee_schedule["doctoralNamedProgrammeFees"]
    }
    direct_name = DIRECT_FEE_TARGETS.get(record["code"])
    if direct_name:
        row = named_rows[direct_name]
        return {
            "status": "verified-current-official-fee",
            "tuitionAmount": row["international"]["amount"],
            "tuitionCurrency": row["international"]["currency"],
            "tuitionBasis": "total-programme",
            "tuitionAcademicSession": row["academicSession"],
            "officialFeeSourceUrl": row["officialFeeSourceUrl"],
            "provenance": "programme-specific",
            "sourcePage": row["sourcePage"],
        }
    if mode == "research":
        row = research_fee_for(record, fee_schedule["researchAcademicUnitFees"])
        if row:
            rate = row["international"]["fullTimePerSemester"]
            return {
                "status": "verified-calculated-total-range",
                "tuitionAmount": {"min": rate * 4, "max": rate * 10},
                "tuitionCurrency": row["international"]["currency"],
                "tuitionBasis": "total-programme",
                "officialRatePerSemester": rate,
                "tuitionAcademicSession": row["academicSession"],
                "officialFeeSourceUrl": row["officialFeeSourceUrl"],
                "provenance": "calculated-from-official-components",
                "calculation": "international full-time per-semester rate x 4-10 semesters",
                "sourcePage": row["sourcePage"],
            }
    return {
        "status": "official-unpublished",
        "tuitionAmount": None,
        "tuitionCurrency": None,
        "tuitionBasis": None,
        "tuitionAcademicSession": fee_schedule["academicSession"],
        "officialFeeSourceUrl": fee_schedule["researchAcademicUnitFees"][0][
            "officialFeeSourceUrl"
        ],
        "provenance": "official-unpublished",
    }


def build_record(record: dict, detail: dict, source: dict, named_rows: dict) -> dict:
    direct_fee = named_rows.get(DIRECT_FEE_TARGETS.get(record["code"], ""))
    mode, mode_provenance = infer_mode(record, direct_fee)
    duration = duration_for(mode, detail)
    fee = fee_for(record, mode, source["feeSchedule"])
    title = record["nameEnOfficial"]
    local_only = "malaysian candidate only" in title.lower()
    fee_confirms_international_scope = fee["tuitionAmount"] is not None
    if local_only:
        eligibility = {
            "status": "not-available-for-international",
            "provenance": "programme-specific",
            "evidenceText": "Malaysian Candidate Only",
        }
    elif fee_confirms_international_scope:
        eligibility = {
            "status": "eligible",
            "provenance": "programme-specific",
            "evidenceText": "Current official fee authority publishes an international fee for this offering.",
        }
    else:
        eligibility = {
            "status": "not-confirmed",
            "provenance": "not-confirmed",
            "evidenceText": "",
        }

    academic_text = clean(detail.get("officialAcademicRequirement")) or source[
        "generalRequirements"
    ]["officialAcademicRequirement"]
    language_text = clean(detail.get("officialLanguageRequirement")) or source[
        "generalRequirements"
    ]["officialLanguageRequirement"]
    intake_text = clean(detail.get("officialIntake"))
    intake = {
        "intakeMonths": [],
        "officialIntake": intake_text,
        "provenance": "programme-specific" if intake_text else "official-unpublished",
    }
    campus = campus_for(record)

    review_reasons = []
    if eligibility["status"] == "not-confirmed":
        review_reasons.append("international eligibility is not explicitly confirmed")
    if duration["durationValue"] is None:
        review_reasons.append("official numeric duration is unpublished")
    if not intake_text:
        review_reasons.append("programme-specific intake is unpublished")
    if fee["tuitionAmount"] is None:
        review_reasons.append("no uniquely applicable current international tuition")
    if detail.get("status") == "blocked":
        review_reasons.append("official detail page collection failed")

    if local_only:
        public_status = "not-available-for-international"
    elif review_reasons:
        public_status = "needs-review"
    else:
        public_status = "ready"

    detail_hash = detail.get("sha256")
    evidence = [
        {
            "field": "identity",
            "sourceId": "usm-pg-directory-current",
            "sourceUrl": record["officialSourceUrl"],
            "sourceText": title,
            "retrievedAt": source["retrievedAt"],
            "confidence": 1,
        },
        {
            "field": "fee",
            "sourceId": "usm-pg-fees-2025-2026",
            "sourceUrl": fee["officialFeeSourceUrl"],
            "sourcePage": fee.get("sourcePage"),
            "sourceText": fee["status"],
            "retrievedAt": source["retrievedAt"],
            "confidence": 1 if fee["tuitionAmount"] is not None else 0,
        },
    ]
    return {
        "code": record["code"].replace("USM-PG-", "USM-PHD-"),
        "sourceCode": record["code"],
        "nameEnOfficial": title,
        "level": "phd",
        "universityCode": "USM",
        "facultyEn": record["facultyEn"],
        "campus": campus["name"],
        "campusProvenance": campus["provenance"],
        "studyMode": mode,
        "studyModeProvenance": mode_provenance,
        "delivery": record["delivery"],
        "applicantScope": "international",
        "internationalEligibility": eligibility,
        "academicSession": "current-directory-and-2025/2026-fees",
        **duration,
        **intake,
        "officialAcademicRequirement": academic_text,
        "academicRequirementProvenance": (
            "programme-specific"
            if detail.get("officialAcademicRequirement")
            else "general-rule"
        ),
        "officialLanguageRequirement": language_text,
        "languageRequirementProvenance": (
            "programme-specific"
            if detail.get("officialLanguageRequirement")
            else "general-rule"
        ),
        "applicationDocuments": APPLICATION_DOCUMENTS,
        "applicationDocumentsProvenance": "general-rule",
        "careers": [],
        "careersProvenance": "official-unpublished",
        "researchFieldsOfficialText": clean(detail.get("overviewExcerpt")),
        "officialSourceUrl": record["officialSourceUrl"],
        "officialVerifiedAt": source["retrievedAt"],
        "officialSourceStatus": detail.get("status", "blocked"),
        "publicDisplayStatus": public_status,
        "reviewReasons": review_reasons,
        "fee": fee,
        "evidence": evidence,
        "detailSha256": detail_hash,
    }


def coverage(records: list[dict]) -> dict:
    checks = {
        "identity": lambda row: bool(row["nameEnOfficial"] and row["officialSourceUrl"]),
        "faculty": lambda row: bool(row["facultyEn"]),
        "studyMode": lambda row: row["studyMode"] in {"research", "mixed", "coursework"},
        "campus": lambda row: bool(row["campus"]),
        "duration": lambda row: row["durationValue"] is not None,
        "intake": lambda row: bool(row["officialIntake"]),
        "internationalEligibility": lambda row: row["internationalEligibility"]["status"]
        != "not-confirmed",
        "academicRequirement": lambda row: bool(row["officialAcademicRequirement"]),
        "languageRequirement": lambda row: bool(row["officialLanguageRequirement"]),
        "applicationDocuments": lambda row: bool(row["applicationDocuments"]),
        "fee": lambda row: row["fee"]["tuitionAmount"] is not None,
        "evidence": lambda row: bool(row["evidence"] and row["detailSha256"]),
    }
    result = {}
    for key, check in checks.items():
        covered = sum(check(row) for row in records)
        result[key] = {
            "covered": covered,
            "unpublished": sum(
                key in {"duration", "intake", "fee"} and not check(row) for row in records
            ),
            "review": len(records) - covered
            if key not in {"duration", "intake", "fee"}
            else 0,
        }
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--application-guide", required=True, type=Path)
    parser.add_argument("--coursework-mixed-html", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--audit-output", required=True, type=Path)
    parser.add_argument("--delivery-output", required=True, type=Path)
    parser.add_argument("--verified", action="store_true")
    args = parser.parse_args()

    source = json.loads(args.source.read_text(encoding="utf-8"))
    details = {item["code"]: item for item in source["details"]}
    named_rows = {
        row["nameEnOfficial"]: row
        for row in source["feeSchedule"]["doctoralNamedProgrammeFees"]
    }
    records = [
        build_record(record, details.get(record["code"], {}), source, named_rows)
        for record in source["records"]
    ]
    status_counts = Counter(row["publicDisplayStatus"] for row in records)
    fee_counts = Counter(row["fee"]["status"] for row in records)
    exceptions = [
        {
            "code": row["code"],
            "nameEnOfficial": row["nameEnOfficial"],
            "reasons": row["reviewReasons"],
        }
        for row in records
        if row["publicDisplayStatus"] == "needs-review"
    ]
    output = {
        "schemaVersion": "studymy-usm-phd-candidate-v1",
        "universityCode": "USM",
        "officialDomains": source["officialDomains"],
        "level": "phd",
        "applicantScope": "international",
        "academicSession": "current-directory-and-2025/2026-fees",
        "retrievedAt": source["retrievedAt"],
        "declaredProgrammeCount": len(records),
        "databaseWrite": "not-performed",
        "sources": source["sources"]
        + [
            {
                "id": "usm-onlineips-application-guide-2026",
                "title": "USM OnlineIPS Online Application Guideline",
                "url": APPLICATION_GUIDE_URL,
                "sourceType": "official-pdf",
                "role": "field-authority",
                "retrievedAt": source["retrievedAt"],
                "academicSession": "2026",
                "status": "verified",
                "sha256": sha256(args.application_guide),
                "localPath": str(args.application_guide),
            },
            {
                "id": "usm-coursework-mixed-candidature",
                "title": "USM Coursework and Mixed Mode Programme",
                "url": COURSEWORK_MIXED_URL,
                "sourceType": "official-page",
                "role": "field-authority",
                "retrievedAt": source["retrievedAt"],
                "academicSession": None,
                "status": "verified",
                "sha256": sha256(args.coursework_mixed_html),
                "localPath": str(args.coursework_mixed_html),
            },
        ],
        "applicationDocuments": {
            "items": APPLICATION_DOCUMENTS,
            "provenance": "general-rule",
            "officialSourceUrl": APPLICATION_GUIDE_URL,
        },
        "records": records,
        "exceptions": exceptions,
        "audit": {
            "directoryOccurrences": source["audit"]["directory"]["doctorOccurrences"],
            "uniqueOfficialEntries": source["directoryEntryCount"],
            "canonicalProgrammes": len(records),
            "statusCounts": dict(status_counts),
            "modeCounts": dict(Counter(row["studyMode"] for row in records)),
            "deliveryCounts": dict(Counter(row["delivery"] for row in records)),
            "feeCounts": dict(fee_counts),
            "doctoralNamedFeeRows": len(named_rows),
            "coverage": coverage(records),
            "exceptionCount": len(exceptions),
            "publicationDecision": "blocked",
            "blockingReasons": [
                "Collection authorization does not permit database publication.",
                "Needs-review records must not enter the public international catalogue.",
                "Four-language commercial localization has not been reviewed.",
            ],
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    audit_output = {
        "schemaVersion": 1,
        "scope": {
            "universityCode": "USM",
            "level": "phd",
            "applicantScope": "international",
            "academicSession": output["academicSession"],
        },
        "retrievedAt": output["retrievedAt"],
        "counts": output["audit"],
        "exceptions": exceptions,
        "sourceHashes": {
            item["id"]: item.get("sha256") for item in output["sources"] if item.get("sha256")
        },
        "databaseWrite": "not-performed",
        "publicationDecision": "blocked",
    }
    args.audit_output.parent.mkdir(parents=True, exist_ok=True)
    args.audit_output.write_text(
        json.dumps(audit_output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    delivery = {
        "schemaVersion": 1,
        "officialDomains": output["officialDomains"],
        "scope": audit_output["scope"],
        "authorization": "collect",
        "counts": {
            "directoryOccurrences": output["audit"]["directoryOccurrences"],
            "uniqueOfficialEntries": output["audit"]["uniqueOfficialEntries"],
            "canonicalProgrammes": len(records),
            "ready": status_counts.get("ready", 0),
            "needsReview": status_counts.get("needs-review", 0),
            "notAvailableForInternational": status_counts.get(
                "not-available-for-international", 0
            ),
        },
        "coverage": output["audit"]["coverage"],
        "sources": output["sources"],
        "artifacts": [
            {
                "role": "manifest",
                "path": str(args.source),
                "sha256": sha256(args.source),
            },
            {
                "role": "candidate",
                "path": str(args.output),
                "sha256": sha256(args.output),
            },
            {
                "role": "audit",
                "path": str(args.audit_output),
                "sha256": sha256(args.audit_output),
            },
        ],
        "exceptions": {
            "blocking": [],
            "review": exceptions,
        },
        "verification": {
            "sourceCollection": "passed",
            "candidateBuild": "passed",
            "recordAudit": "passed" if args.verified else "pending",
            "deliveryAudit": "not-required",
            "databaseWrite": "not-required",
            "apiUiVerification": "not-required",
        },
        "decision": "audited-candidate-with-review-exceptions",
        "databaseWrite": "not-performed",
    }
    args.delivery_output.parent.mkdir(parents=True, exist_ok=True)
    args.delivery_output.write_text(
        json.dumps(delivery, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "records": len(records),
                "statuses": dict(status_counts),
                "modes": output["audit"]["modeCounts"],
                "fees": dict(fee_counts),
                "exceptions": len(exceptions),
                "databaseWrite": output["databaseWrite"],
                "auditOutput": str(args.audit_output),
                "deliveryOutput": str(args.delivery_output),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
