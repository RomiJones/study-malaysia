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
OFFSHORE_POLICY_URL = "https://admission.usm.my/index.php/main/postgraduate"
DBA_DURATION_OFFICIAL = (
    "Full-Time Duration: 3.5-5 years; Part-Time Duration: 4.5-7 years"
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
    "Centre for Research On Women and Gender (KANITA)": "Centre for Research on Women & Gender",
    "Collaborative Microelectronic Design Excellence Centre": (
        "Collab. Microelectronic Design Excellence Centre"
    ),
    "Cyber Security Research Centre": "National Advanced IPv6 Centre",
    "Cybersecurity Research Centre": "National Advanced IPv6 Centre",
    "Institute for Research in Molecular Medicine": "Inst. for Research in Molecular Medicine",
    "Institute of Nano Optoelectronics Research & Technology": (
        "Inst. of Nano-Optoelectronics Research & Tech."
    ),
    "Institute of Nano-Optoelectronics Research and Technology": (
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

# Official offshore application codes already represented by a distinct detail page.
OFFSHORE_DETAIL_TARGETS = {
    "R14": "USM-PG-ARTICLE-1493",
    "R17": "USM-PG-ARTICLE-1516",
    "R15": "USM-PG-ARTICLE-1494",
    "R29": "USM-PG-ARTICLE-1474",
    "R40": "USM-PG-ARTICLE-1479",
    "R92": "USM-PG-ARTICLE-1482",
    "R28": "USM-PG-ARTICLE-1501",
    "R34": "USM-PG-ARTICLE-1506",
    "R88": "USM-PG-ARTICLE-1508",
    "R37": "USM-PG-ARTICLE-1503",
    "R41": "USM-PG-ARTICLE-1515",
    "R35": "USM-PG-ARTICLE-1519",
    "R36": "USM-PG-ARTICLE-1492",
    "R93": "USM-PG-ARTICLE-1491",
    "R30": "USM-PG-ARTICLE-1490",
    "R90": "USM-PG-ARTICLE-1487",
    "R59": "USM-PG-ARTICLE-1486",
    "R87": "USM-PG-ARTICLE-1476",
    "R95": "USM-PG-ARTICLE-1475",
}

def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def clean_official_text(value: str | None) -> str:
    return clean(
        re.split(
            r"Postgraduate Institute of Postgraduate Studies|Disclaimer|Last Update:",
            value or "",
            maxsplit=1,
            flags=re.I,
        )[0]
    )


def detail_code(url: str) -> str:
    article_id = re.search(r"(?:[?&])id=(\d+)", url)
    if article_id:
        return f"USM-PG-ARTICLE-{article_id.group(1)}"
    slug = url.split("?", 1)[0].rstrip("/").split("/")[-1]
    return f"USM-PG-SLUG-{slug.upper()}"


def normalized_official_url(url: str) -> str:
    article_id = re.search(r"(?:[?&])id=(\d+)", url)
    if article_id:
        return f"https://admission.usm.my/index.php/postgraduate/programmes?id={article_id.group(1)}"
    return url.rstrip("/")


def current_catalogue_record(row: dict) -> dict:
    base_code = detail_code(row["url"])
    identity = hashlib.sha1(
        f"{row['name']}|{row['degree']}|{row['school']}|{row['cluster']}".encode()
    ).hexdigest()[:8].upper()
    mode = {
        "RESEARCH": "research",
        "COURSEWORK": "coursework",
        "MIXED MODE": "mixed",
        "ODL (ONLINE)": "online",
    }[row["mode"]]
    delivery = {
        "CONVENTIONAL": "on-campus-or-unspecified",
        "OFFSHORE": "offshore",
        "JOINT DEGREE": "joint-degree",
        "DUAL DEGREE": "dual-degree",
        "DOUBLE DEGREE": "double-degree",
    }[row["degree"]]
    faculty = (
        row["school"]
        .title()
        .replace(" Of ", " of ")
        .replace(" And ", " and ")
        .replace(" For ", " for ")
        .replace(" In ", " in ")
        .replace("Usm", "USM")
        .replace("(Kanita)", "(KANITA)")
    )
    return {
        "code": f"{base_code}-{identity}",
        "detailCode": base_code,
        "nameEnOfficial": row["name"],
        "level": "phd",
        "universityCode": "USM",
        "facultyEn": faculty,
        "campus": "official-detail-review-required",
        "studyMode": mode,
        "delivery": delivery,
        "degreeType": row["degree"],
        "cluster": row["cluster"].lower().replace(" ", "-"),
        "applicantScope": "international",
        "internationalEligibility": "official-detail-review-required",
        "academicSession": None,
        "officialSourceUrl": row["url"],
        "directoryOccurrences": 1,
        "identityStatus": "current-official-catalogue-entry",
    }


def campus_for(record: dict) -> dict:
    title = record["nameEnOfficial"].lower()
    faculty = record["facultyEn"]
    if record["delivery"] == "offshore":
        if record.get("offshorePartnerEn"):
            return {
                "name": f"{record['offshorePartnerEn']}, {record['offshoreCountry']}",
                "provenance": "programme-specific",
            }
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
    if record["studyMode"] in {"research", "coursework", "mixed", "online"}:
        return record["studyMode"], "programme-specific"
    if direct_fee:
        return direct_fee["studyMode"], "programme-specific"
    if "doctor of business administration" in title:
        return "mixed", "general-rule"
    if "coursework" in title:
        return "coursework", "programme-specific"
    return "research", "programme-specific" if "research" in title else "general-rule"


def duration_for(mode: str, detail: dict) -> dict:
    raw = clean_official_text(detail.get("durationOfficial"))
    semester_values = [int(value) for value in re.findall(r"(\d+)\s*semesters?", raw, re.I)]
    if len(semester_values) >= 2:
        result = {
            "durationValue": {
                "min": semester_values[0] / 2,
                "max": semester_values[1] / 2,
            },
            "durationUnit": "year",
            "durationOfficial": raw,
            "provenance": "programme-specific",
        }
        if mode == "research":
            result["fullTimeSemesters"] = {
                "min": semester_values[0],
                "max": semester_values[1],
            }
            if len(semester_values) >= 4:
                result["partTimeSemesters"] = {
                    "min": semester_values[2],
                    "max": semester_values[3],
                }
        return result
    year_values = [
        float(value)
        for value in re.findall(r"(\d+(?:\.\d+)?)\s*years?", raw, re.I)
    ]
    if len(year_values) >= 2:
        return {
            "durationValue": {
                "min": year_values[0],
                "max": year_values[1],
            },
            "durationUnit": "year",
            "durationOfficial": raw,
            "provenance": "programme-specific",
        }
    if mode == "research":
        return {
            "durationValue": {"min": 2.0, "max": 5.0},
            "durationUnit": "year",
            "durationOfficial": "Full-time: Min 4 semesters / Max 10 semesters",
            "fullTimeSemesters": {"min": 4, "max": 10},
            "partTimeSemesters": {"min": 6, "max": 15},
            "provenance": "general-rule",
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
    direct_name = DIRECT_FEE_TARGETS.get(record.get("detailCode", record["code"]))
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
    direct_fee = named_rows.get(
        DIRECT_FEE_TARGETS.get(record.get("detailCode", record["code"]), "")
    )
    mode, mode_provenance = infer_mode(record, direct_fee)
    duration = duration_for(mode, detail)
    if record.get("detailCode") == "USM-PG-ARTICLE-340":
        duration = {
            "durationValue": {"min": 3.5, "max": 5.0},
            "durationUnit": "year",
            "durationOfficial": DBA_DURATION_OFFICIAL,
            "fullTimeSemesters": {"min": 7, "max": 10},
            "partTimeSemesters": {"min": 9, "max": 14},
            "provenance": "programme-specific-current-official-page",
        }
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
    elif record["delivery"] == "offshore":
        eligibility = {
            "status": "eligible",
            "provenance": "official-offshore-policy-and-programme-page",
            "evidenceText": (
                "USM states that selected offshore Master's and PhD programmes give "
                "international students access to USM academic standards; the programme "
                "page is retained as the programme-specific authority."
            ),
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

    academic_text = clean_official_text(detail.get("officialAcademicRequirement")) or source[
        "generalRequirements"
    ]["officialAcademicRequirement"]
    language_text = clean_official_text(detail.get("officialLanguageRequirement")) or source[
        "generalRequirements"
    ]["officialLanguageRequirement"]
    intake_text = clean_official_text(detail.get("officialIntake"))
    intake = {
        "intakeMonths": [],
        "officialIntake": intake_text,
        "provenance": "programme-specific" if intake_text else "official-unpublished",
    }
    campus = campus_for(record)

    review_reasons = []
    publication_warnings = []
    if eligibility["status"] == "not-confirmed":
        review_reasons.append("international eligibility is not explicitly confirmed")
    if duration["durationValue"] is None:
        review_reasons.append("official numeric duration is unpublished")
    if not intake_text:
        publication_warnings.append("programme-specific intake is unpublished")
    if fee["tuitionAmount"] is None:
        publication_warnings.append("no uniquely applicable current international tuition")
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
    if record["delivery"] == "offshore":
        evidence.append(
            {
                "field": "internationalEligibility",
                "sourceId": "usm-pg-current-catalogue",
                "sourceUrl": OFFSHORE_POLICY_URL,
                "sourceText": eligibility["evidenceText"],
                "retrievedAt": source["retrievedAt"],
                "confidence": 1,
            }
        )
    return {
        "code": record["code"].replace("USM-PG-", "USM-PHD-"),
        "sourceCode": record["code"],
        "detailCode": record.get("detailCode", record["code"]),
        "nameEnOfficial": title,
        "level": "phd",
        "universityCode": "USM",
        "facultyEn": record["facultyEn"],
        "campus": campus["name"],
        "campusProvenance": campus["provenance"],
        "studyMode": mode,
        "studyModeProvenance": mode_provenance,
        "delivery": record["delivery"],
        "degreeType": record.get("degreeType"),
        "applicationCode": record.get("applicationCode"),
        "offshoreCountry": record.get("offshoreCountry"),
        "offshorePartnerEn": record.get("offshorePartnerEn"),
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
        "researchFieldsOfficialText": clean_official_text(detail.get("overviewExcerpt")),
        "officialSourceUrl": record["officialSourceUrl"],
        "officialVerifiedAt": source["retrievedAt"],
        "officialSourceStatus": detail.get("status", "blocked"),
        "publicDisplayStatus": public_status,
        "reviewReasons": review_reasons,
        "publicationWarnings": publication_warnings,
        "fee": fee,
        "evidence": evidence,
        "detailSha256": detail_hash,
    }


def coverage(records: list[dict]) -> dict:
    checks = {
        "identity": lambda row: bool(row["nameEnOfficial"] and row["officialSourceUrl"]),
        "faculty": lambda row: bool(row["facultyEn"]),
        "studyMode": lambda row: row["studyMode"]
        in {"research", "mixed", "coursework", "online"},
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
    details = {
        normalized_official_url(item["officialSourceUrl"]): item
        for item in source["details"]
    }
    named_rows = {
        row["nameEnOfficial"]: row
        for row in source["feeSchedule"]["doctoralNamedProgrammeFees"]
    }
    current_rows = source.get("currentCatalogue", {}).get("rows", [])
    if len(current_rows) != 95:
        raise ValueError(f"Expected 95 current official doctoral rows, got {len(current_rows)}.")
    current_records = [current_catalogue_record(row) for row in current_rows]
    records = [
        build_record(
            record,
            details.get(normalized_official_url(record["officialSourceUrl"]), {}),
            source,
            named_rows,
        )
        for record in current_records
    ]
    offshore_offerings = [
        item for item in source["offshoreOfferings"] if item["level"] == "phd"
    ]
    offshore_codes = {item["code"] for item in offshore_offerings}
    if offshore_codes != set(OFFSHORE_DETAIL_TARGETS) | {
        "C006",
        "R16",
        "R31",
        "R39",
        "R94",
    }:
        raise ValueError("Doctoral offshore application-code set changed; review mapping.")
    current_detail_codes = {record["detailCode"] for record in current_records}
    missing_targets = set(OFFSHORE_DETAIL_TARGETS.values()) - current_detail_codes
    if missing_targets:
        raise ValueError(f"Offshore detail targets are missing: {sorted(missing_targets)}")
    target_records = {}
    for record in records:
        target_records.setdefault(record["detailCode"], record)
    offshore_application_offerings = []
    for offering in offshore_offerings:
        target_detail_code = OFFSHORE_DETAIL_TARGETS.get(offering["code"])
        target = target_records.get(target_detail_code)
        offshore_application_offerings.append(
            {
                **offering,
                "canonicalProgrammeCode": target["code"] if target else None,
                "mappingStatus": (
                    "mapped-to-current-catalogue"
                    if target
                    else "application-code-only-needs-review"
                ),
            }
        )
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
        "offshoreApplicationOfferings": offshore_application_offerings,
        "legacyDetailedOfferings": source["records"],
        "records": records,
        "exceptions": exceptions,
        "audit": {
            "currentOfficialCatalogueRows": len(current_rows),
            "currentOfficialUniqueUrls": source["currentCatalogue"]["uniqueOfficialUrls"],
            "legacyDirectoryDetailOccurrences": source["audit"]["directory"][
                "doctorOccurrences"
            ],
            "offshoreApplicationCodeOccurrences": len(offshore_offerings),
            "directoryOccurrences": len(current_rows),
            "uniqueOfficialEntries": len(records),
            "canonicalProgrammes": len(records),
            "currentDetailsAddedBeyondLegacyDirectory": source["currentCatalogue"][
                "detailUrlsAddedBeyondLegacyDirectory"
            ],
            "applicationCodeOnlyOfferings": sum(
                item["canonicalProgrammeCode"] is None
                for item in offshore_application_offerings
            ),
            "offshoreApplicationCodesReconciled": len(offshore_offerings),
            "statusCounts": dict(status_counts),
            "modeCounts": dict(Counter(row["studyMode"] for row in records)),
            "deliveryCounts": dict(Counter(row["delivery"] for row in records)),
            "feeCounts": dict(fee_counts),
            "doctoralNamedFeeRows": len(named_rows),
            "coverage": coverage(records),
            "exceptionCount": len(exceptions),
            "publicationDecision": "publish-international-eligible-catalogue",
            "blockingReasons": [
                "Malaysian-only records must remain excluded from the public international catalogue.",
                "Four-language commercial localization must pass import and API/UI verification before release.",
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
        "publicationDecision": "publish-international-eligible-catalogue",
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
        "authorization": "publish-international-eligible-catalogue",
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
            "databaseWrite": "pending",
            "apiUiVerification": "pending",
        },
        "decision": "ready-for-controlled-import",
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
